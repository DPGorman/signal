// api/calendar.js — Google Calendar integration (server-side token storage)
//
// Refactor of 2026-05-07: tokens now live in user_integrations table, not in
// the browser URL fragment. The OAuth state parameter carries the user_id so
// the callback knows whose tokens it's storing. Reads (events, create-event)
// look up the refresh_token by user_id from the table.
//
// Actions:
//   GET  /api/calendar?action=auth-url&user_id=<uuid>
//        Returns the Google OAuth URL with user_id encoded in state.
//   GET  /api/calendar?action=callback&code=<...>&state=<user_id>
//        Exchanges code for tokens, upserts user_integrations row, redirects.
//   POST /api/calendar?action=events           body: { user_id, days_ahead? }
//        Returns upcoming events for the user.
//   POST /api/calendar?action=create-event     body: { user_id, title, date, duration_minutes?, description? }
//        Creates a calendar event for the user.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://signal-multi.vercel.app";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

async function getRefreshToken(userId) {
  const { data } = await supabase
    .from("user_integrations")
    .select("refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  return data?.refresh_token || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;

  try {
    if (action === "auth-url") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(500).json({ error: "Google OAuth not configured" });

      const userId = req.query?.user_id;
      if (!userId) return res.status(400).json({ error: "user_id required" });

      const redirectUri = `${REDIRECT_BASE}/api/calendar?action=callback`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `state=${encodeURIComponent(userId)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      return res.status(200).json({ url: authUrl });
    }

    if (action === "callback") {
      const { code, state } = req.query;
      if (!code) return res.status(400).json({ error: "No auth code provided" });
      if (!state) return res.status(400).json({ error: "Missing state (user_id)" });

      const redirectUri = `${REDIRECT_BASE}/api/calendar?action=callback`;

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code,
        }),
      });
      const tokens = await tokenResponse.json();
      if (tokens.error) return res.status(400).json({ error: tokens.error_description });

      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

      const { error: upsertErr } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: state,
          provider: "google_calendar",
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,provider" });

      if (upsertErr) {
        console.error("Token upsert failed:", upsertErr.message);
        return res.status(500).json({ error: "Failed to persist calendar credentials" });
      }

      return res.redirect(302, `${REDIRECT_BASE}?calendar_connected=true`);
    }

    if (action === "events") {
      const { user_id, days_ahead = 7 } = req.body || req.query;
      if (!user_id) return res.status(400).json({ error: "user_id required" });

      const refreshToken = await getRefreshToken(user_id);
      if (!refreshToken) return res.status(404).json({ error: "Calendar not connected" });

      const refreshData = await refreshAccessToken(refreshToken);
      if (refreshData.error) return res.status(401).json({ error: "Token refresh failed" });

      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + parseInt(days_ahead));

      const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${encodeURIComponent(now.toISOString())}&` +
        `timeMax=${encodeURIComponent(future.toISOString())}&` +
        `orderBy=startTime&` +
        `singleEvents=true&` +
        `maxResults=20`;

      const eventsResponse = await fetch(eventsUrl, {
        headers: { Authorization: `Bearer ${refreshData.access_token}` },
      });
      const eventsData = await eventsResponse.json();
      if (eventsData.error) return res.status(400).json({ error: eventsData.error.message });

      const events = (eventsData.items || []).map(event => ({
        id: event.id,
        title: event.summary || "Untitled Event",
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !event.start?.dateTime,
        description: event.description || "",
        location: event.location || "",
        attendees: (event.attendees || []).map(a => a.email),
        htmlLink: event.htmlLink,
      }));

      return res.status(200).json({ events });
    }

    if (action === "create-event") {
      const { user_id, title, date, duration_minutes = 60, description = "" } = req.body || {};
      if (!user_id || !title || !date) return res.status(400).json({ error: "Missing required fields" });

      const refreshToken = await getRefreshToken(user_id);
      if (!refreshToken) return res.status(404).json({ error: "Calendar not connected" });

      const refreshData = await refreshAccessToken(refreshToken);
      if (refreshData.error) return res.status(401).json({ error: "Token refresh failed" });

      const startTime = new Date(`${date}T09:00:00`);
      const endTime = new Date(startTime.getTime() + duration_minutes * 60000);

      const event = {
        summary: title,
        description: description ? `[Signal] ${description}` : "[Signal deliverable]",
        start: { dateTime: startTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York" },
        end: { dateTime: endTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York" },
      };

      const createResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      const created = await createResponse.json();
      if (created.error) return res.status(400).json({ error: created.error.message });

      return res.status(200).json({ event: { id: created.id, title: created.summary, start: created.start, htmlLink: created.htmlLink } });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Calendar API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
