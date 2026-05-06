// api/_calendar/get-events.js
// Server-side helper for reading the user's upcoming Google Calendar events
// and formatting them as runtime context for the AI prompt pipeline.
//
// Underscore prefix on _calendar/ means Vercel doesn't treat this as a route.
//
// Architecture:
//   1. Looks up the user's refresh_token from user_integrations.
//   2. Refreshes the access_token via Google's OAuth endpoint.
//   3. Fetches calendar events from /calendar/v3/calendars/primary/events.
//   4. Caches the result in-memory for 5 minutes per user (TTL matches the
//      Anthropic prompt-cache window — runtime context changes per call but
//      calendar fetches don't need to be more frequent than the cache window).
//   5. Privacy filter: drops events marked visibility="private".
//
// If the user hasn't connected their calendar, returns []. Calls never throw —
// runtime context is augmented when calendar is available, omitted when not.

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // userId -> { events, cachedAt }

/**
 * Returns up to 20 upcoming non-private events for a user, or [] if anything
 * goes wrong (no integration, expired refresh_token, Google API down, etc.).
 *
 * @param {SupabaseClient} supabase
 * @param {string} userId
 * @param {number} daysAhead — defaults to 7
 * @returns {Promise<Array<{title:string,start:string,end:string,allDay:boolean}>>}
 */
export async function getUpcomingEvents(supabase, userId, daysAhead = 7) {
  if (!supabase || !userId) return [];

  const cached = cache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.events;
  }

  try {
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("refresh_token")
      .eq("user_id", userId)
      .eq("provider", "google_calendar")
      .maybeSingle();

    if (!integration?.refresh_token) {
      cache.set(userId, { events: [], cachedAt: Date.now() });
      return [];
    }

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshResponse.json();
    if (refreshData.error || !refreshData.access_token) {
      console.warn("Calendar token refresh failed for user", userId, refreshData.error);
      return [];
    }

    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + daysAhead);

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
    if (eventsData.error) {
      console.warn("Calendar events fetch failed for user", userId, eventsData.error.message);
      return [];
    }

    const events = (eventsData.items || [])
      .filter(e => e.visibility !== "private" && e.status !== "cancelled")
      .map(e => ({
        title: e.summary || "Untitled",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
      }));

    cache.set(userId, { events, cachedAt: Date.now() });
    return events;
  } catch (e) {
    console.warn("Calendar fetch threw for user", userId, e.message);
    return [];
  }
}

/**
 * Formats an events array as a runtime-context block for the AI system prompt.
 * Empty array → empty string (caller can filter out).
 *
 * Format chosen for: human-legibility, compactness, and easy parseability by Claude.
 *
 * @param {Array} events
 * @returns {string}
 */
export function formatEventsForContext(events) {
  if (!Array.isArray(events) || events.length === 0) return "";

  const lines = events.map(e => {
    if (e.allDay) {
      return `- ${e.start} (all-day): ${e.title}`;
    }
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : null;
    const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const endTime = end ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
    const durationMin = end ? Math.round((end - start) / 60000) : null;
    const durationStr = durationMin ? ` (${durationMin}min)` : "";
    return `- ${day} ${startTime}${endTime ? `–${endTime}` : ""}${durationStr}: ${e.title}`;
  });

  return `CALENDAR (next 7 days, sorted earliest first):\n${lines.join("\n")}`;
}
