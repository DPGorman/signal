// api/_voice/voicecard-core.js — shared voice-card generation core.
//
// Extracted from api/voicecard/generate.js so both the user-facing endpoint
// (POST /api/voicecard/generate, user JWT) and the cron endpoint
// (GET /api/refresh-voicecards, CRON_SECRET) can call the same Claude
// prompt + atomic-swap pipeline without code duplication.
//
// `generateVoiceCard(user_id)`:
//   - Loads user profile, recent captures, lexicon, canon, AI observations.
//   - Asks Claude (HIGH_QUALITY_MODEL / Opus) to write a 200-400-word peer
//     signature describing how this specific creative thinks.
//   - Validates the signature length envelope (rejects obvious garbage).
//   - Atomic-swaps the active voicecard via the swap_active_voice_card RPC.
//
// Returns: { card_id, version, word_count, captures_used } on success.
// Throws on any failure (insufficient captures, Claude error, swap error).
// Callers handle req/res framing (status codes, JSON shape) themselves.

import { supabase } from "../_supabase.js";
import { callClaude, HIGH_QUALITY_MODEL } from "../_anthropic.js";
import { BACKBONE } from "./backbone.js";
import { OVERLAYS } from "./overlays.js";

export const MIN_CAPTURES = 5;
export const MAX_CAPTURES_SAMPLE = 100;
export const MAX_OBSERVATIONS = 30;
const MAX_TOKENS = 1200;
const MIN_SIGNATURE_WORDS = 100;
const MAX_SIGNATURE_WORDS = 800;
const DEFAULT_CRAFT = "screenwriter";

export async function generateVoiceCard(user_id) {
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, auth_id, craft, collaborator_name, project_name")
    .eq("id", user_id)
    .single();
  if (userErr || !user) throw new Error(`user lookup failed: ${userErr?.message || "not found"}`);

  const { data: ideas, error: ideasErr } = await supabase
    .from("ideas")
    .select("text, ai_note, category, signal_strength, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(MAX_CAPTURES_SAMPLE);
  if (ideasErr) throw new Error(`ideas load failed: ${ideasErr.message}`);
  if (!ideas || ideas.length < MIN_CAPTURES) {
    const err = new Error(`Need at least ${MIN_CAPTURES} captures. Currently: ${ideas?.length || 0}.`);
    err.code = "INSUFFICIENT_CAPTURES";
    throw err;
  }

  const { data: lexicon } = await supabase
    .from("user_lexicon")
    .select("term, type, frequency")
    .eq("user_id", user_id)
    .order("frequency", { ascending: false })
    .limit(30);

  const { data: canon } = await supabase
    .from("canon_documents")
    .select("title, doc_type, summary")
    .eq("user_id", user_id)
    .eq("is_active", true);

  const { data: observations } = await supabase
    .from("ai_observations")
    .select("type, text, user_verbatim, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(MAX_OBSERVATIONS);

  const captureBlock = ideas
    .map((i, n) => `[${n + 1}] (${i.category || "uncategorized"} · signal ${i.signal_strength ?? 3}) ${i.text}`)
    .join("\n\n");

  const lexiconBlock = (lexicon || []).map((l) => `${l.term} (${l.type}, ${l.frequency}×)`).join(", ");

  const canonBlock = (canon || [])
    .map((c) => `- ${c.title} (${c.doc_type}): ${c.summary || "[no summary]"}`)
    .join("\n");

  const observationsBlock = (observations || [])
    .map((o) => {
      const date = new Date(o.created_at).toISOString().split("T")[0];
      const verbatim = o.user_verbatim ? `  [user said verbatim: "${o.user_verbatim}"]` : "";
      return `- [${o.type} · ${date}] ${o.text}${verbatim}`;
    })
    .join("\n");

  const craft = user.craft || DEFAULT_CRAFT;
  const overlay = OVERLAYS[craft] || OVERLAYS[DEFAULT_CRAFT];

  const systemPrompt = `${BACKBONE}

---

${overlay}

---

MODE: VOICECARD

You are writing a voice card — a peer-readable signature of how this specific creative thinks, drawn from their actual captures, canon, lexicon, and the AI's accumulated private observations about them. The card lives inside Signal as the user-layer that conditions every future AI response, so future calls read it. The user can also read and edit it, so the prose has to feel like recognition, not surveillance.

VOICE
- Plain register. Concrete nouns. The cadence of someone telling you something rather than presenting to you.
- No hype words (none of: elevate, delight, 10x, frictionless, growth hack, insightful, thoughtful, rich, sing, lyrical, seamless, intuitive, curated).
- No analyst voice. No therapy voice. No predictions about future behavior ("they'll likely pivot toward..."). No second-person ("you"). Third-person observational throughout.

STANCE
- DESCRIBE the user. Do NOT endorse them. No "their captures show thoughtful engagement", no "they have a strong sense of voice." No flattery in any form. The sycophancy guard is structural — if you find yourself reaching for a complimentary adjective, cut it.
- Catch patterns in HOW they think — what they return to, what they sidestep, the tension that keeps surfacing, the register they default to, what they take for granted.
- PERMISSIVE SYNTHESIS: patterns synthesized from many captures are fair game even if no single capture says them outright. The card is the senior peer's read after reading 30+ captures — that kind of inference is exactly what's wanted. ("He keeps returning to X" is a fair synthesis even if no capture explicitly says "I keep returning to X.")
- NO FABRICATED BIOGRAPHICAL CLAIMS. No invented context about who the user is outside what the captures, canon, and observations show. No "he grew up..." unless the canon says so. No predictions.
- Name the actual thing. If a specific capture, canon doc, or AI observation sharpens the description, reference it concretely.
- Reads like a senior peer in their craft (per the overlay above) describing them to a new collaborator joining the project mid-stream. Use the named-voices guidance from the overlay.

USE THE INPUTS HONESTLY
- Captures show HOW they capture: rhythm, vocabulary, what they bring back to.
- Canon docs show what they've put down as foundational: this is what the work is.
- Lexicon shows their distinctive vocabulary: use it where it fits naturally; don't list it.
- AI observations (if present) carry weight — they're the accumulated learning from prior interactions, including failure modes the AI has corrected for. If the observations show the user pushed back on a particular kind of suggestion, the card should reflect what that pushback revealed. The verbatim user quotes are gold — use the user's own words where they land.
- If a category of input is empty (e.g., no observations yet for a new user), don't reference its absence; just work with what's there.

INHERIT THE BACKBONE
- No fabricated confidence: if the inputs don't ground a claim, don't make it.
- No enabling laziness: the card sets a register the AI uses going forward; that register should hold the user accountable to their own work, not coddle them.
- Respect the craft's actively-NOT lists from the overlay above — don't use vocabulary or reach for reference figures the overlay marks as outsider tells or sub-canonical authorities.

LENGTH
200-400 words. Continuous prose. No bullet lists. No section headers.

DO NOT
- Include the phrase "voice card" or any self-referential meta
- Include bullet points or section headers
- Generic creative-process platitudes
- Predictions about what they'll do next
- Any sentence that could plausibly come from a chatbot, a dashboard, or an assistant
- Sycophancy in any form

Begin immediately with the prose.`;

  const userPrompt = `Craft: ${craft}
Project: ${user.project_name || "(unspecified)"}

Recent captures (most recent first, ${ideas.length} shown):
${captureBlock}
${lexicon?.length ? `\nDistinctive vocabulary (user's lexicon, top by frequency): ${lexiconBlock}` : ""}
${canon?.length ? `\nCanon documents (reference material):\n${canonBlock}` : ""}
${observations?.length ? `\nPrivate AI observations about this user (accumulated from prior interactions):\n${observationsBlock}` : ""}

Write the voice card.`;

  const data = await callClaude({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: MAX_TOKENS,
    model: HIGH_QUALITY_MODEL,
  });
  const signature = (data.content?.map((b) => b.text || "").join("") || "").trim();
  if (!signature) throw new Error("Claude returned empty signature");
  const wordCount = signature.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SIGNATURE_WORDS || wordCount > MAX_SIGNATURE_WORDS) {
    const err = new Error(`Signature word count out of envelope: ${wordCount} (expected ${MIN_SIGNATURE_WORDS}-${MAX_SIGNATURE_WORDS}). Refusing to swap.`);
    err.code = "SIGNATURE_ENVELOPE";
    err.preview = signature.slice(0, 200);
    throw err;
  }

  const { data: inserted, error: rpcErr } = await supabase.rpc("swap_active_voice_card", {
    p_user_id: user_id,
    p_signature: signature,
    p_is_user_edited: false,
  });
  if (rpcErr) throw new Error(`Swap failed: ${rpcErr.message}`);

  return {
    card_id: inserted.id,
    version: inserted.version,
    word_count: wordCount,
    captures_used: ideas.length,
    auth_id: user.auth_id,
  };
}
