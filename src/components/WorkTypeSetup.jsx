import { useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#1B1B1F", surface: "#232328", surfaceHigh: "#2C2C32",
  border: "#3A3A42", textPrimary: "#E3E3E8", textSecondary: "#C4C4CC",
  textMuted: "#8E8E96", gold: "#E8C547", green: "#6DD58C",
  red: "#FF8A80", blue: "#7ABCFF", purple: "#C084FC",
};

const CREATOR_TYPES = [
  { id: "screenwriter", label: "Screenwriter", emoji: "🎬" },
  { id: "filmmaker",    label: "Filmmaker",    emoji: "🎥" },
  { id: "writer",       label: "Writer",       emoji: "✍️" },
  { id: "designer",     label: "Designer",     emoji: "🎨" },
  { id: "architect",    label: "Architect",    emoji: "🏛️" },
  { id: "other",        label: "Other",        emoji: "✨" },
];

const TEMPLATES = {
  screenwriter: ["Script", "Treatment", "Pitch", "Revision", "Outline", "Coverage", "Meeting"],
  filmmaker:    ["Shot List", "Pitch Deck", "Script", "Edit Pass", "Festival Submit", "Meeting"],
  writer:       ["Draft", "Outline", "Revision", "Pitch", "Research", "Interview", "Meeting"],
  designer:     ["Concept", "Mockup", "Revision", "Client Presentation", "Production", "Meeting"],
  architect:    ["Concept", "Schematic", "Design Development", "Construction Docs", "Presentation", "Meeting"],
  other:        ["Project", "Draft", "Review", "Presentation", "Meeting"],
};

export default function WorkTypeSetup({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [workTypes, setWorkTypes] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setWorkTypes(TEMPLATES[typeId] || []);
    setStep(2);
  };

  const toggleWorkType = (type) => {
    setWorkTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !workTypes.includes(trimmed)) {
      setWorkTypes(prev => [...prev, trimmed]);
    }
    setCustomInput("");
  };

  const handleSave = async () => {
    if (!workTypes.length) return;
    setSaving(true);
    try {
      const rows = workTypes.map(type => ({
        user_id: user.id,
        type_name: type,
        creator_category: selectedType,
      }));
      await supabase.from("user_work_types").delete().eq("user_id", user.id);
      await supabase.from("user_work_types").insert(rows);
      onComplete(workTypes);
    } catch (err) {
      console.error("Save work types error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: 32, maxWidth: 480, width: "100%",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s <= step ? 20 : 8, height: 8, borderRadius: 4,
              background: s <= step ? C.gold : C.border,
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Step 1: Creator type */}
        {step === 1 && (
          <>
            <div style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              What do you create?
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 24 }}>
              Signal adapts to your creative workflow.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {CREATOR_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => handleTypeSelect(ct.id)}
                  style={{
                    padding: "16px 8px", borderRadius: 10,
                    background: C.surfaceHigh, border: `1px solid ${C.border}`,
                    color: C.textPrimary, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <span style={{ fontSize: 24 }}>{ct.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{ct.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Work types */}
        {step === 2 && (
          <>
            <div style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Your work types
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>
              These are the kinds of work you'll track. Tap to toggle.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {workTypes.map(type => (
                <button
                  key={type}
                  onClick={() => toggleWorkType(type)}
                  style={{
                    padding: "6px 14px", borderRadius: 20,
                    background: C.gold + "22", border: `1px solid ${C.gold}`,
                    color: C.gold, fontSize: 13, cursor: "pointer", fontWeight: 500,
                  }}
                >
                  {type} ✓
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: C.gold, border: "none",
                  color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 3: Custom additions */}
        {step === 3 && (
          <>
            <div style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Add your own
            </div>
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>
              Anything else you work on? Add it here — you can always change this later.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustom()}
                placeholder="e.g. Lookbook, Campaign, Storyboard"
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  background: C.surfaceHigh, border: `1px solid ${C.border}`,
                  color: C.textPrimary, fontSize: 14, outline: "none",
                }}
              />
              <button
                onClick={addCustom}
                style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: C.surfaceHigh, border: `1px solid ${C.border}`,
                  color: C.textMuted, cursor: "pointer", fontSize: 16,
                }}
              >+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, minHeight: 36 }}>
              {workTypes.map(type => (
                <span key={type} style={{
                  padding: "4px 12px", borderRadius: 20,
                  background: C.surfaceHigh, border: `1px solid ${C.border}`,
                  color: C.textSecondary, fontSize: 12,
                }}>{type}</span>
              ))}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !workTypes.length}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8,
                background: C.gold, border: "none",
                color: "#000", fontWeight: 700, fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Start using Signal →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
