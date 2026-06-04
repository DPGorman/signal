// Feature 7 — the "Signal noticed…" pairwise synthesis card.
//
// The connections engine writes weighted links between captures. This module
// decides WHEN a link is strong enough to be worth colliding into one new
// thought (an `insight`-mode synthesis), and formats the two captures for that
// call. Kept pure + separate from app.jsx so the trigger logic is unit-tested
// (mirrors api/connections/_resolve.js) without mocking the network or React.

// The minimum link strength that earns a synthesis. The generator's scale is
// 1=faint echo … 4=these ideas need each other … 5=same nerve. We only spend an
// AI call (and only interrupt the user with a synthesized claim) on a genuine
// collision — strength >= 4 — never on a faint parallel.
export const SYNTHESIS_MIN_STRENGTH = 4;

// Given the link list surfaced for a just-captured idea, return the single
// strongest link worth synthesizing, or null if none clears the bar. Does not
// assume the input is pre-sorted.
export function pickSynthesisPair(links, minStrength = SYNTHESIS_MIN_STRENGTH) {
  if (!Array.isArray(links) || links.length === 0) return null;
  let best = null;
  for (const l of links) {
    const s = Number(l?.strength);
    if (!Number.isFinite(s) || s < minStrength) continue;
    if (!best || s > Number(best.strength)) best = l;
  }
  return best || null;
}

// Format the two captures for INSIGHT mode. The mode prompt expects "TWO
// captures" and synthesizes them into one declarative "Signal noticed…"
// observation; it must SYNTHESIZE, not summarize either alone — so both texts
// are passed in full, labelled, with no other framing.
export function buildInsightMessage(newText, partnerText) {
  return `CAPTURE A (just now): "${(newText || "").trim()}"\n\nCAPTURE B (earlier): "${(partnerText || "").trim()}"`;
}

// INSIGHT mode returns plain text, so /api/ai responds {raw}. Normalize the
// response to a clean one-line synthesis string, or "" if nothing usable.
export function extractSynthesis(aiResponse) {
  const t = (aiResponse?.raw ?? aiResponse?.text ?? "");
  if (typeof t !== "string") return "";
  return t.replace(/```/g, "").trim();
}
