import { useState } from "react";
import { C, mono, sans } from "../../lib/constants";

export default function TasksView({ deliverables, onAddTask, onDeleteTask, onToggleDeliverable }) {
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [taskAdding, setTaskAdding] = useState(false);

  const tasks = deliverables.filter(d => d.type === "task");
  const openTasks = tasks.filter(d => !d.is_complete);
  const doneTasks = tasks.filter(d => d.is_complete);

  const formatDue = (d) => {
    const date = new Date(d);
    const diff = Math.ceil((date.getTime() - Date.now()) / 864e5);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: C.red };
    if (diff === 0) return { text: "today", color: C.gold };
    if (diff === 1) return { text: "tomorrow", color: C.gold };
    return { text: `in ${diff}d`, color: C.textMuted };
  };

  const handleAdd = async () => {
    const text = newTaskText.trim();
    if (!text || taskAdding) return;
    setTaskAdding(true);
    await onAddTask(text, newTaskDue);
    setNewTaskText("");
    setNewTaskDue("");
    setTaskAdding(false);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      <div style={{ maxWidth: 700 }}>
        <div style={{ fontSize: 16, color: C.textPrimary, fontWeight: 500, marginBottom: 8 }}>Tasks</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 28 }}>Simple to-dos. No AI analysis.</div>

        {/* Add task form */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, marginBottom: 32 }}>
          <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newTaskText.trim()) handleAdd(); }}
            placeholder="What needs to get done?"
            style={{ width: "100%", background: "transparent", border: "none", color: C.textPrimary, fontSize: 11, outline: "none", marginBottom: 12, fontFamily: sans }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
              placeholder="Due date (YYYY-MM-DD)"
              style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textPrimary, fontSize: 11, padding: "8px 12px", outline: "none", fontFamily: mono }} />
            <button onClick={handleAdd} disabled={!newTaskText.trim() || taskAdding}
              style={{ background: newTaskText.trim() ? C.gold : C.surfaceHigh, color: newTaskText.trim() ? C.bg : C.textMuted, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 11, fontWeight: 600, cursor: newTaskText.trim() ? "pointer" : "default", fontFamily: sans }}>
              {taskAdding ? "..." : "Add"}
            </button>
          </div>
        </div>

        {/* Open tasks */}
        {openTasks.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 500, marginBottom: 14 }}>OPEN ({openTasks.length})</div>
            {openTasks.map(t => {
              const due = t.due_date ? formatDue(t.due_date) : null;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, cursor: "pointer" }}>
                  <div onClick={() => onToggleDeliverable(t.id, t.is_complete)}
                    style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.border}`, marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }} onClick={() => onToggleDeliverable(t.id, t.is_complete)}>
                    <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>{t.text}</div>
                    {due && <div style={{ fontSize: 11, color: due.color, marginTop: 6, fontFamily: mono }}>Due {due.text}</div>}
                  </div>
                  <div onClick={() => onDeleteTask(t.id)} style={{ fontSize: 11, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}
                    onMouseEnter={e => e.currentTarget.style.color = C.red}
                    onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}>✕</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done tasks */}
        {doneTasks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 500, marginBottom: 14 }}>DONE ({doneTasks.length})</div>
            {doneTasks.slice(0, 15).map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, opacity: 0.4, cursor: "pointer" }}>
                <div onClick={() => onToggleDeliverable(t.id, t.is_complete)}
                  style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.green}`, background: C.green + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.green, flexShrink: 0 }}>✓</div>
                <div style={{ flex: 1, fontSize: 11, color: C.textDisabled, textDecoration: "line-through" }} onClick={() => onToggleDeliverable(t.id, t.is_complete)}>{t.text}</div>
                <div onClick={() => onDeleteTask(t.id)} style={{ fontSize: 11, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}>✕</div>
              </div>
            ))}
          </div>
        )}

        {tasks.length === 0 && (
          <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 11, textAlign: "center", padding: "40px 0" }}>No tasks yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
