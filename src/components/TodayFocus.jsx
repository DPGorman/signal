import { useMemo } from "react";
import { getTodayFocus } from "../utils/priorityEngine";

const C = {
  bg: "#1B1B1F", surface: "#232328", surfaceHigh: "#2C2C32",
  border: "#3A3A42", textPrimary: "#E3E3E8", textSecondary: "#C4C4CC",
  textMuted: "#8E8E96", gold: "#E8C547", green: "#6DD58C",
  red: "#FF8A80", blue: "#7ABCFF", purple: "#C084FC", orange: "#FFAB76",
};

const mono = "'JetBrains Mono', 'Fira Code', monospace";

function TaskRow({ task, color, badge, onToggle, onAddToSession }) {
  const due = task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: "short", day: "numeric" }) : null;
  const todayStr = new Date().toISOString().split("T")[0];
  const inSession = task.session_date === todayStr;
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 12px", borderRadius: 8,
        background: C.surfaceHigh, marginBottom: 6,
        borderLeft: `3px solid ${color}`,
        cursor: onToggle ? "pointer" : "default",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => onToggle && (e.currentTarget.style.background = C.surface)}
      onMouseLeave={e => onToggle && (e.currentTarget.style.background = C.surfaceHigh)}
    >
      <div onClick={() => onToggle?.(task.id, task.is_complete)} style={{
        width: 16, height: 16, borderRadius: 3, marginTop: 2, flexShrink: 0,
        border: `2px solid ${task.is_complete ? C.green : C.border}`,
        background: task.is_complete ? C.green + "30" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        {task.is_complete && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
      </div>
      <div style={{ flex: 1 }} onClick={() => onToggle?.(task.id, task.is_complete)}>
        <div style={{ color: C.textPrimary, fontSize: 13, lineHeight: 1.4 }}>
          {task.is_starred && <span style={{ color: C.gold, marginRight: 4 }}>★</span>}
          {task.text}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
          {badge && (
            <span style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 4,
              background: color + "22", color, fontWeight: 600,
            }}>{badge}</span>
          )}
          {task.duration_minutes && <span style={{ color: C.textMuted, fontSize: 11 }}>{task.duration_minutes < 60 ? `${task.duration_minutes}m` : `${Math.floor(task.duration_minutes/60)}h${task.duration_minutes%60 ? ` ${task.duration_minutes%60}m` : ""}`}</span>}
          {due && <span style={{ color: C.textMuted, fontSize: 11 }}>{due}</span>}
          {inSession && <span style={{ color: C.gold, fontSize: 10 }}>☀ Session</span>}
          {task.project_name && (
            <span style={{ color: C.textMuted, fontSize: 11 }}>· {task.project_name}</span>
          )}
        </div>
      </div>
      {onAddToSession && !inSession && !task.is_complete && (
        <span onClick={(e) => { e.stopPropagation(); onAddToSession(task.id); }}
          title="Add to Today's Session"
          style={{ fontSize: 13, color: C.textDisabled, cursor: "pointer", padding: "2px 4px", flexShrink: 0, transition: "color 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.color = C.gold}
          onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}>
          ☀
        </span>
      )}
    </div>
  );
}

function Section({ title, tasks, color, emptyMsg, badgeFn, onToggle, onAddToSession }) {
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
          <TaskRow key={t.id} task={t} color={color} badge={badgeFn ? badgeFn(t) : null} onToggle={onToggle} onAddToSession={onAddToSession} />
        ))
      }
    </div>
  );
}

export default function TodayFocus({ deliverables = [], connections = [], calendarEvents = [], onToggleDeliverable, onNavigate, onAddToSession }) {
  const { urgent, important, upcoming, conflicts } = useMemo(
    () => getTodayFocus(deliverables, connections),
    [deliverables, connections]
  );

  const todayStr = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const undatedCount = deliverables.filter(d => !d.due_date && !d.is_complete).length;

  return (
    <div style={{
      padding: "32px 28px", maxWidth: 760, margin: "0 auto",
      fontFamily: "'Inter', sans-serif", flex: 1, overflowY: "auto",
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
            Priority Conflicts Detected
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
            emptyMsg="Nothing overdue or due today"
            badgeFn={t => t.daysOverdue != null
              ? `${t.daysOverdue}d overdue`
              : t.daysUntilDue === 0 ? "Due today" : "Due tomorrow"
            }
            onToggle={onToggleDeliverable}
            onAddToSession={onAddToSession}
          />
          <Section
            title="Important"
            tasks={important}
            color={C.orange}
            emptyMsg="Clear for the next 4 days"
            badgeFn={t => `${t.daysUntilDue}d`}
            onToggle={onToggleDeliverable}
            onAddToSession={onAddToSession}
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
            onToggle={onToggleDeliverable}
            onAddToSession={onAddToSession}
          />

          {/* Calendar events */}
          {calendarEvents.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: C.purple, display: "inline-block", flexShrink: 0,
                }} />
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

      {/* Session nudge */}
      {(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const sessionCount = deliverables.filter(d => d.session_date === todayStr && !d.is_complete).length;
        return sessionCount > 0 ? (
          <div
            onClick={() => onNavigate?.("tasks")}
            style={{
              marginTop: 8, padding: "12px 16px", borderRadius: 8,
              background: C.gold + "11", border: `1px solid ${C.gold}33`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: onNavigate ? "pointer" : "default",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.gold + "33"}>
            <span style={{ color: C.textSecondary, fontSize: 12 }}>
              <span style={{ color: C.gold }}>☀</span> <strong style={{ color: C.gold }}>{sessionCount}</strong> {sessionCount === 1 ? "task" : "tasks"} in today's session
            </span>
            <span style={{ color: C.gold, fontSize: 11, fontFamily: mono }}>OPEN SESSION →</span>
          </div>
        ) : null;
      })()}

      {/* Undated deliverables nudge */}
      {undatedCount > 0 && (
        <div
          onClick={() => onNavigate?.("calendar")}
          style={{
            marginTop: 8, padding: "12px 16px", borderRadius: 8,
            background: C.surface, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: onNavigate ? "pointer" : "default",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <span style={{ color: C.textMuted, fontSize: 12 }}>
            <strong style={{ color: C.gold }}>{undatedCount}</strong> {undatedCount === 1 ? "action has" : "actions have"} no due date
          </span>
          <span style={{ color: C.gold, fontSize: 11, fontFamily: mono }}>CALENDAR →</span>
        </div>
      )}
    </div>
  );
}
