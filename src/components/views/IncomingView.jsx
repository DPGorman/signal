import { useState } from "react";
import { C, mono, sans, getCat } from "../../lib/constants";

// Incoming — triage surface for non-creative captures (task | personal_note | unclear).
// Per the 2026-05-17 design sketch + DPG's 5 decisions:
//   scope=include tasks, name="Incoming", placement=paired with Capture,
//   "Move to project"=re-classify with new context, desktop first.
//
// Row affordances: Clarify (re-classify in capture flow), Edit tag (inline),
// Move to project (re-classify with project_material framing), Archive.
export default function IncomingView({
  incomingIdeas,
  isAnalyzing,
  onUpdateAutoTag,
  onArchive,
  onMoveToProject,
  onClarify,
}) {
  const [filter, setFilter] = useState("all");        // all | unclear | task | personal_note | tagged
  const [editing, setEditing] = useState(null);       // { id, value } or null

  const filtered = (() => {
    if (filter === "all")    return incomingIdeas;
    if (filter === "tagged") return incomingIdeas.filter(i => i.auto_tag);
    return incomingIdeas.filter(i => i.kind === filter);
  })();

  const filters = [
    { id: "all",           label: "All",     count: incomingIdeas.length },
    { id: "unclear",       label: "Unclear", count: incomingIdeas.filter(i => i.kind === "unclear").length },
    { id: "task",          label: "Tasks",   count: incomingIdeas.filter(i => i.kind === "task").length },
    { id: "personal_note", label: "Notes",   count: incomingIdeas.filter(i => i.kind === "personal_note").length },
    { id: "tagged",        label: "Tagged",  count: incomingIdeas.filter(i => i.auto_tag).length },
  ];

  const startEdit = (idea) => setEditing({ id: idea.id, value: idea.auto_tag || "" });
  const commitEdit = async () => {
    if (!editing) return;
    const trimmed = editing.value.trim();
    await onUpdateAutoTag(editing.id, trimmed || null);
    setEditing(null);
  };
  const cancelEdit = () => setEditing(null);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Filter chip bar */}
      <div style={{ padding: "14px 24px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {filters.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                background: active ? C.gold : "transparent",
                color: active ? C.bg : C.textMuted,
                border: `1px solid ${active ? C.gold : C.border}`,
                padding: "4px 10px", fontSize: 12, fontFamily: mono,
                fontWeight: 500, cursor: "pointer", borderRadius: 4,
                letterSpacing: "0.05em",
              }}>
              {f.label.toUpperCase()} {f.count}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: C.textMuted, fontStyle: "italic", marginBottom: 6 }}>
              Nothing loose.
            </div>
            <div style={{ fontSize: 13, color: C.textDisabled, fontStyle: "italic" }}>
              Everything is in its place.
            </div>
          </div>
        ) : (
          filtered.map(idea => {
            const cat = getCat(idea.kind);
            const isEditing = editing?.id === idea.id;
            const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
            const ago = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;

            return (
              <div key={idea.id}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "14px 16px",
                  marginBottom: 10,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.textMuted}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

                {/* Body text + ago */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: C.textPrimary, flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {idea.text}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono, flexShrink: 0, marginTop: 2 }}>
                    {ago}
                  </div>
                </div>

                {/* Q&A transcript for unclear */}
                {idea.kind === "unclear" && idea.ai_note && (
                  <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
                    {idea.ai_note}
                  </div>
                )}

                {/* Chip row: kind + auto_tag */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11, fontFamily: mono, fontWeight: 600,
                    background: cat.color + "22", color: cat.color,
                    border: `1px solid ${cat.color}55`, padding: "3px 8px",
                    borderRadius: 3, letterSpacing: "0.08em",
                  }}>
                    {cat.icon} {cat.label.toUpperCase()}
                  </span>

                  {isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        value={editing.value}
                        onChange={e => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitEdit();
                          else if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        placeholder="add a tag..."
                        style={{
                          background: C.bg, border: `1px solid ${C.gold}`,
                          color: C.textPrimary, padding: "3px 8px",
                          fontSize: 11, fontFamily: mono, outline: "none",
                          borderRadius: 3, width: 140,
                        }}
                      />
                      <button onClick={commitEdit}
                        style={{ background: C.gold, color: C.bg, border: "none", padding: "3px 8px", fontSize: 11, fontFamily: mono, cursor: "pointer", borderRadius: 3 }}>
                        ✓
                      </button>
                      <button onClick={cancelEdit}
                        style={{ background: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, padding: "3px 8px", fontSize: 11, fontFamily: mono, cursor: "pointer", borderRadius: 3 }}>
                        ✕
                      </button>
                    </div>
                  ) : idea.auto_tag ? (
                    <button onClick={() => startEdit(idea)}
                      style={{
                        background: "transparent", color: C.textSecondary,
                        border: `1px solid ${C.border}`, padding: "3px 8px",
                        fontSize: 11, fontFamily: mono, cursor: "pointer",
                        borderRadius: 3, letterSpacing: "0.05em",
                      }}
                      title="Click to edit tag">
                      ⬢ {idea.auto_tag} ✎
                    </button>
                  ) : (
                    <button onClick={() => startEdit(idea)}
                      style={{
                        background: "transparent", color: C.textDisabled,
                        border: `1px dashed ${C.border}`, padding: "3px 8px",
                        fontSize: 11, fontFamily: mono, cursor: "pointer",
                        borderRadius: 3, fontStyle: "italic",
                      }}>
                      + tag
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {idea.kind === "unclear" && (
                    <button onClick={() => onClarify(idea)} disabled={isAnalyzing}
                      style={actionBtn(C.gold, isAnalyzing)}>
                      Clarify
                    </button>
                  )}
                  <button onClick={() => onMoveToProject(idea)} disabled={isAnalyzing}
                    style={actionBtn(C.green, isAnalyzing)}>
                    Move to project
                  </button>
                  <button onClick={() => onArchive(idea.id)} disabled={isAnalyzing}
                    style={actionBtn(C.textMuted, isAnalyzing)}>
                    Archive
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const actionBtn = (color, disabled) => ({
  background: "transparent",
  color: disabled ? C.textDisabled : color,
  border: `1px solid ${disabled ? C.border : color + "55"}`,
  padding: "5px 12px",
  fontSize: 11,
  fontFamily: mono,
  letterSpacing: "0.05em",
  cursor: disabled ? "default" : "pointer",
  borderRadius: 3,
});
