import { C, mono, sans, inputBase, todayInvitation } from "../../lib/constants";

export default function CaptureView({ captureInputRef, contextInputRef, ideas, pending, activeCanon, isAnalyzing, onCapture, onNavigate }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "52px 56px" }}>
      <div style={{ maxWidth: 660 }}>
        <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
          <div style={{ fontSize: 21, lineHeight: 1.9, color: C.textMuted, fontStyle: "italic" }}>{todayInvitation}</div>
        </div>

        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
        <textarea
          ref={captureInputRef}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) onCapture(); }}
          placeholder="Don't edit. Don't qualify. Just send the signal."
          rows={5}
          style={{ ...inputBase, fontSize: 16, lineHeight: 1.9, resize: "vertical", marginBottom: 16 }}
        />

        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>
          WHY DOES THIS FEEL IMPORTANT? <span style={{ color: C.textDisabled }}>(optional)</span>
        </div>
        <input
          ref={contextInputRef}
          placeholder="e.g. it reframes the protagonist's entire moral logic..."
          style={{ ...inputBase, marginBottom: 24 }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER</span>
          <button onClick={onCapture} disabled={isAnalyzing}
            style={{ background: isAnalyzing ? C.surfaceHigh : C.gold, color: isAnalyzing ? C.textMuted : C.bg, border: "none", padding: "12px 32px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
            {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
          </button>
        </div>

        <div style={{ marginTop: 56, paddingTop: 32, borderTop: `1px solid ${C.border}`, display: "flex", gap: 48 }}>
          {[
            { l: "IDEAS CAPTURED",   v: ideas.length,        dest: "library"      },
            { l: "OPEN INVITATIONS", v: pending.length,       dest: "deliverables" },
            { l: "CANON DOCS",       v: activeCanon.length,   dest: "canon"        },
          ].map(s => (
            <div key={s.l} onClick={() => onNavigate(s.dest)} style={{ cursor: "pointer" }}>
              <div style={{ fontSize: 44, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
