// api/calendar.js — Google Calendar integration (server-side token storage)
//
// Refactor of 2026-05-07: tokens now live in user_integrations table.
//
// Security update 2026-05-28:
//   - GET auth-url: JWT auth required; user_id is derived from the auth
//     token (cannot be spoofed from query string).
//   - POST events / create-event: JWT auth required; user_id overridden
//     from the authenticated user's public.users row (body value ignored).
//   - OAuth state: HMAC-SHA256 signed with OAUTH_STATE_SECRET (or
//     CRON_SECRET as stand-in) and includes a timestamp; callback rejects
//     any state with invalid signature or older than 10 minutes.
//   - Callback stays unauthenticated (Google calls it); security comes
//     entirely from state signature verification.
//
// Actions:
//   GET  /api/calendar?action=auth-url
//        JWT auth required. Returns the Google OAuth URL.
//        user_id derived from JWT (query param ignored).
//   GET  /api/calendar?action=callback&code=<...>&state=<signed>
//        Unauthenticated. Validates HMAC state before storing tokens.
//   POST /api/calendar?action=events           body: { days_ahead? }
//        JWT auth required. user_id derived from JWT (body value ignored).
//   POST /api/calendar?action=create-event     body: { title, date, duration_minutes?, description? }
//        JWT auth required. user_id derived from JWT (body value ignored).

import { createHmac, timingSafeEqual } from "crypto";
import { supabase } from "./_supabase.js";
import { getAuthedUser } from "./_auth.js";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://signal-multi.vercel.app";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

// ─── OAuth state HMAC ──────────────────────────────────────────────────────
// Prevents CSRF on the OAuth callback. Key priority:
//   1. OAUTH_STATE_SECRET (dedicated env var — add to Vercel project env)
//   2. CRON_SECRET (stand-in until a dedicated secret is set)
// Fails closed: auth-url returns 500 if neither env var is present.
function stateSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.CRON_SECRET || null;
}

// Returns a base64url-encoded signed state token: userId:timestamp:hmac
function signOAuthState(userId) {
  const secret = stateSecret();
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET (or CRON_SECRET) must be set to generate OAuth state");
  }
  const ts = Date.now().toString();
  const payload = `${userId}:${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

// Returns userId on success, null on any failure (bad sig, expired, malformed).
// UUIDs and timestamps contain no colons, so split(":") gives exactly 3 parts.
function verifyOAuthState(state) {
  const secret = stateSecret();
  if (!secret) return null;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    if (!userId || !ts || !sig) return null;

    const ageMs = Date.now() - parseInt(ts, 10);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60 * 1000) return null;

    const expected = createHmac("sha256", secret).update(`${userId}:${ts}`).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

    return userId;
  } catch {
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Look up the public.users.id for an auth.users entry.
async function getPublicUserId(authUserId) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUserId)
    .maybeSingle();
  return data?.id || null;
}

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
    // ── auth-url ────────────────────────────────────────────────────────────
    // Requires JWT. user_id is derived from the token — the query param is
    // ignored so callers cannot request an auth URL for a different user.
    if (action === "auth-url") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(500).json({ error: "Google OAuth not configured" });

      const authedAuthUser = await getAuthedUser(req);
      if (!authedAuthUser) return res.status(401).json({ error: "Unauthorized" });

      const userId = await getPublicUserId(authedAuthUser.id);
      if (!userId) return res.status(403).json({ error: "User not found" });

      let state;
      try {
        state = signOAuthState(userId);
      } catch (e) {
        console.error("[calendar] state signing failed:", e.message);
        return res.status(500).json({ error: "OAuth state configuration error" });
      }

      const redirectUri = `${REDIRECT_BASE}/api/calendar?action=callback`;

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `state=${encodeURIComponent(state)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      return res.status(200).json({ url: authUrl });
    }

    // ── callback ─────────────────────────────────────────────────────────────
    // Intentionally unauthenticated — Google calls this. Security via signed
    // state: any state that fails signature or freshness check is rejected
    // before any token exchange or storage occurs.
    if (action === "callback") {
      const { code, state } = req.query;
      if (!code) return res.status(400).json({ error: "No auth code provided" });
      if (!state) return res.status(400).json({ error: "Missing state" });

      const userId = verifyOAuthState(state);
      if (!userId) {
        console.warn("[calendar] OAuth callback: invalid or expired state");
        return res.status(400).json({ error: "Invalid or expired OAuth state" });
      }

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
        .upsert(
          {
            user_id: userId,
            provider: "google_calendar",
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );

      if (upsertErr) {
        console.error("Token upsert failed:", upsertErr.message);
        return res.status(500).json({ error: "Failed to persist calendar credentials" });
      }

      return res.redirect(302, `${REDIRECT_BASE}?calendar_connected=true`);
    }

    // ── events ───────────────────────────────────────────────────────────────
    // Requires JWT. user_id is overridden from the authenticated user's
    // public.users row — any user_id in the body is ignored.
    if (action === "events") {
      const authedAuthUser = await getAuthedUser(req);
      if (!authedAuthUser) return res.status(401).json({ error: "Unauthorized" });

      const userId = await getPublicUserId(authedAuthUser.id);
      if (!userId) return res.status(403).json({ error: "User not found" });

      const { days_ahead = 7 } = req.body || {};

      const refreshToken = await getRefreshToken(userId);
      if (!refreshToken) return res.status(404).json({ error: "Calendar not connected" });

      const refreshData = await refreshAccessToken(refreshToken);
      if (refreshData.error) return res.status(401).json({ error: "Token refresh failed" });

      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + parseInt(days_ahead));

      const eventsUrl =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
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

    // ── create-event ─────────────────────────────────────────────────────────
    // Requires JWT. user_id is overridden from the authenticated user's
    // public.users row — any user_id in the body is ignored.
    if (action === "create-event") {
      const authedAuthUser = await getAuthedUser(req);
      if (!authedAuthUser) return res.status(401).json({ error: "Unauthorized" });

      const userId = await getPublicUserId(authedAuthUser.id);
      if (!userId) return res.status(403).json({ error: "User not found" });

      const { title, date, duration_minutes = 60, description = "" } = req.body || {};
      if (!title || !date) return res.status(400).json({ error: "Missing required fields" });

      const refreshToken = await getRefreshToken(userId);
      if (!refreshToken) return res.status(404).json({ error: "Calendar not connected" });

      const refreshData = await refreshAccessToken(refreshToken);
      if (refreshData.error) return res.status(401).json({ error: "Token refresh failed" });

      const startTime = new Date(`${date}T09:00:00`);
      const endTime = new Date(startTime.getTime() + duration_minutes * 60000);

      const event = {
        summary: title,
        description: description ? `[Signal] ${description}` : "[Signal deliverable]",
        start: {
          dateTime: startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
        },
      };

      const createResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${refreshData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      const created = await createResponse.json();
      if (created.error) return res.status(400).json({ error: created.error.message });

      return res.status(200).json({
        event: {
          id: created.id,
          title: created.summary,
          start: created.start,
          htmlLink: created.htmlLink,
        },
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Calendar API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
