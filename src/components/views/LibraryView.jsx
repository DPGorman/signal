import { C, getCat, mono, sans } from "../../lib/constants";
import Highlight from "../Highlight";
import ReplyBox from "../ReplyBox";
import CorrectionBox from "../CorrectionBox";

// The AI's original words stay visible but de-emphasized once corrected —
// provenance is immutable; the user's truth sits beneath it (CorrectionBox).
const CORRECTED_STYLE = { opacity: 0.5, textDecoration: "line-through", textDecorationColor: `${C.gold}99` };

function CorrectedBadge() {
  return (
    <span style={{ fontSize: 10, color: C.gold, border: `1px solid ${C.gold}66`, borderRadius: 3, padding: "1px 6px", letterSpacing: "0.08em", fontFamily: mono }}>
      CORRECTED
    </span>
  );
}

export default function LibraryView({
  activeIdea,
  filtered,
  deliverables,
  replies,
  corrections = [],
  canonDocs = [],
  searchHighlight,
  signalFilter,
  onSetSignalFilter,
  onSetSearchHighlight,
  onDeleteIdea,
  onToggleDeliverable,
  onAddReply,
  onCorrect,
  onOpenCanon,
}) {
  const displayIdea = activeIdea || filtered[0] || null;
  // A section is "corrected" when an active correction exists for this idea+section.
  // The AI's original words stay visible but dimmed + badged (provenance is immutable).
  const isCorrected = (ideaId, section) =>
    (corrections || []).some(c => c.idea_id === ideaId && c.target_section === section && c.is_active);
  // 1.3 — source-cited answers: any active canon doc whose title is named in the
  // analysis (resonance, tension, or note) becomes a clickable source chip that
  // opens the canon. Works retroactively — no schema change, no migration.
  const citedCanon = (idea) => {
    if (!idea) return [];
    const hay = `${idea.ai_note || ""}\n${idea.canon_resonance || ""}\n${idea.canon_tension || ""}`.toLowerCase();
    return (canonDocs || []).filter(d => {
      if (!d.is_active || !d.title) return false;
      const t = d.title.toLowerCase();
      // Prefer the explicit bracketed citation the analysis prompt emits ("[Series Bible]").
      if (hay.includes(`[${t}]`)) return true;
      // Unbracketed fallback: only trust a bare title mention when it's specific
      // enough not to fire on a common word — guards the citation against false positives.
      return t.length >= 4 && hay.includes(t);
    });
  };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      {!displayIdea
        ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>No ideas yet.</div>
        : (() => {
            const cat = getCat(displayIdea.category);
            const ideaDels = deliverables.filter(d => d.idea_id === displayIdea.id);
            const cited = citedCanon(displayIdea);
            return (
              <div style={{ maxWidth: 640 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                  <span style={{ fontSize: 12, color: cat.color, fontFamily: mono, letterSpacing: "0.1em" }}>{cat.icon} {cat.label.toUpperCase()}</span>
                  {displayIdea.signal_strength >= 4 && (
                    <span
                      onClick={() => onSetSignalFilter(s => !s)}
                      title={signalFilter ? "Click to clear high-signal filter" : "Click to see all high-signal ideas"}
                      style={{ fontSize: 12, color: signalFilter ? C.bg : C.gold, background: signalFilter ? C.gold : "transparent", fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => !signalFilter && (e.currentTarget.style.background = C.gold + "20")}
                      onMouseLeave={e => !signalFilter && (e.currentTarget.style.background = "transparent")}
                    >
                      {signalFilter ? "✓ HIGH SIGNAL" : "HIGH SIGNAL"}
                    </span>
                  )}
                  {searchHighlight && <span onClick={() => onSetSearchHighlight("")} style={{ fontSize: 12, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px", cursor: "pointer" }}>✕ CLEAR HIGHLIGHT</span>}
                  <span style={{ flex: 1 }} />
                  <button onClick={() => onDeleteIdea(displayIdea.id)}
                    style={{ fontSize: 12, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4, opacity: 0.6 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                    DELETE
                  </button>
                  <span style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono }}>
                    {new Date(displayIdea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.65, marginBottom: 28, fontFamily: sans }}><Highlight text={displayIdea.text} term={searchHighlight} /></div>
                {displayIdea.inspiration_question && (
                  <div style={{ marginBottom: 32, padding: "16px 20px", background: C.surfaceHigh, borderLeft: `3px solid ${C.textMuted}` }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHY IT FELT IMPORTANT</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, fontStyle: "italic" }}><Highlight text={displayIdea.inspiration_question} term={searchHighlight} /></div>
                  </div>
                )}
                {displayIdea.ai_note && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      DRAMATURGICAL ANALYSIS
                      {isCorrected(displayIdea.id, "ai_note") && <CorrectedBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, ...(isCorrected(displayIdea.id, "ai_note") ? CORRECTED_STYLE : {}) }}><Highlight text={displayIdea.ai_note} term={searchHighlight} /></div>
                    <CorrectionBox idea={displayIdea} section="ai_note" aiOriginal={displayIdea.ai_note} corrections={corrections} onCorrect={onCorrect} />
                    <ReplyBox ideaId={displayIdea.id} section="ai_note" replies={replies} onAddReply={onAddReply} />
                  </div>
                )}
                {displayIdea.canon_resonance && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      CANON RESONANCE
                      {isCorrected(displayIdea.id, "canon_resonance") && <CorrectedBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, ...(isCorrected(displayIdea.id, "canon_resonance") ? CORRECTED_STYLE : {}) }}><Highlight text={displayIdea.canon_resonance} term={searchHighlight} /></div>
                    <CorrectionBox idea={displayIdea} section="canon_resonance" aiOriginal={displayIdea.canon_resonance} corrections={corrections} onCorrect={onCorrect} />
                    <ReplyBox ideaId={displayIdea.id} section="canon_resonance" replies={replies} onAddReply={onAddReply} />
                  </div>
                )}
                {/* 2.1 — contradiction detection: Signal's sharpest, most ownable move.
                    Says "this CONTRADICTS your canon," not just "this relates." */}
                {displayIdea.canon_tension && (
                  <div style={{ marginBottom: 32, padding: "16px 20px", background: `${C.red}12`, borderLeft: `3px solid ${C.red}`, borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: C.red, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      ⚠ TENSION WITH CANON
                      {isCorrected(displayIdea.id, "canon_tension") && <CorrectedBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, ...(isCorrected(displayIdea.id, "canon_tension") ? CORRECTED_STYLE : {}) }}><Highlight text={displayIdea.canon_tension} term={searchHighlight} /></div>
                    <CorrectionBox idea={displayIdea} section="canon_tension" aiOriginal={displayIdea.canon_tension} corrections={corrections} onCorrect={onCorrect} />
                    <ReplyBox ideaId={displayIdea.id} section="canon_tension" replies={replies} onAddReply={onAddReply} />
                  </div>
                )}
                {/* 1.3 — source-cited answers: click straight through to the canon the analysis rests on. */}
                {cited.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>SOURCES</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {cited.map(d => (
                        <span key={d.id} onClick={() => onOpenCanon && onOpenCanon(d.id)}
                          title="Open in Canon"
                          style={{ fontSize: 12, color: C.gold, border: `1px solid ${C.gold}40`, padding: "5px 12px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.background = C.gold + "18"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          ◈ {d.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {displayIdea.dimensions?.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 12 }}>DIMENSIONS</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {displayIdea.dimensions.map((d, i) => (
                        <span key={i} style={{ fontSize: 12, color: C.textSecondary, border: `1px solid ${C.border}`, padding: "5px 14px", fontFamily: mono }}>{d.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {ideaDels.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 16 }}>INVITATIONS TO ACTION</div>
                    {ideaDels.map(d => (
                      <div key={d.id} onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                        style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 17, height: 17, border: `2px solid ${d.is_complete ? C.green : C.border}`, background: d.is_complete ? C.green + "25" : "transparent", flexShrink: 0, marginTop: 3 }} />
                        <div style={{ fontSize: 12, color: d.is_complete ? C.textDisabled : C.textSecondary, lineHeight: 1.75, textDecoration: d.is_complete ? "line-through" : "none" }}>{d.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
      }
    </div>
  );
}
