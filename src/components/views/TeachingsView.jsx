import { C, mono, sans } from "../../lib/constants";

const SECTION_LABEL = {
  ai_note: "Dramaturgical analysis",
  canon_resonance: "Canon resonance",
  canon_tension: "Tension with canon",
};

// "What I've taught Signal" — every correction in one place, reviewable + undoable.
// Active corrections condition all future analysis; withdrawn ones are kept as
// history (the AI's original words are preserved on each).
export default function TeachingsView({ corrections = [], ideas = [], onUndo, onRestore, onOpenIdea }) {
  const active = corrections.filter(c => c.is_active);
  const withdrawn = corrections.filter(c => !c.is_active);
  const ideaText = (id) => {
    const i = ideas.find(x => x.id === id);
    return i ? i.text : "(idea removed)";
  };

  const Row = ({ c }) => (
    <div style={{ padding: "16px 20px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12, opacity: c.is_active ? 1 : 0.6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
        <span
          onClick={() => onOpenIdea && c.idea_id && onOpenIdea(c.idea_id)}
          title="Open this idea"
          style={{ fontSize: 12, color: C.textSecondary, fontFamily: sans, lineHeight: 1.5, cursor: c.idea_id ? "pointer" : "default", flex: 1 }}
          onMouseEnter={e => { if (c.idea_id) e.currentTarget.style.color = C.gold; }}
          onMouseLeave={e => { if (c.idea_id) e.currentTarget.style.color = C.textSecondary; }}>
          “{(ideaText(c.idea_id) || "").slice(0, 120)}{(ideaText(c.idea_id) || "").length > 120 ? "…" : ""}”
        </span>
        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          {SECTION_LABEL[c.target_section] || c.target_section}
        </span>
      </div>

      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 3 }}>SIGNAL SAID</div>
      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.55, marginBottom: 10, textDecoration: "line-through", textDecorationColor: `${C.gold}66` }}>
        {(c.ai_original || "").slice(0, 280)}{(c.ai_original || "").length > 280 ? "…" : ""}
      </div>

      <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 3 }}>YOU TAUGHT</div>
      <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, marginBottom: 12 }}>{c.correction_text}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>
          {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {c.is_active ? " · in force" : " · withdrawn"}
        </span>
        {c.is_active ? (
          <button onClick={() => onUndo && onUndo(c.id)}
            style={{ background: "none", border: `1px solid ${C.border}`, color: C.textMuted, padding: "5px 12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer" }}>
            WITHDRAW
          </button>
        ) : (
          <button onClick={() => onRestore && onRestore(c.id)}
            style={{ background: "none", border: `1px solid ${C.gold}66`, color: C.gold, padding: "5px 12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer" }}>
            REINSTATE
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>WHAT I'VE TAUGHT SIGNAL</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: sans, lineHeight: 1.6, marginBottom: 28, maxWidth: 560 }}>
          Every correction you've made. Active corrections are treated as settled truth across all future analysis — Signal won't re-argue them, but it will still challenge everything else. Withdraw one to stop it conditioning your work.
        </div>

        {corrections.length === 0 && (
          <div style={{ fontSize: 13, color: C.textMuted, fontFamily: sans, lineHeight: 1.6, padding: "24px 0" }}>
            Nothing yet. When Signal gets something wrong in an analysis, hit “this is wrong — correct it” under that line. What you teach it lands here.
          </div>
        )}

        {active.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 12 }}>IN FORCE · {active.length}</div>
            {active.map(c => <Row key={c.id} c={c} />)}
          </>
        )}

        {withdrawn.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", margin: "24px 0 12px" }}>WITHDRAWN · {withdrawn.length}</div>
            {withdrawn.map(c => <Row key={c.id} c={c} />)}
          </>
        )}
      </div>
    </div>
  );
}
