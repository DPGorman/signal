import { useState } from "react";
import { C, CATEGORIES, getCat, mono, sans } from "../../lib/constants";
import Highlight from "../Highlight";

export default function DeliverablesView({ deliverables, pending, searchHighlight, scrollToId, onToggleDeliverable }) {
  const [actionsView, setActionsView] = useState("focus");

  const completed = deliverables.filter(d => d.is_complete);
  const pct = deliverables.length ? Math.round((completed.length / deliverables.length) * 100) : 0;
  const byCategory = CATEGORIES.map(cat => ({ ...cat, items: pending.filter(d => d.idea?.category === cat.id) })).filter(cat => cat.items.length > 0);
  const next5 = pending.slice(0, 5);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      <div style={{ maxWidth: 700 }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.textSecondary }}>{pending.length} open · {completed.length} complete</span>
            <span style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
            <div style={{ height: "100%", background: C.gold, width: `${pct}%`, borderRadius: 2, transition: "width 0.4s" }} />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[{ id: "focus", label: "Next Up" }, { id: "workshops", label: "Workshops" }, { id: "all", label: "All Open" }].map(t => (
            <button key={t.id} onClick={() => setActionsView(t.id)}
              style={{ background: actionsView === t.id ? C.gold + "20" : "transparent", border: `1px solid ${actionsView === t.id ? C.gold + "60" : C.border}`, color: actionsView === t.id ? C.gold : C.textMuted, padding: "5px 12px", fontSize: 11, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
              {t.label}
            </button>
          ))}
        </div>

        {actionsView === "focus" && (
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 12 }}>YOUR NEXT 5 ACTIONS</div>
            {next5.length === 0
              ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>All caught up.</div>
              : next5.map(d => {
                  const cat = getCat(d.idea?.category);
                  return (
                    <div key={d.id} id={`del-${d.id}`}
                      style={{ padding: "14px 16px", marginBottom: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, borderLeft: `3px solid ${cat.color}`, cursor: "pointer" }}
                      onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = cat.color}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.6, marginBottom: 6 }}>
                        <Highlight text={d.text} term={searchHighlight} />
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                        {d.idea?.text && <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>· {d.idea.text.slice(0, 40)}...</span>}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {actionsView === "workshops" && (
          <div>
            {byCategory.map(cat => (
              <div key={cat.id} style={{ marginBottom: 28, padding: "16px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, borderTop: `3px solid ${cat.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label.toUpperCase()} WORKSHOP</span>
                  <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{cat.items.length} tasks</span>
                </div>
                {cat.items.slice(0, 5).map(d => (
                  <div key={d.id} id={`del-${d.id}`}
                    onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>
                      <Highlight text={d.text} term={searchHighlight} />
                    </div>
                  </div>
                ))}
                {cat.items.length > 5 && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 8 }}>+{cat.items.length - 5} more</div>}
              </div>
            ))}
          </div>
        )}

        {actionsView === "all" && (
          pending.length === 0
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>All invitations complete.</div>
            : byCategory.map(cat => (
                <div key={cat.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, color: cat.color, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 10 }}>{cat.icon} {cat.label.toUpperCase()}</div>
                  {cat.items.map(d => (
                    <div key={d.id} id={`del-${d.id}`}
                      onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                      style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", background: scrollToId === d.id ? C.surfaceHigh : "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                      onMouseLeave={e => scrollToId !== d.id && (e.currentTarget.style.background = "transparent")}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>
                          <Highlight text={d.text} term={searchHighlight} />
                        </div>
                        {d.idea?.text && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 4 }}>from: {d.idea.text.slice(0, 60)}...</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ))
        )}
      </div>
    </div>
  );
}
