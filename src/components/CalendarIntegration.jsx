import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { C } from "../lib/constants";

export default function CalendarIntegration({ user, deliverables, onEventsLoaded, onEventsDue }) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [refreshToken, setRefreshToken] = useState(null);

  useEffect(() => {
    // Check if calendar was just connected via OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "true") {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const rt = hashParams.get("refresh_token");
      if (rt) {
        setRefreshToken(rt);
        setConnected(true);
        // Store refresh token in Supabase for this user
        if (user) saveRefreshToken(rt);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        fetchEvents(null, rt);
      }
    }

    // Check if user already has a connected calendar
    if (user) loadSavedToken();
  }, [user]);

  const saveRefreshToken = async (token) => {
    await supabase
      .from("user_integrations")
      .upsert([{ user_id: user.id, provider: "google_calendar", refresh_token: token }]);
  };

  const loadSavedToken = async () => {
    const { data } = await supabase
      .from("user_integrations")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .limit(1);

    const row = data?.[0];
    if (row?.refresh_token) {
      setRefreshToken(row.refresh_token);
      setConnected(true);
      fetchEvents(null, row.refresh_token);
    }
  };

  const connectCalendar = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar?action=auth-url");
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      console.error("Calendar connect error:", err);
      alert("Could not connect to Google Calendar. Check your configuration.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (accessToken = null, rt = refreshToken) => {
    if (!rt && !accessToken) return;
    setLoading(true);
    try {
      const response = await fetch("/api/calendar?action=events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: rt,
          days_ahead: 7,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const evts = data.events || [];
      setEvents(evts);
      if (onEventsLoaded) onEventsLoaded(evts);

      // Cross-reference with Signal tasks
      if (onEventsDue) {
        const eventTitles = evts.map(e => e.title.toLowerCase());
        const missingTasks = deliverables.filter(d =>
          !d.is_complete &&
          d.due_date &&
          eventTitles.some(t => t.includes(d.text.toLowerCase().slice(0, 20)))
        );
        if (missingTasks.length > 0) onEventsDue(missingTasks);
      }
    } catch (err) {
      console.error("Fetch events error:", err);
    } finally {
      setLoading(false);
    }
  };

  const disconnectCalendar = async () => {
    if (!confirm("Disconnect Google Calendar?")) return;
    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google_calendar");
    setConnected(false);
    setRefreshToken(null);
    setEvents([]);
  };

  const formatEventTime = (event) => {
    if (event.allDay) return "All day";
    const start = new Date(event.start);
    return start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatEventDate = (event) => {
    const start = new Date(event.start);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (start.toDateString() === today.toDateString()) return "Today";
    if (start.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = formatEventDate(event);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: connected ? C.surfaceHigh : "transparent",
          border: `1px solid ${connected ? C.green : C.border}`,
          color: connected ? C.green : C.textMuted,
          fontSize: 12, cursor: "pointer",
        }}
      >
        <span>📅</span>
        <span>{connected ? "Calendar" : "Connect Calendar"}</span>
        {connected && <span style={{ color: C.green, fontSize: 10 }}>●</span>}
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 340, background: C.surface,
      borderLeft: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      zIndex: 1000, boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <span style={{ color: C.textPrimary, fontWeight: 600 }}>Calendar</span>
        </div>
        <button onClick={() => setShowPanel(false)} style={{
          background: "none", border: "none", color: C.textMuted,
          cursor: "pointer", fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!connected ? (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
            <div style={{ color: C.textPrimary, fontWeight: 600, marginBottom: 8 }}>
              Connect Google Calendar
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              See your schedule alongside your Signal tasks and get smarter check-ins.
            </div>
            <button
              onClick={connectCalendar}
              disabled={loading}
              style={{
                padding: "10px 20px", borderRadius: 8,
                background: C.blue, border: "none",
                color: "#000", fontWeight: 600, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Connecting..." : "Connect Google Calendar"}
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20,
            }}>
              <div style={{ color: C.green, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <span>●</span> Connected
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => fetchEvents()}
                  disabled={loading}
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    background: C.surfaceHigh, border: `1px solid ${C.border}`,
                    color: C.textSecondary, fontSize: 12, cursor: "pointer",
                  }}
                >
                  {loading ? "..." : "↻ Refresh"}
                </button>
                <button
                  onClick={disconnectCalendar}
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    background: "transparent", border: `1px solid ${C.border}`,
                    color: C.textMuted, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>

            {events.length === 0 ? (
              <div style={{ color: C.textMuted, textAlign: "center", padding: "40px 0", fontSize: 14 }}>
                No upcoming events this week
              </div>
            ) : (
              Object.entries(groupedEvents).map(([date, dayEvents]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{
                    color: C.textMuted, fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: 1,
                    marginBottom: 8,
                  }}>
                    {date}
                  </div>
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      style={{
                        padding: "10px 12px", borderRadius: 8,
                        background: C.surfaceHigh, marginBottom: 6,
                        borderLeft: `3px solid ${C.blue}`,
                      }}
                    >
                      <div style={{ color: C.textPrimary, fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                        {event.title}
                      </div>
                      <div style={{ color: C.textMuted, fontSize: 11 }}>
                        {formatEventTime(event)}
                        {event.location && ` · ${event.location}`}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
