import { useMemo } from "react";
import { getTodayFocus } from "../utils/priorityEngine";
import { useCheckIn } from "../hooks/useCheckIn";

const C = {
  bg: "#1B1B1F", surface: "#232328", surfaceHigh: "#2C2C32",
  border: "#3A3A42", textPrimary: "#E3E3E8", textSecondary: "#C4C4CC",
  textMuted: "#8E8E96", gold: "#E8C547", green: "#6DD58C",
  red: "#FF8A80", blue: "#7ABCFF", purple: "#C084FC", orange: "#FFAB76",
};

const mono = "'JetBrains Mono', 'Fira Code', monospace";

function TaskRow({ task, color, badge }) {
  const due = task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: "short", day: "numeric" }) : null;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px", borderRadius: 8,
      background: C.surfaceHigh, marginBottom: 6,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.textPrimary, fontSize: 13, lineHeight: 1.4 }}>
          {task.text}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
          {badge && (
            <span style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4,
              background: color + "22", color, fontWeight: 600,
            }}>{badge}</span>
          )}
          {due && <span style={{ color: C.textMuted, fontSize: 11 }}>{due}</span>}
          {task.project_name && (
            <span style={{ color: C.textMuted, fontSize: 11 }}>· {task.project_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, tasks, color, emptyMsg, badgeFn }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: color, display: "inline-block", flexShrink: 0,
        }} />
        <span style={{
          color: C.textMuted, fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: 1, fontFamily: mono,
        }}>{title}</span>
        {tasks.length > 0 && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 10,
            background: color + "22", color, fontWeight: 700,
          }}>{tasks.length}</span>
        )}
      </div>
      {tasks.length === 0
        ? <div style={{ color: C.textMuted, fontSize: 13, padding: "8px 12px" }}>{emptyMsg}</div>
        : tasks.map(t => (
          <TaskRow key={t.id} task={t} color={color} badge={badgeFn ? badgeFn(t) : null} />
        ))
      }
    </div>
  );
}

export default function TodayFocus({ deliverables = [], connections = [], calendarEvents = [] }) {
  const { urgent, important, upcoming, conflicts } = useMemo(
    () => getTodayFocus(deliverables, connections),
    [deliverables, connections]
  );

  const todayStr = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{
      padding: "32px 28px", maxWidth: 760, margin: "0 auto",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: C.textMuted, fontSize: 12, fontFamily: mono, marginBottom: 4 }}>
          TODAY'S FOCUS
        </div>
        <div style={{ color: C.textPrimary, fontSize: 22, fontWeight: 700 }}>{todayStr}</div>
      </div>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div style={{
          background: C.orange + "11", border: `1px solid ${C.orange}44`,
          borderRadius: 10, padding: "14px 16px", marginBottom: 24,
        }}>
          <div style={{ color: C.orange, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            ⚡ Priority Conflicts Detected
          </div>
          {conflicts.map((c, i) => (
            <div key={i} style={{ color: C.textSecondary, fontSize: 12, marginBottom: 4, lineHeight: 1.4 }}>
              <strong style={{ color: C.textPrimary }}>{c.task.text.slice(0, 50)}</strong>
              {c.task.text.length > 50 ? "…" : ""} — {c.reason}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left column */}
        <div>
          <Section
            title="Urgent"
            tasks={urgent}
            color={C.red}
            emptyMsg="Nothing overdue or due today 🎉"
            badgeFn={t => t.daysOverdue != null
              ? `${t.daysOverdue}d overdue`
              : t.daysUntilDue === 0 ? "Due today" : "Due tomorrow"
            }
          />
          <Section
            title="Important"
            tasks={important}
            color={C.orange}
            emptyMsg="Clear for the next 4 days"
            badgeFn={t => `${t.daysUntilDue}d`}
          />
        </div>

        {/* Right column */}
        <div>
          <Section
            title="Upcoming"
            tasks={upcoming}
            color={C.blue}
            emptyMsg="Nothing in the next 10 days"
            badgeFn={t => `in ${t.daysUntilDue}d`}
          />

          {/* Calendar events */}
          {calendarEvents.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <span style={{
                  color: C.textMuted, fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: 1, fontFamily: mono,
                }}>Today's Calendar</span>
              </div>
              {calendarEvents
                .filter(e => {
                  const d = new Date(e.start).toISOString().split("T")[0];
                  return d === new Date().toISOString().split("T")[0];
                })
                .map(e => (
                  <div key={e.id} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: C.surfaceHigh, marginBottom: 6,
                    borderLeft: `3px solid ${C.purple}`,
                  }}>
                    <div style={{ color: C.textPrimary, fontSize: 13 }}>{e.title}</div>
                    <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                      {e.allDay ? "All day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
