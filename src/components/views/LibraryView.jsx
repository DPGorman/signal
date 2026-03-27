import { C, getCat, mono, sans } from "../../lib/constants";
import Highlight from "../Highlight";
import ReplyBox from "../ReplyBox";

export default function LibraryView({ activeIdea, filtered, deliverables, replies, searchHighlight, onDeleteIdea, onToggleDeliverable, onSetSearchHighlight, onAddReply }) {
  const displayIdea = activeIdea || filtered[0] || null;

  if (!displayIdea) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
        <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>No ideas yet.</div>
      </div>
    );
  }

  const cat = getCat(displayIdea.category);
  const ideaDels = deliverables.filter(d => d.idea_id === displayIdea.id);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, letterSpacing: "0.1em" }}>{cat.icon} {cat.label.toUpperCase()}</span>
          {displayIdea.signal_strength >= 4 && (
            <span style={{ fontSize: 11, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px" }}>HIGH SIGNAL</span>
          )}
          {searchHighlight && (
            <span onClick={() => onSetSearchHighlight("")} style={{ fontSize: 11, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px", cursor: "pointer" }}>
              ✕ CLEAR HIGHLIGHT
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={() => onDeleteIdea(displayIdea.id)}
            style={{ fontSize: 11, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4, opacity: 0.6 }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
            DELETE
          </button>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>
            {new Date(displayIdea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.65, marginBottom: 28, fontFamily: sans }}>
          <Highlight text={displayIdea.text} term={searchHighlight} />
        </div>

        {displayIdea.inspiration_question && (
          <div style={{ marginBottom: 32, padding: "16px 20px", background: C.surfaceHigh, borderLeft: `3px solid ${C.textMuted}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHY IT FELT IMPORTANT</div>
            <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65, fontStyle: "italic" }}>
              <Highlight text={displayIdea.inspiration_question} term={searchHighlight} />
            </div>
          </div>
        )}

        {displayIdea.ai_note && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
            <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65 }}>
              <Highlight text={displayIdea.ai_note} term={searchHighlight} />
            </div>
            <ReplyBox ideaId={displayIdea.id} section="ai_note" replies={replies} onAddReply={onAddReply} />
          </div>
        )}

        {displayIdea.canon_resonance && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON RESONANCE</div>
            <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65 }}>
              <Highlight text={displayIdea.canon_resonance} term={searchHighlight} />
            </div>
            <ReplyBox ideaId={displayIdea.id} section="canon_resonance" replies={replies} onAddReply={onAddReply} />
          </div>
        )}

        {displayIdea.dimensions?.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 12 }}>DIMENSIONS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {displayIdea.dimensions.map((d, i) => (
                <span key={i} style={{ fontSize: 11, color: C.textSecondary, border: `1px solid ${C.border}`, padding: "5px 14px", fontFamily: mono }}>{d.label}</span>
              ))}
            </div>
          </div>
        )}

        {ideaDels.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 16 }}>INVITATIONS TO ACTION</div>
            {ideaDels.map(d => (
              <div key={d.id} onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 17, height: 17, border: `2px solid ${d.is_complete ? C.green : C.border}`, background: d.is_complete ? C.green + "25" : "transparent", flexShrink: 0, marginTop: 3 }} />
                <div style={{ fontSize: 11, color: d.is_complete ? C.textDisabled : C.textSecondary, lineHeight: 1.75, textDecoration: d.is_complete ? "line-through" : "none" }}>{d.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
