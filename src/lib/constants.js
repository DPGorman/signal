export const C = {
  bg:           "#1B1B1F",
  surface:      "#232328",
  surfaceHigh:  "#2C2C32",
  border:       "#3A3A42",
  borderSubtle: "#2F2F36",
  textPrimary:  "#E3E3E8",
  textSecondary:"#C4C4CC",
  textMuted:    "#8E8E96",
  textDisabled: "#4A4A52",
  gold:         "#E8C547",
  green:        "#6DD58C",
  red:          "#FF8A80",
  blue:         "#7ABCFF",
  purple:       "#CF9FFF",
};

export const CATEGORIES = [
  { id: "premise",    label: "Premise",    icon: "◈", color: "#E8C547" },
  { id: "character",  label: "Character",  icon: "◉", color: "#FFB27A" },
  { id: "scene",      label: "Scene",      icon: "◫", color: "#7ABCFF" },
  { id: "dialogue",   label: "Dialogue",   icon: "◌", color: "#CF9FFF" },
  { id: "arc",        label: "Story Arc",  icon: "◎", color: "#6DD58C" },
  { id: "production", label: "Production", icon: "◧", color: "#FF8A80" },
  { id: "research",   label: "Research",   icon: "◐", color: "#A8D8A8" },
  { id: "business",   label: "Business",   icon: "◑", color: "#FF8FB1" },
];

export const DOC_TYPES = [
  { id: "series_bible",    label: "Series Bible" },
  { id: "character_bible", label: "Character Bible" },
  { id: "premise",         label: "Premise Statement" },
  { id: "tone_guide",      label: "Tone Guide" },
  { id: "research",        label: "Research" },
  { id: "reference",       label: "Reference" },
];

export const DAILY_INVITATIONS = [
  "What are you afraid to write? That's probably the most important scene.",
  "Which character are you avoiding? Go there.",
  "What does your protagonist want that they can't admit?",
  "Name one thing that happens in this story that only this story could contain.",
  "What's the scene you keep circling without writing?",
  "If this series had a moral argument, what would it be?",
  "What would the antagonist say if they were the hero?",
  "Which idea from this week is still alive in you right now?",
];

export const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
export const todayInvitation = DAILY_INVITATIONS[new Date().getDay() % DAILY_INVITATIONS.length];

export const mono = "'Roboto Mono', 'SF Mono', monospace";
export const sans = "'Inter', system-ui, -apple-system, sans-serif";

export const inputBase = {
  width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
  color: C.textPrimary, padding: "11px 14px", fontFamily: sans,
  fontSize: 11, outline: "none", boxSizing: "border-box",
};

export async function callAI(system, userMsg, maxTokens = 1000) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message: userMsg, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
  return res.json();
}
