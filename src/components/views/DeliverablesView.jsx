import { C, CATEGORIES, getCat, mono, sans } from "../../lib/constants";
import Highlight from "../Highlight";

const formatDuration = (mins) => {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export default function DeliverablesView({
  deliverables,
  pending,
  justDone,
  actionsView,
  newTaskText,
  newTaskDue,
  newTaskDuration,
  taskAdding,
  searchHighlight,
  scrollToId,
  onSetActionsView,
  onSetNewTaskText,
  onSetNewTaskDue,
  onSetNewTaskDuration,
  onAddTask,
  onToggleDeliverable,
  onDeleteTask,
  onNavigate,
}) {
  const completed = deliverables.filter(d => d.is_complete);
  const pct = deliverables.length ? Math.round((completed.length / deliverables.length) * 100) : 0;
  const invitations = pending.filter(d => d.type !== "task");
  const tasks = pending.filter(d => d.type === "task");
  const byCategory = CATEGORIES.map(cat => ({ ...cat, items: invitations.filter(d => d.idea?.category === cat.id) })).filter(cat => cat.items.length > 0);
  const next5 = pending.slice(0, 5);
  const formatDue = (d) => {
    const date = new Date(d);
    const diff = Math.ceil((date.getTime() - Date.now()) / 864e5);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: C.red };
    if (diff === 0) return { text: "today", color: C.gold };
    if (diff === 1) return { text: "tomorrow", color: C.gold };
    return { text: `in ${diff}d`, color: C.textMuted };
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      <div style={{ maxWidth: 700 }}>
        {/* Add task form */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, marginBottom: 24 }}>
          <input value={newTaskText} onChange={e => onSetNewTaskText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newTaskText.trim()) onAddTask(); }}
            placeholder="Add a task..."
            style={{ width: "100%", background: "transparent", border: "none", color: C.textPrimary, fontSize: 12, outline: "none", marginBottom: 12, fontFamily: sans }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input value={newTaskDue} onChange={e => onSetNewTaskDue(e.target.value)} type="date"
              style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textPrimary, fontSize: 12, padding: "8px 12px", outline: "none", fontFamily: mono }} />
            <select value={newTaskDuration} onChange={e => onSetNewTaskDuration(e.target.value)}
              style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: newTaskDuration ? C.textPrimary : C.textMuted, fontSize: 12, padding: "8px 10px", outline: "none", fontFamily: mono }}>
              <option value="">Duration</option>
              <option value="30">30m</option>
              <option value="60">1h</option>
              <option value="90">1.5h</option>
              <option value="120">2h</option>
              <option value="180">3h</option>
              <option value="240">4h</option>
            </select>
            <button onClick={onAddTask} disabled={!newTaskText.trim() || taskAdding}
              style={{ background: newTaskText.trim() ? C.gold : C.surfaceHigh, color: newTaskText.trim() ? C.bg : C.textMuted, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: newTaskText.trim() ? "pointer" : "default", fontFamily: sans }}>
              {taskAdding ? "..." : "Add"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>{pending.length} open · {completed.length} complete</span>
            <span style={{ fontSize: 12, color: C.gold, fontFamily: mono }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{ height: "100%", background: C.gold, width: `${pct}%`, borderRadius: 2, transition: "width 0.4s" }} />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[{ id: "focus", label: "Next Up" }, { id: "tasks", label: `Tasks (${tasks.length})` }, { id: "workshops", label: "Workshops" }, { id: "all", label: "All Open" }].map(t => (
            <button key={t.id} onClick={() => onSetActionsView(t.id)}
              style={{ background: actionsView === t.id ? C.gold + "20" : "transparent", border: `1px solid ${actionsView === t.id ? C.gold + "60" : C.border}`, color: actionsView === t.id ? C.gold : C.textMuted, padding: "5px 12px", fontSize: 12, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
              {t.label}
            </button>
          ))}
        </div>

        {actionsView === "focus" && (
          <div>
            <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 12 }}>YOUR NEXT 5 ACTIONS</div>
            {next5.length === 0 && justDone.size === 0
              ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>All caught up.</div>
              : (() => {
                  const flashItems = deliverables.filter(d => justDone.has(d.id));
                  const visible = [...flashItems, ...next5.filter(d => !justDone.has(d.id))];
                  return visible.map(d => {
                    const done = justDone.has(d.id);
                    const cat = getCat(d.idea?.category);
                    const due = d.due_date ? formatDue(d.due_date) : null;
                    return (
                      <div key={d.id} id={`del-${d.id}`}
                        style={{ padding: "14px 16px", marginBottom: 8, background: done ? C.green + "12" : C.surface, border: `1px solid ${done ? C.green + "60" : C.border}`, borderRadius: 8, borderLeft: `3px solid ${done ? C.green : cat.color}`, cursor: done ? "default" : "pointer", transition: "all 0.3s", opacity: done ? 0.7 : 1 }}
                        onClick={() => !done && onToggleDeliverable(d.id, d.is_complete)}
                        onMouseEnter={e => { if (!done) e.currentTarget.style.borderColor = cat.color; }}
                        onMouseLeave={e => { if (!done) e.currentTarget.style.borderColor = C.border; }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          {done && <span style={{ color: C.green, fontSize: 14 }}>✓</span>}
                          <div style={{ fontSize: 12, color: done ? C.textMuted : C.textPrimary, lineHeight: 1.6, textDecoration: done ? "line-through" : "none", flex: 1 }}><Highlight text={d.text} term={searchHighlight} /></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: done ? C.textMuted : cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                          {due && <span style={{ fontSize: 12, color: due.color, fontFamily: mono }}>· due {due.text}</span>}
                          {d.idea?.text && <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>· {d.idea.text.slice(0, 40)}...</span>}
                        </div>
                      </div>
                    );
                  });
                })()
            }
          </div>
        )}

        {actionsView === "tasks" && (
          <div>
            {tasks.length === 0
              ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>No tasks. Add one above.</div>
              : tasks.map(t => {
                  const due = t.due_date ? formatDue(t.due_date) : null;
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, cursor: "pointer" }}>
                      <div onClick={() => onToggleDeliverable(t.id, t.is_complete)}
                        style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.border}`, marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }} onClick={() => onToggleDeliverable(t.id, t.is_complete)}>
                        <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>{t.text}</div>
                        {due && <div style={{ fontSize: 12, color: due.color, marginTop: 6, fontFamily: mono }}>Due {due.text}</div>}
                      </div>
                      <div onClick={() => onDeleteTask(t.id)} style={{ fontSize: 12, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}
                        onMouseEnter={e => e.currentTarget.style.color = C.red}
                        onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}>✕</div>
                    </div>
                  );
                })
            }
            {deliverables.filter(d => d.type === "task" && d.is_complete).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 500, marginBottom: 14 }}>DONE ({deliverables.filter(d => d.type === "task" && d.is_complete).length})</div>
                {deliverables.filter(d => d.type === "task" && d.is_complete).slice(0, 10).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, opacity: 0.4, cursor: "pointer" }}>
                    <div onClick={() => onToggleDeliverable(t.id, t.is_complete)}
                      style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.green}`, background: C.green + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.green, flexShrink: 0 }}>✓</div>
                    <div style={{ flex: 1, fontSize: 12, color: C.textDisabled, textDecoration: "line-through" }} onClick={() => onToggleDeliverable(t.id, t.is_complete)}>{t.text}</div>
                    <div onClick={() => onDeleteTask(t.id)} style={{ fontSize: 12, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}>✕</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {actionsView === "workshops" && (
          <div>
            {byCategory.map(cat => (
              <div key={cat.id} style={{ marginBottom: 28, padding: "16px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, borderTop: `3px solid ${cat.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label.toUpperCase()} WORKSHOP</span>
                  <span
                    onClick={() => onNavigate("library", null, cat.id)}
                    style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, cursor: "pointer", transition: "color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.color = cat.color}
                    onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                  >
                    {cat.items.length} tasks
                  </span>
                </div>
                {cat.items.slice(0, 5).map(d => (
                  <div key={d.id} id={`del-${d.id}`}
                    onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}><Highlight text={d.text} term={searchHighlight} /></div>
                  </div>
                ))}
                {cat.items.length > 5 && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, marginTop: 8 }}>+{cat.items.length - 5} more</div>}
              </div>
            ))}
          </div>
        )}

        {actionsView === "all" && (
          pending.length === 0
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>All actions complete.</div>
            : <>
                {byCategory.map(cat => (
                  <div key={cat.id} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 12, color: cat.color, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 10 }}>{cat.icon} {cat.label.toUpperCase()}</div>
                    {cat.items.map(d => (
                      <div key={d.id} id={`del-${d.id}`}
                        onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                        style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", background: scrollToId === d.id ? C.surfaceHigh : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                        onMouseLeave={e => scrollToId !== d.id && (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}><Highlight text={d.text} term={searchHighlight} /></div>
                          {d.due_date && <div style={{ fontSize: 12, color: formatDue(d.due_date).color, fontFamily: mono, marginTop: 2 }}>due {formatDue(d.due_date).text}</div>}
                          {d.duration_minutes && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, marginTop: 2 }}>{formatDuration(d.duration_minutes)}</div>}
                          {d.idea?.text && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, marginTop: 4 }}>from: {d.idea.text.slice(0, 60)}...</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {tasks.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 10 }}>✓ TASKS</div>
                    {tasks.map(d => (
                      <div key={d.id}
                        onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                        style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>{d.text}</div>
                          {d.due_date && <div style={{ fontSize: 12, color: formatDue(d.due_date).color, fontFamily: mono, marginTop: 2 }}>due {formatDue(d.due_date).text}</div>}
                          {d.duration_minutes && <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, marginTop: 2 }}>{formatDuration(d.duration_minutes)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
        )}
      </div>
    </div>
  );
}
