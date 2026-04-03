import { useState, useRef, useEffect, useMemo } from "react";
import { C, mono, sans, CATEGORIES } from "../../lib/constants";

const DAY_MS = 86400000;

// Smart list definitions
const SMART_LISTS = [
  { id: "session",  label: "Today's Session", icon: "☀", color: C.gold },
  { id: "starred",  label: "Starred",         icon: "★", color: C.gold },
  { id: "planned",  label: "Planned",         icon: "▦", color: C.blue },
  { id: "all",      label: "All Tasks",       icon: "▤", color: C.textSecondary },
];

const DUE_PRESETS = [
  { label: "Today",     value: () => new Date().toISOString().split("T")[0] },
  { label: "Tomorrow",  value: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; } },
  { label: "Next Week", value: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; } },
];

function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / DAY_MS);
  if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, color: C.red };
  if (diff === -1) return { text: "yesterday", color: C.red };
  if (diff === 0) return { text: "Today", color: C.gold };
  if (diff === 1) return { text: "Tomorrow", color: C.gold };
  if (diff <= 7) return { text: date.toLocaleDateString([], { weekday: "short" }), color: C.textMuted };
  return { text: date.toLocaleDateString([], { month: "short", day: "numeric" }), color: C.textMuted };
}

function groupByDueDate(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDate: [] };

  tasks.forEach(t => {
    if (!t.due_date) { groups.noDate.push(t); return; }
    const due = new Date(t.due_date);
    const diff = Math.ceil((due.getTime() - today.getTime()) / DAY_MS);
    if (diff < 0) groups.overdue.push(t);
    else if (diff === 0) groups.today.push(t);
    else if (diff === 1) groups.tomorrow.push(t);
    else if (diff <= 7) groups.thisWeek.push(t);
    else groups.later.push(t);
  });
  return groups;
}

// ─── Step Item ───
function StepItem({ step, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(step.text);
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}>
      <div onClick={() => onToggle(step.id)}
        style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: "pointer",
          border: `1.5px solid ${step.done ? C.green : C.border}`,
          background: step.done ? C.green + "25" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        {step.done && <span style={{ fontSize: 9, color: C.green }}>✓</span>}
      </div>
      {editing ? (
        <input ref={inputRef} value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => { setEditing(false); if (text.trim() && text !== step.text) onEdit(step.id, text.trim()); }}
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setText(step.text); setEditing(false); } }}
          style={{ flex: 1, background: "transparent", border: "none", color: C.textPrimary, fontSize: 12, outline: "none", fontFamily: sans, padding: 0 }} />
      ) : (
        <span onClick={() => setEditing(true)}
          style={{ flex: 1, fontSize: 12, color: step.done ? C.textDisabled : C.textSecondary, textDecoration: step.done ? "line-through" : "none", cursor: "text", lineHeight: 1.4 }}>
          {step.text}
        </span>
      )}
      <span onClick={() => onDelete(step.id)}
        style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer", padding: "2px 4px", opacity: 0.5 }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>✕</span>
    </div>
  );
}

// ─── Detail Panel ───
function DetailPanel({ task, onClose, onUpdate, onToggle, onDelete, onAddToSession, onRemoveFromSession }) {
  const [newStep, setNewStep] = useState("");
  const [notes, setNotes] = useState(task?.notes || "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const notesTimer = useRef(null);
  const isInSession = task?.session_date === new Date().toISOString().split("T")[0];

  useEffect(() => { setNotes(task?.notes || ""); }, [task?.id, task?.notes]);

  if (!task) return null;

  const steps = task.steps || [];
  const doneSteps = steps.filter(s => s.done).length;
  const due = formatRelativeDate(task.due_date);

  const handleNotesChange = (val) => {
    setNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => onUpdate(task.id, { notes: val }), 800);
  };

  const addStep = () => {
    const text = newStep.trim();
    if (!text) return;
    const step = { id: crypto.randomUUID(), text, done: false };
    onUpdate(task.id, { steps: [...steps, step] });
    setNewStep("");
  };

  const toggleStep = (stepId) => {
    onUpdate(task.id, { steps: steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s) });
  };

  const deleteStep = (stepId) => {
    onUpdate(task.id, { steps: steps.filter(s => s.id !== stepId) });
  };

  const editStep = (stepId, text) => {
    onUpdate(task.id, { steps: steps.map(s => s.id === stepId ? { ...s, text } : s) });
  };

  const setDueDate = (dateStr) => {
    onUpdate(task.id, { due_date: dateStr || null });
    setShowDatePicker(false);
    setCustomDate("");
  };

  return (
    <div style={{
      width: 320, background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => onToggle(task.id, task.is_complete)}
          style={{
            width: 20, height: 20, borderRadius: 4, cursor: "pointer", flexShrink: 0,
            border: `2px solid ${task.is_complete ? C.green : C.border}`,
            background: task.is_complete ? C.green + "25" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {task.is_complete && <span style={{ fontSize: 12, color: C.green }}>✓</span>}
        </div>
        <div style={{ flex: 1, fontSize: 14, color: C.textPrimary, fontWeight: 500, lineHeight: 1.4,
          textDecoration: task.is_complete ? "line-through" : "none",
          opacity: task.is_complete ? 0.5 : 1,
        }}>{task.text}</div>
        <span onClick={() => onUpdate(task.id, { is_starred: !task.is_starred })}
          style={{ fontSize: 18, color: task.is_starred ? C.gold : C.textDisabled, cursor: "pointer", flexShrink: 0 }}>
          {task.is_starred ? "★" : "☆"}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>

        {/* Steps */}
        <div style={{ padding: "16px 0 12px", borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>
            STEPS {steps.length > 0 && <span style={{ color: C.textDisabled }}>({doneSteps}/{steps.length})</span>}
          </div>
          {steps.map(s => (
            <StepItem key={s.id} step={s} onToggle={toggleStep} onDelete={deleteStep} onEdit={editStep} />
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ color: C.textDisabled, fontSize: 12 }}>+</span>
            <input value={newStep} onChange={e => setNewStep(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addStep(); }}
              placeholder="Add a step"
              style={{ flex: 1, background: "transparent", border: "none", color: C.textPrimary, fontSize: 12, outline: "none", fontFamily: sans, padding: "6px 0" }} />
          </div>
        </div>

        {/* Session toggle */}
        <div onClick={() => isInSession ? onRemoveFromSession(task.id) : onAddToSession(task.id)}
          style={{
            padding: "12px 0", borderBottom: `1px solid ${C.border}22`, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ fontSize: 14, color: isInSession ? C.gold : C.textMuted }}>☀</span>
          <span style={{ fontSize: 12, color: isInSession ? C.gold : C.textSecondary }}>
            {isInSession ? "Remove from Today's Session" : "Add to Today's Session"}
          </span>
        </div>

        {/* Due date */}
        <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => setShowDatePicker(!showDatePicker)}>
            <span style={{ fontSize: 14, color: due ? due.color : C.textMuted }}>◷</span>
            <span style={{ fontSize: 12, color: due ? due.color : C.textSecondary }}>
              {due ? `Due ${due.text}` : "Add due date"}
            </span>
            {task.due_date && (
              <span onClick={e => { e.stopPropagation(); setDueDate(null); }}
                style={{ marginLeft: "auto", fontSize: 10, color: C.textDisabled, cursor: "pointer" }}>✕</span>
            )}
          </div>
          {showDatePicker && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {DUE_PRESETS.map(p => (
                <div key={p.label} onClick={() => setDueDate(p.value())}
                  style={{ padding: "6px 10px", borderRadius: 4, fontSize: 12, color: C.textSecondary, cursor: "pointer", background: C.surfaceHigh }}
                  onMouseEnter={e => e.currentTarget.style.background = C.border}
                  onMouseLeave={e => e.currentTarget.style.background = C.surfaceHigh}>
                  {p.label}
                </div>
              ))}
              <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); if (e.target.value) setDueDate(e.target.value); }}
                style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textPrimary, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: mono, marginTop: 2 }} />
            </div>
          )}
        </div>

        {/* List / Category */}
        <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>LIST</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span onClick={() => onUpdate(task.id, { list_name: null })}
              style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                background: !task.list_name ? C.gold + "22" : C.surfaceHigh,
                color: !task.list_name ? C.gold : C.textMuted,
                border: `1px solid ${!task.list_name ? C.gold + "44" : C.border}`,
              }}>Inbox</span>
            {CATEGORIES.map(cat => (
              <span key={cat.id} onClick={() => onUpdate(task.id, { list_name: cat.id })}
                style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                  background: task.list_name === cat.id ? cat.color + "22" : C.surfaceHigh,
                  color: task.list_name === cat.id ? cat.color : C.textMuted,
                  border: `1px solid ${task.list_name === cat.id ? cat.color + "44" : C.border}`,
                }}>{cat.icon} {cat.label}</span>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ padding: "12px 0 16px" }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>NOTES</div>
          <textarea value={notes} onChange={e => handleNotesChange(e.target.value)}
            placeholder="Add a note..."
            style={{
              width: "100%", minHeight: 80, background: C.surfaceHigh, border: `1px solid ${C.border}`,
              borderRadius: 6, color: C.textPrimary, fontSize: 12, padding: "10px 12px",
              outline: "none", fontFamily: sans, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
            }} />
        </div>

        {/* Meta */}
        <div style={{ padding: "8px 0 16px", fontSize: 11, color: C.textDisabled }}>
          Created {new Date(task.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          {task.completed_at && <span> · Completed {new Date(task.completed_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span onClick={onClose} style={{ fontSize: 12, color: C.textMuted, cursor: "pointer" }}>Close</span>
        <span onClick={() => { if (confirm("Delete this task?")) onDelete(task.id); }}
          style={{ fontSize: 12, color: C.textDisabled, cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.color = C.red}
          onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}>Delete</span>
      </div>
    </div>
  );
}

// ─── Suggestion Panel (My Day lightbulb equivalent) ───
function SuggestionPanel({ tasks, sessionIds, onAdd, onClose }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const suggestions = useMemo(() => {
    const items = [];
    // Tasks due today
    tasks.filter(t => !t.is_complete && t.due_date === todayStr && !sessionIds.has(t.id))
      .forEach(t => items.push({ ...t, reason: "Due today" }));
    // Overdue tasks
    tasks.filter(t => !t.is_complete && t.due_date && t.due_date < todayStr && !sessionIds.has(t.id))
      .forEach(t => items.push({ ...t, reason: "Overdue" }));
    // Starred tasks not in session
    tasks.filter(t => !t.is_complete && t.is_starred && !sessionIds.has(t.id) && !items.find(i => i.id === t.id))
      .forEach(t => items.push({ ...t, reason: "Starred" }));
    // Yesterday's session tasks not completed
    const yesterdayStr = new Date(Date.now() - DAY_MS).toISOString().split("T")[0];
    tasks.filter(t => !t.is_complete && t.session_date === yesterdayStr && !sessionIds.has(t.id) && !items.find(i => i.id === t.id))
      .forEach(t => items.push({ ...t, reason: "From yesterday" }));
    // Recently created (last 3 days) not in session
    const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS).toISOString().split("T")[0];
    tasks.filter(t => !t.is_complete && t.created_at >= threeDaysAgo && !sessionIds.has(t.id) && !items.find(i => i.id === t.id))
      .slice(0, 5)
      .forEach(t => items.push({ ...t, reason: "Recently added" }));
    return items;
  }, [tasks, sessionIds, todayStr]);

  if (suggestions.length === 0) return (
    <div style={{ padding: "20px 18px", background: C.surface, borderRadius: 8, marginBottom: 16, border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Suggestions</span>
        <span onClick={onClose} style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer" }}>✕</span>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>All caught up. Nothing to suggest.</div>
    </div>
  );

  return (
    <div style={{ padding: "14px 18px", background: C.surface, borderRadius: 8, marginBottom: 16, border: `1px solid ${C.gold}33` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Suggestions</span>
        <span onClick={onClose} style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer" }}>✕</span>
      </div>
      {suggestions.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>{t.text}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{t.reason}</div>
          </div>
          <span onClick={() => onAdd(t.id)}
            style={{ fontSize: 11, color: C.gold, cursor: "pointer", padding: "4px 10px", borderRadius: 4, border: `1px solid ${C.gold}44`, flexShrink: 0, fontFamily: mono }}
            onMouseEnter={e => e.currentTarget.style.background = C.gold + "15"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            + Add
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Task Row ───
function TaskRow({ task, isSelected, onClick, onToggle, onStar }) {
  const due = formatRelativeDate(task.due_date);
  const steps = task.steps || [];
  const doneSteps = steps.filter(s => s.done).length;
  const cat = task.list_name ? CATEGORIES.find(c => c.id === task.list_name) : null;

  return (
    <div onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 16px", borderRadius: 8, cursor: "pointer",
        background: isSelected ? C.surfaceHigh : C.surface,
        border: `1px solid ${isSelected ? C.gold + "44" : C.border}`,
        marginBottom: 4, transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.surfaceHigh; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = C.surface; }}>
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggle(task.id, task.is_complete); }}
        style={{
          width: 18, height: 18, borderRadius: 4, marginTop: 1, flexShrink: 0,
          border: `2px solid ${task.is_complete ? C.green : C.border}`,
          background: task.is_complete ? C.green + "25" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.15s",
        }}>
        {task.is_complete && <span style={{ fontSize: 11, color: C.green }}>✓</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: task.is_complete ? C.textDisabled : C.textPrimary,
          textDecoration: task.is_complete ? "line-through" : "none",
          lineHeight: 1.4, opacity: task.is_complete ? 0.5 : 1,
        }}>{task.text}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          {cat && <span style={{ fontSize: 10, color: cat.color }}>{cat.icon} {cat.label}</span>}
          {steps.length > 0 && (
            <span style={{ fontSize: 10, color: doneSteps === steps.length ? C.green : C.textMuted }}>
              {doneSteps}/{steps.length} steps
            </span>
          )}
          {due && <span style={{ fontSize: 10, color: due.color, fontFamily: mono }}>{due.text}</span>}
          {task.duration_minutes && (
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {task.duration_minutes < 60 ? `${task.duration_minutes}m` : `${Math.floor(task.duration_minutes / 60)}h`}
            </span>
          )}
        </div>
      </div>

      {/* Star */}
      <span onClick={e => { e.stopPropagation(); onStar(task.id, !task.is_starred); }}
        style={{ fontSize: 16, color: task.is_starred ? C.gold : C.textDisabled + "66", cursor: "pointer", flexShrink: 0, marginTop: 1, transition: "color 0.12s" }}
        onMouseEnter={e => { if (!task.is_starred) e.currentTarget.style.color = C.gold + "88"; }}
        onMouseLeave={e => { if (!task.is_starred) e.currentTarget.style.color = C.textDisabled + "66"; }}>
        {task.is_starred ? "★" : "☆"}
      </span>
    </div>
  );
}

// ─── Grouped Date Section ───
function DateGroup({ label, color, tasks, selectedId, onSelect, onToggle, onStar }) {
  if (tasks.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color, fontFamily: mono, letterSpacing: "0.12em", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>
        {label} <span style={{ color: C.textDisabled }}>({tasks.length})</span>
      </div>
      {tasks.map(t => (
        <TaskRow key={t.id} task={t} isSelected={selectedId === t.id} onClick={() => onSelect(t)} onToggle={onToggle} onStar={onStar} />
      ))}
    </div>
  );
}

// ─── Main TasksView ───
export default function TasksView({
  deliverables, onAddTask, onDeleteTask, onToggleDeliverable, onUpdateTask, onAddToSession, onRemoveFromSession, onStarTask,
}) {
  const [activeList, setActiveList] = useState("session");
  const [selectedTask, setSelectedTask] = useState(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [taskAdding, setTaskAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showQuickDue, setShowQuickDue] = useState(false);
  const inputRef = useRef(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // All tasks (type === "task")
  const allTasks = useMemo(() => deliverables.filter(d => d.type === "task"), [deliverables]);
  const openTasks = useMemo(() => allTasks.filter(t => !t.is_complete), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter(t => t.is_complete), [allTasks]);

  // Session tasks — tasks flagged for today
  const sessionIds = useMemo(() => new Set(openTasks.filter(t => t.session_date === todayStr).map(t => t.id)), [openTasks, todayStr]);

  // Custom lists (categories that have tasks)
  const customLists = useMemo(() => {
    const used = new Set(allTasks.filter(t => t.list_name).map(t => t.list_name));
    return CATEGORIES.filter(c => used.has(c.id));
  }, [allTasks]);

  // Filter tasks based on active list
  const filteredTasks = useMemo(() => {
    let tasks;
    switch (activeList) {
      case "session":
        tasks = openTasks.filter(t => sessionIds.has(t.id));
        break;
      case "starred":
        tasks = openTasks.filter(t => t.is_starred);
        break;
      case "planned":
        tasks = openTasks.filter(t => t.due_date);
        break;
      case "all":
        tasks = openTasks;
        break;
      default:
        // Category list
        tasks = openTasks.filter(t => t.list_name === activeList);
    }
    return tasks;
  }, [activeList, openTasks, sessionIds]);

  // Keep selected task fresh
  useEffect(() => {
    if (selectedTask) {
      const fresh = deliverables.find(d => d.id === selectedTask.id);
      if (fresh) setSelectedTask(fresh);
      else setSelectedTask(null);
    }
  }, [deliverables]);

  const handleAdd = async () => {
    const text = newTaskText.trim();
    if (!text || taskAdding) return;
    setTaskAdding(true);
    const extra = {};
    if (newTaskDue) extra.due_date = newTaskDue;
    // Auto-add to session when creating from session view
    if (activeList === "session") extra.session_date = todayStr;
    await onAddTask(text, newTaskDue, extra);
    setNewTaskText("");
    setNewTaskDue("");
    setShowQuickDue(false);
    setTaskAdding(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const activeListMeta = SMART_LISTS.find(l => l.id === activeList)
    || (() => { const cat = CATEGORIES.find(c => c.id === activeList); return cat ? { ...cat, icon: cat.icon } : SMART_LISTS[3]; })();

  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* ─── Left: List Sidebar ─── */}
      <div style={{ width: 200, background: C.bg, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "20px 14px 8px" }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 10 }}>SMART LISTS</div>
          {SMART_LISTS.map(list => {
            let count = 0;
            if (list.id === "session") count = sessionIds.size;
            else if (list.id === "starred") count = openTasks.filter(t => t.is_starred).length;
            else if (list.id === "planned") count = openTasks.filter(t => t.due_date).length;
            else if (list.id === "all") count = openTasks.length;
            return (
              <div key={list.id} onClick={() => setActiveList(list.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: 6, cursor: "pointer", marginBottom: 2,
                  background: activeList === list.id ? list.color + "15" : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (activeList !== list.id) e.currentTarget.style.background = C.surfaceHigh; }}
                onMouseLeave={e => { if (activeList !== list.id) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 13, color: activeList === list.id ? list.color : C.textMuted, width: 18, textAlign: "center" }}>{list.icon}</span>
                <span style={{ fontSize: 12, color: activeList === list.id ? list.color : C.textSecondary, flex: 1 }}>{list.label}</span>
                {count > 0 && <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{count}</span>}
              </div>
            );
          })}
        </div>

        {/* Category lists */}
        {customLists.length > 0 && (
          <div style={{ padding: "12px 14px 8px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 600, marginBottom: 10 }}>CATEGORIES</div>
            {customLists.map(cat => {
              const count = openTasks.filter(t => t.list_name === cat.id).length;
              return (
                <div key={cat.id} onClick={() => setActiveList(cat.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderRadius: 6, cursor: "pointer", marginBottom: 2,
                    background: activeList === cat.id ? cat.color + "15" : "transparent",
                  }}
                  onMouseEnter={e => { if (activeList !== cat.id) e.currentTarget.style.background = C.surfaceHigh; }}
                  onMouseLeave={e => { if (activeList !== cat.id) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 12, color: activeList === cat.id ? cat.color : C.textMuted }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, color: activeList === cat.id ? cat.color : C.textSecondary, flex: 1 }}>{cat.label}</span>
                  {count > 0 && <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{count}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats footer */}
        <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textDisabled, lineHeight: 1.6 }}>
            {openTasks.length} open · {completedTasks.length} done
          </div>
        </div>
      </div>

      {/* ─── Center: Task List ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* List header */}
        <div style={{ padding: "24px 28px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, color: activeListMeta.color }}>{activeListMeta.icon}</span>
            <span style={{ fontSize: 18, color: C.textPrimary, fontWeight: 600 }}>{activeListMeta.label}</span>
            {activeList === "session" && (
              <span onClick={() => setShowSuggestions(!showSuggestions)}
                style={{ marginLeft: "auto", fontSize: 16, cursor: "pointer", color: showSuggestions ? C.gold : C.textMuted, transition: "color 0.12s" }}
                title="Suggestions">
                💡
              </span>
            )}
          </div>
          {activeList === "session" && (
            <div style={{ fontSize: 12, color: C.textMuted, marginLeft: 28 }}>{todayLabel}</div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px" }}>
          {/* Suggestions panel (session view only) */}
          {activeList === "session" && showSuggestions && (
            <SuggestionPanel
              tasks={allTasks}
              sessionIds={sessionIds}
              onAdd={(id) => onAddToSession(id)}
              onClose={() => setShowSuggestions(false)}
            />
          )}

          {/* Quick add */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "12px 16px", marginBottom: 20, transition: "border-color 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.textDisabled, fontSize: 14 }}>+</span>
              <input ref={inputRef} value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newTaskText.trim()) handleAdd(); }}
                placeholder="Add a task"
                style={{
                  flex: 1, background: "transparent", border: "none",
                  color: C.textPrimary, fontSize: 13, outline: "none", fontFamily: sans,
                }} />
            </div>
            {newTaskText.trim() && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, marginLeft: 24, alignItems: "center" }}>
                {/* Quick due date buttons */}
                {!showQuickDue ? (
                  <span onClick={() => setShowQuickDue(true)}
                    style={{ fontSize: 11, color: C.textMuted, cursor: "pointer", padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    ◷ {newTaskDue || "Due date"}
                  </span>
                ) : (
                  <>
                    {DUE_PRESETS.map(p => (
                      <span key={p.label}
                        onClick={() => { setNewTaskDue(p.value()); setShowQuickDue(false); }}
                        style={{ fontSize: 11, color: C.textSecondary, cursor: "pointer", padding: "4px 8px", borderRadius: 4, background: C.surfaceHigh }}
                        onMouseEnter={e => e.currentTarget.style.background = C.border}
                        onMouseLeave={e => e.currentTarget.style.background = C.surfaceHigh}>
                        {p.label}
                      </span>
                    ))}
                    <input type="date" value={newTaskDue}
                      onChange={e => { setNewTaskDue(e.target.value); setShowQuickDue(false); }}
                      style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textPrimary, padding: "3px 8px", fontSize: 11, outline: "none", fontFamily: mono }} />
                  </>
                )}
                {newTaskDue && (
                  <span onClick={() => setNewTaskDue("")}
                    style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer" }}>✕</span>
                )}
                <button onClick={handleAdd} disabled={taskAdding}
                  style={{
                    marginLeft: "auto", background: C.gold, color: C.bg,
                    border: "none", borderRadius: 4, padding: "5px 14px",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans,
                  }}>
                  {taskAdding ? "..." : "Add"}
                </button>
              </div>
            )}
          </div>

          {/* Task list */}
          {activeList === "planned" ? (
            // Grouped by date for Planned view
            (() => {
              const groups = groupByDueDate(filteredTasks);
              return (
                <>
                  <DateGroup label="Overdue" color={C.red} tasks={groups.overdue} selectedId={selectedTask?.id} onSelect={setSelectedTask} onToggle={onToggleDeliverable} onStar={(id, v) => onStarTask(id, v)} />
                  <DateGroup label="Today" color={C.gold} tasks={groups.today} selectedId={selectedTask?.id} onSelect={setSelectedTask} onToggle={onToggleDeliverable} onStar={(id, v) => onStarTask(id, v)} />
                  <DateGroup label="Tomorrow" color={C.gold} tasks={groups.tomorrow} selectedId={selectedTask?.id} onSelect={setSelectedTask} onToggle={onToggleDeliverable} onStar={(id, v) => onStarTask(id, v)} />
                  <DateGroup label="This Week" color={C.blue} tasks={groups.thisWeek} selectedId={selectedTask?.id} onSelect={setSelectedTask} onToggle={onToggleDeliverable} onStar={(id, v) => onStarTask(id, v)} />
                  <DateGroup label="Later" color={C.textMuted} tasks={groups.later} selectedId={selectedTask?.id} onSelect={setSelectedTask} onToggle={onToggleDeliverable} onStar={(id, v) => onStarTask(id, v)} />
                </>
              );
            })()
          ) : (
            <>
              {filteredTasks.map(t => (
                <TaskRow key={t.id} task={t} isSelected={selectedTask?.id === t.id}
                  onClick={() => setSelectedTask(t)} onToggle={onToggleDeliverable}
                  onStar={(id, v) => onStarTask(id, v)} />
              ))}
            </>
          )}

          {/* Empty states */}
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              {activeList === "session" ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>☀</div>
                  <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 6 }}>Plan your creative session</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    What will you focus on today? Add tasks or tap 💡 for suggestions.
                  </div>
                </>
              ) : activeList === "starred" ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>☆</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Star tasks to mark them as important</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>No tasks here yet.</div>
              )}
            </div>
          )}

          {/* Completed section (collapsible) */}
          {completedTasks.length > 0 && activeList === "all" && (
            <div style={{ marginTop: 20 }}>
              <div onClick={() => setShowCompleted(!showCompleted)}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 0", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.textDisabled, transition: "transform 0.15s", transform: showCompleted ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase" }}>
                  Completed ({completedTasks.length})
                </span>
              </div>
              {showCompleted && completedTasks.slice(0, 25).map(t => (
                <TaskRow key={t.id} task={t} isSelected={selectedTask?.id === t.id}
                  onClick={() => setSelectedTask(t)} onToggle={onToggleDeliverable}
                  onStar={(id, v) => onStarTask(id, v)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Detail Panel ─── */}
      {selectedTask && (
        <DetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={onUpdateTask}
          onToggle={onToggleDeliverable}
          onDelete={(id) => { onDeleteTask(id); setSelectedTask(null); }}
          onAddToSession={onAddToSession}
          onRemoveFromSession={onRemoveFromSession}
        />
      )}
    </div>
  );
}
