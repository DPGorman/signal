import { C, mono, inputBase, todayInvitation } from "../../lib/constants";

export default function CaptureView({
  captureInputRef,
  contextInputRef,
  ideas,
  pending,
  activeCanon,
  isAnalyzing,
  onCapture,
  onNavigate,
  // Clarification flow (voice doc v2.3 §2.5 + §2.7). null when no flow active.
  clarification,
  clarifyAnswer,
  onClarifyAnswerChange,
  onSubmitClarification,
  onGiveUpClarification,
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "52px 56px" }}>
      <div style={{ maxWidth: 660 }}>
        <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 48 }}>
          <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
          <div style={{ fontSize: 22, lineHeight: 1.9, color: C.textMuted, fontStyle: "italic" }}>{todayInvitation}</div>
        </div>

        {clarification ? (
          // Multi-round clarification panel. Shown instead of the normal capture
          // form when classify returned unclear and round < 4.
          <div style={{ border: `1px solid #B89968`, borderRadius: 6, padding: 28, marginBottom: 24, background: C.surfaceHigh }}>
            <div style={{ fontSize: 11, color: "#B89968", fontFamily: mono, letterSpacing: "0.15em", marginBottom: 12 }}>
              ROUND {clarification.round} OF 4 — SIGNAL NEEDS CONTEXT
            </div>
            <div style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono, marginBottom: 6 }}>YOU CAPTURED:</div>
            <div style={{ fontSize: 15, color: C.textSecondary, fontStyle: "italic", marginBottom: 20, paddingLeft: 12, borderLeft: `2px solid ${C.border}` }}>
              "{clarification.originalText}"
            </div>
            {clarification.qaHistory.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {clarification.qaHistory.map((qa, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 10 }}>
                    <div style={{ color: C.textMuted }}><span style={{ color: "#B89968" }}>Signal:</span> {qa.q}</div>
                    <div style={{ color: C.textPrimary, paddingLeft: 16, marginTop: 4 }}><span style={{ color: C.gold }}>You:</span> {qa.a}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.6, marginBottom: 16 }}>
              <span style={{ color: "#B89968" }}>Signal:</span> {clarification.currentQuestion}
            </div>
            <input
              value={clarifyAnswer}
              onChange={e => onClarifyAnswerChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmitClarification(); } }}
              placeholder="Your answer..."
              autoFocus
              style={{ ...inputBase, marginBottom: 16 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={onGiveUpClarification} disabled={isAnalyzing}
                style={{ background: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, padding: "10px 20px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
                SKIP — SAVE AS UNCLEAR
              </button>
              <button onClick={onSubmitClarification} disabled={isAnalyzing || !clarifyAnswer.trim()}
                style={{ background: (isAnalyzing || !clarifyAnswer.trim()) ? C.surfaceHigh : C.gold, color: (isAnalyzing || !clarifyAnswer.trim()) ? C.textMuted : C.bg, border: "none", padding: "12px 32px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", cursor: (isAnalyzing || !clarifyAnswer.trim()) ? "default" : "pointer" }}>
                {isAnalyzing ? "RECLASSIFYING..." : "ANSWER →"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
            <textarea ref={captureInputRef}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) onCapture(); }}
              placeholder="Don't edit. Don't qualify. Just send the signal."
              rows={5}
              style={{ ...inputBase, fontSize: 17, lineHeight: 1.9, resize: "vertical", marginBottom: 16 }}
            />
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>
              WHY DOES THIS FEEL IMPORTANT? <span style={{ color: C.textDisabled }}>(optional)</span>
            </div>
            <input ref={contextInputRef}
              placeholder="e.g. it reframes the protagonist's entire moral logic..."
              style={{ ...inputBase, marginBottom: 24 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER</span>
              <button onClick={onCapture} disabled={isAnalyzing}
                style={{ background: isAnalyzing ? C.surfaceHigh : C.gold, color: isAnalyzing ? C.textMuted : C.bg, border: "none", padding: "12px 32px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
                {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
              </button>
            </div>
          </>
        )}
        <div style={{ marginTop: 56, paddingTop: 32, borderTop: `1px solid ${C.border}`, display: "flex", gap: 48 }}>
          {[
            { l: "IDEAS CAPTURED",   v: ideas.length,       dest: "library"      },
            { l: "OPEN INVITATIONS", v: pending.length,     dest: "deliverables" },
            { l: "CANON DOCS",       v: activeCanon.length, dest: "canon"        },
          ].map(s => (
            <div key={s.l} onClick={() => onNavigate(s.dest)} style={{ cursor: "pointer" }}>
              <div style={{ fontSize: 45, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
