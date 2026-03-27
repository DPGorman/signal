// api/calendar.js - Google Calendar integration
// Handles OAuth token exchange and calendar event fetching

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;

  try {
    if (action === "auth-url") {
      // Return the Google OAuth URL for the client to redirect to
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(500).json({ error: "Google OAuth not configured" });

      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://signal-navy-five.vercel.app"}/api/calendar?action=callback`;
      const scopes = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events"
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      return res.status(200).json({ url: authUrl });
    }

    if (action === "callback") {
      // Exchange auth code for tokens
      const { code } = req.query;
      if (!code) return res.status(400).json({ error: "No auth code provided" });

      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://signal-navy-five.vercel.app"}/api/calendar?action=callback`;

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

      // Redirect back to app with tokens in URL fragment
      // In production, store tokens server-side and use a session token
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://signal-navy-five.vercel.app";
      return res.redirect(302, `${appUrl}?calendar_connected=true&refresh_token=${tokens.refresh_token}`);
    }

    if (action === "events") {
      // Fetch calendar events
      const { access_token, refresh_token, days_ahead = 7 } = req.body || req.query;

      let token = access_token;

      // If no access token but have refresh token, get a new one
      if (!token && refresh_token) {
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResponse.json();
        if (refreshData.error) return res.status(401).json({ error: "Token refresh failed" });
        token = refreshData.access_token;
      }

      if (!token) return res.status(401).json({ error: "No valid token" });

      const now = new Date();
      const future = new Date();
      future.setDate(now.getDate() + parseInt(days_ahead));

      const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&` +
        `timeMax=${future.toISOString()}&` +
        `orderBy=startTime&` +
        `singleEvents=true&` +
        `maxResults=20`;

      const eventsResponse = await fetch(eventsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const eventsData = await eventsResponse.json();
      if (eventsData.error) return res.status(400).json({ error: eventsData.error.message });

      // Transform events to Signal format
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

      return res.status(200).json({ events, new_access_token: token !== access_token ? token : null });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Calendar API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
