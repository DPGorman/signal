import { useState } from "react";
import { C, mono, sans } from "../lib/constants";

// The "correct the AI" affordance, rendered under an analysis line.
// - Shows any active corrections for this idea+section as "✓ CORRECTED BY YOU".
// - A quiet toggle opens an input to teach Signal what's actually true.
// The AI's original words are NOT erased — LibraryView dims + badges them; this
// box carries the user's truth. onCorrect(idea, section, aiOriginal, text) saves
// the correction (which becomes canon) and re-analyzes the idea.
export default function CorrectionBox({ idea, section, aiOriginal, corrections, onCorrect }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const active = (corrections || []).filter(
    c => c.idea_id === idea?.id && c.target_section === section && c.is_active
  );

  const save = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const ok = await onCorrect(idea, section, aiOriginal, draft);
    setSaving(false);
    if (ok) { setDraft(""); setOpen(false); }
  };

  return (
    <div style={{ marginTop: 8 }}>
      {active.map(c => (
        <div key={c.id} style={{ padding: "10px 14px", background: `${C.gold}10`, borderLeft: `3px solid ${C.gold}`, marginBottom: 8, borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 4 }}>
            ✓ CORRECTED BY YOU · {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6 }}>{c.correction_text}</div>
        </div>
      ))}
      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ background: "none", border: "none", color: C.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", cursor: "pointer", padding: "2px 0", textDecoration: "underline", textUnderlineOffset: 3 }}
          onMouseEnter={e => e.currentTarget.style.color = C.gold}
          onMouseLeave={e => e.currentTarget.style.color = C.textMuted}>
          {active.length ? "+ correct again" : "✕ this is wrong — correct it"}
        </button>
      ) : (
        <div style={{ marginTop: 4 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            autoFocus
            placeholder="What's actually true? Signal keeps its original words, marks them corrected, and respects this in all future analysis."
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.gold}55`, color: C.textPrimary, padding: "9px 12px", fontFamily: sans, fontSize: 13, lineHeight: 1.5, outline: "none", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={save} disabled={!draft.trim() || saving}
              style={{ background: draft.trim() ? C.gold : C.surfaceHigh, border: "none", color: draft.trim() ? C.bg : C.textMuted, padding: "7px 14px", fontFamily: mono, fontSize: 12, letterSpacing: "0.06em", cursor: draft.trim() && !saving ? "pointer" : "default" }}>
              {saving ? "TEACHING…" : "TEACH SIGNAL"}
            </button>
            <button onClick={() => { setOpen(false); setDraft(""); }}
              style={{ background: "none", border: `1px solid ${C.border}`, color: C.textMuted, padding: "7px 14px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
