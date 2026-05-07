// src/components/OnboardingFlow.jsx
//
// Activation-pattern onboarding flow (per SIGNAL-OPS · 5/7 · activation pattern lock).
// Four steps: project name → craft (10 V1 crafts) → collaborator name (optional) →
// ONE canon doc framed as "the one thing you'd hand a thought partner if you had
// ten minutes." Skippable but nags once.
//
// Replaces the orphaned WorkTypeSetup.jsx and the prior inline "name your project"
// onboarding in app.jsx. The 10 crafts match users.craft CHECK constraint
// (database/2026-05-06_voice_overlay_system.sql).

import { useState } from "react";

const CRAFTS = [
  { id: "screenwriter",      label: "Screenwriter",      emoji: "🎬" },
  { id: "novelist",          label: "Novelist",          emoji: "📖" },
  { id: "fashion_designer",  label: "Fashion Designer",  emoji: "🪡" },
  { id: "architect",         label: "Architect",         emoji: "🏛️" },
  { id: "interior_designer", label: "Interior Designer", emoji: "🛋️" },
  { id: "chef",              label: "Chef",              emoji: "🔪" },
  { id: "illustrator",       label: "Illustrator",       emoji: "🎨" },
  { id: "game_designer",     label: "Game Designer",     emoji: "🎲" },
  { id: "product_designer",  label: "Product Designer",  emoji: "📐" },
  { id: "founder",           label: "Founder",           emoji: "⚡" },
];

export default function OnboardingFlow({ C, sans, mono, error, loading, onComplete }) {
  const [step, setStep]                 = useState(1);
  const [name, setName]                 = useState("");
  const [craft, setCraft]               = useState(null);
  const [collaborator, setCollaborator] = useState("");
  const [canonTitle, setCanonTitle]     = useState("");
  const [canonContent, setCanonContent] = useState("");
  const [skipNagShown, setSkipNagShown] = useState(false);

  const totalSteps = 4;
  const handleNext = () => setStep(s => s + 1);

  const handleCraftSelect = (craftId) => {
    setCraft(craftId);
    handleNext();
  };

  const submit = ({ withCanon }) => {
    onComplete({
      name: name.trim(),
      craft,
      collaborator: collaborator.trim() || null,
      canon: withCanon && canonTitle.trim() && canonContent.trim()
        ? { title: canonTitle.trim(), content: canonContent.trim() }
        : null,
    });
  };

  const handleSkipCanon = () => {
    if (skipNagShown) submit({ withCanon: false });
    else setSkipNagShown(true);
  };

  // Shared frame
  const wrap = (children) => (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, padding: 20 }}>
      <div style={{ width: 460, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: i + 1 === step ? 20 : 8, height: 6, borderRadius: 3,
              background: i + 1 <= step ? C.gold : C.border,
              transition: "all 0.3s",
            }} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 30, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em" }}>Signal</div>
        </div>
        {children}
        {error && <div style={{ fontSize: 12, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{error}</div>}
      </div>
    </div>
  );

  // STEP 1 — Project name
  if (step === 1) return wrap(
    <>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", textAlign: "center" }}>NAME YOUR PROJECT</div>
      <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", lineHeight: 1.6 }}>
        What are you working on? This becomes your workspace.
      </div>
      <input
        type="text"
        placeholder="e.g. CRISPR, Untitled Pilot, The Descent..."
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && name.trim() && handleNext()}
        autoFocus
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "14px 16px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box", textAlign: "center" }}
      />
      <button
        onClick={handleNext}
        disabled={!name.trim()}
        style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: !name.trim() ? "default" : "pointer", borderRadius: 6, opacity: !name.trim() ? 0.5 : 1 }}
      >
        CONTINUE →
      </button>
    </>
  );

  // STEP 2 — Craft
  if (step === 2) return wrap(
    <>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", textAlign: "center" }}>YOUR CRAFT</div>
      <div style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.6, padding: "0 20px" }}>
        What do you make? Your craft, your profession, your work — however you describe it.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {CRAFTS.map(ct => (
          <button
            key={ct.id}
            onClick={() => handleCraftSelect(ct.id)}
            style={{
              padding: "14px 12px", borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.textPrimary, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 13, fontFamily: sans, textAlign: "left",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <span style={{ fontSize: 18 }}>{ct.emoji}</span>
            <span>{ct.label}</span>
          </button>
        ))}
      </div>
    </>
  );

  // STEP 3 — Collaborator name (optional)
  if (step === 3) return wrap(
    <>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", textAlign: "center" }}>NAME YOUR COLLABORATOR</div>
      <div style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.6, padding: "0 20px" }}>
        Optional. If you'd rather call your collaborator something other than "Signal," name them here.
      </div>
      <input
        type="text"
        placeholder="e.g. Sal, V, Kai..."
        value={collaborator}
        onChange={e => setCollaborator(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleNext()}
        autoFocus
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "14px 16px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box", textAlign: "center" }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleNext}
          style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: "pointer", borderRadius: 6 }}
        >
          SKIP
        </button>
        <button
          onClick={handleNext}
          style={{ flex: 1, background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: "pointer", borderRadius: 6 }}
        >
          CONTINUE →
        </button>
      </div>
    </>
  );

  // STEP 4 — Canon doc (skippable, nags once)
  if (step === 4) return wrap(
    <>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", textAlign: "center" }}>ONE THING TO READ</div>
      <div style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.6, padding: "0 20px" }}>
        Drop in <em>the one thing</em> you'd hand a thought partner if you had ten minutes. A pitch, a brief, a brand book, the script you've been wrestling with — whatever your collaborator should read first.
      </div>
      <input
        type="text"
        placeholder="Title (e.g. The Descent — pilot pitch)"
        value={canonTitle}
        onChange={e => setCanonTitle(e.target.value)}
        autoFocus
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }}
      />
      <textarea
        placeholder="Paste the contents here..."
        value={canonContent}
        onChange={e => setCanonContent(e.target.value)}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box", minHeight: 160, resize: "vertical" }}
      />
      {skipNagShown && (
        <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 1.6, padding: "10px 14px", background: C.surface, borderRadius: 6, border: `1px dashed ${C.border}` }}>
          Skipping is fine. Signal works without canon — but it works <em>better</em> with one document to read against. You can add canon any time from the Canon tab.
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSkipCanon}
          disabled={loading}
          style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: "pointer", borderRadius: 6, opacity: loading ? 0.6 : 1 }}
        >
          {skipNagShown ? "SKIP ANYWAY" : "SKIP"}
        </button>
        <button
          onClick={() => submit({ withCanon: true })}
          disabled={loading || !canonTitle.trim() || !canonContent.trim()}
          style={{ flex: 1, background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: !canonTitle.trim() || !canonContent.trim() ? "default" : "pointer", borderRadius: 6, opacity: loading || !canonTitle.trim() || !canonContent.trim() ? 0.5 : 1 }}
        >
          {loading ? "SAVING..." : "START SIGNAL →"}
        </button>
      </div>
    </>
  );

  return null;
}
