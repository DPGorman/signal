import { C, CATEGORIES, getCat, mono, sans } from "../../lib/constants";
import SectionHead from "../SectionHead";

export default function DashboardView({ user, ideas, deliverables, pending, activeCanon, canonDocs, onNavigate, onSetFilterCat, onSetActiveDoc }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "36px 44px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 16, color: C.textPrimary, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>{user.project_name}</div>
        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 36 }}>
        {[
          { label: "Ideas",       value: ideas.length,                                                              color: C.gold,   sub: `${ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length} this week`, dest: "library" },
          { label: "Invitations", value: pending.length,                                                            color: C.red,    sub: `${deliverables.filter(d => d.is_complete && d.type !== "task").length} completed`,          dest: "deliverables" },
          { label: "Tasks",       value: deliverables.filter(d => d.type === "task" && !d.is_complete).length,      color: C.blue,   sub: `${deliverables.filter(d => d.type === "task" && d.is_complete).length} done`,             dest: "tasks" },
          { label: "Canon",       value: activeCanon.length,                                                        color: C.purple, sub: "active sources",                                                                           dest: "canon" },
        ].map(s => (
          <div key={s.label} onClick={() => onNavigate(s.dest)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ fontSize: 29, color: s.color, fontWeight: 300, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textPrimary, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent captures */}
      <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}` }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHead label="RECENT CAPTURES" onClick={() => onNavigate("library")} />
          <span onClick={() => onNavigate("library")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
        </div>
        {ideas.length === 0
          ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>No ideas yet.</div>
          : ideas.slice(0, 6).map((idea, idx) => {
              const cat = getCat(idea.category);
              const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
              return (
                <div key={idea.id} onClick={() => onNavigate("library", idea)}
                  style={{ padding: "13px 18px", borderBottom: idx < 5 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 11, color: cat.color, marginTop: 2, flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{idea.text}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 3 }}>
                      {cat.label} · {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                      {idea.signal_strength >= 4 && <span style={{ color: C.gold, marginLeft: 6 }}>◈</span>}
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Open invitations */}
      <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}` }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHead label="OPEN INVITATIONS" onClick={() => onNavigate("deliverables")} />
          <span onClick={() => onNavigate("deliverables")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
        </div>
        {pending.length === 0
          ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>All caught up.</div>
          : pending.slice(0, 5).map((task, idx, arr) => {
              const cat = getCat(task.idea?.category);
              return (
                <div key={task.id}
                  style={{ padding: "13px 18px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{task.text}</div>
                    <div style={{ fontSize: 11, color: cat.color, fontFamily: mono, marginTop: 3 }}>{cat.icon} {cat.label}</div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Signal distribution */}
      {ideas.length > 0 && (
        <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <SectionHead label="SIGNAL DISTRIBUTION" onClick={() => onNavigate("library")} />
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 1, margin: "12px 0" }}>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return <div key={cat.id} title={`${cat.label}: ${count}`} style={{ flex: count, background: cat.color, opacity: 0.85 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <span key={cat.id} onClick={() => { onSetFilterCat(cat.id); onNavigate("library"); }}
                style={{ fontSize: 11, color: C.textMuted, cursor: "pointer", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = cat.color}
                onMouseLeave={e => e.currentTarget.style.color = C.textMuted}>
                <span style={{ color: cat.color }}>{cat.icon}</span> {cat.label} {ideas.filter(i => i.category === cat.id).length}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canon layer */}
      {canonDocs.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionHead label="CANON LAYER" onClick={() => onNavigate("canon")} />
            <span onClick={() => onNavigate("canon")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>MANAGE →</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canonDocs.map(doc => (
              <div key={doc.id} onClick={() => { onSetActiveDoc(doc); onNavigate("canon"); }}
                style={{ background: C.surfaceHigh, border: `1px solid ${doc.is_active ? C.green + "50" : C.border}`, padding: "10px 14px", display: "flex", gap: 8, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = doc.is_active ? C.green : C.textMuted}
                onMouseLeave={e => e.currentTarget.style.borderColor = doc.is_active ? C.green + "50" : C.border}>
                <span style={{ color: doc.is_active ? C.green : C.textDisabled }}>◈</span>
                <div>
                  <div style={{ fontSize: 11, color: doc.is_active ? C.textPrimary : C.textDisabled }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{doc.is_active ? "active" : "inactive"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
