// api/voicecard/generate.js — voice-card generator (v2)
//
// POST { user_id }
// → 200 { success: true, card_id, version, word_count }
// → 4xx { error: "..." }
//
// Reads the user's craft + collaborator name, recent captures, top-30 lexicon,
// active canon summaries, and the AI's accumulated private observations about
// the user (from ai_observations). Asks Claude to write a 200-400 word
// peer-readable signature describing how the user thinks.
//
// v2 changes (2026-05-16 workshop):
// - Pulls the craft overlay (per-craft vocabulary, success patterns,
//   actively-NOT lists, 7th-field dimensions, named voices) into the system
//   prompt. Was previously craft-agnostic.
// - Inherits the BACKBONE rules (no fabricated confidence, no enabling
//   laziness, peer-not-assistant, dead-words ban).
// - Reads from ai_observations (private AI knowledge layer) so the card
//   benefits from the AI's accumulated learning about this specific user.
// - Permissive synthesis allowed (patterns drawn from many captures are fair
//   game); biographical fabrication and predictions still forbidden.
//
// Deactivates the prior active card, inserts the new one at version+1.
// Per voice doc v2.1 §15.2: the voice card describes the user, never endorses.
// Sycophancy-guarded by structural prompt design.

import { supabase } from "../_supabase.js";
import { callClaude, HIGH_QUALITY_MODEL } from "../_anthropic.js";
import { getAuthedUser } from "../_auth.js";
import { BACKBONE } from "../_voice/backbone.js";
import { OVERLAYS } from "../_voice/overlays.js";

const MIN_CAPTURES = 5;
const MAX_CAPTURES_SAMPLE = 100;
const MAX_OBSERVATIONS = 30;
const MAX_TOKENS = 1200;
const DEFAULT_CRAFT = "screenwriter";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Require a signed-in user. Each generation costs Opus tokens and mutates
  // user_voice_card (deactivates current, inserts new), so anonymous access
  // is a drain/spam vector.
  const authUser = await getAuthedUser(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  // ─── 1. Load user profile + verify ownership ─────────────────────────
  // Map the JWT's auth_id to the application users.id and confirm the body's
  // user_id matches. Prevents an authenticated user from generating cards
  // against someone else's account.
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, auth_id, craft, collaborator_name, project_name")
    .eq("id", user_id)
    .single();
  if (userErr) {
    console.error("voicecard/generate: user lookup failed:", userErr.message);
    return res.status(500).json({ error: userErr.message });
  }
  if (!user) return res.status(404).json({ error: "user not found" });
  if (user.auth_id !== authUser.id) {
    return res.status(403).json({ error: "Forbidden: user_id does not match authenticated user" });
  }

  // ─── 2. Load captures (most recent N) ─────────────────────────────────
  const { data: ideas, error: ideasErr } = await supabase
    .from("ideas")
    .select("text, ai_note, category, signal_strength, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(MAX_CAPTURES_SAMPLE);
  if (ideasErr) {
    console.error("voicecard/generate: ideas load failed:", ideasErr.message);
    return res.status(500).json({ error: ideasErr.message });
  }
  if (!ideas || ideas.length < MIN_CAPTURES) {
    return res.status(400).json({
      error: `Need at least ${MIN_CAPTURES} captures to generate a voice card. Currently: ${ideas?.length || 0}.`,
    });
  }

  // ─── 3. Load lexicon (top 30 by frequency) ────────────────────────────
  const { data: lexicon } = await supabase
    .from("user_lexicon")
    .select("term, type, frequency")
    .eq("user_id", user_id)
    .order("frequency", { ascending: false })
    .limit(30);

  // ─── 4. Load active canon docs (summaries only) ───────────────────────
  const { data: canon } = await supabase
    .from("canon_documents")
    .select("title, doc_type, summary")
    .eq("user_id", user_id)
    .eq("is_active", true);

  // ─── 5. NEW — Load recent AI observations (private knowledge layer) ────
  // This is what gives the card the AI's accumulated learning. May be empty
  // for new users; that's fine — the prompt handles the empty case.
  const { data: observations } = await supabase
    .from("ai_observations")
    .select("type, text, user_verbatim, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(MAX_OBSERVATIONS);

  // ─── 6. Format blocks ─────────────────────────────────────────────────
  const captureBlock = ideas
    .map(
      (i, n) =>
        `[${n + 1}] (${i.category || "uncategorized"} · signal ${i.signal_strength ?? 3}) ${i.text}`
    )
    .join("\n\n");

  const lexiconBlock = (lexicon || [])
    .map((l) => `${l.term} (${l.type}, ${l.frequency}×)`)
    .join(", ");

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

  // ─── 7. Build system prompt: BACKBONE + OVERLAY + voicecard mode ──────
  // We inline the system prompt rather than using assemble.js because:
  // - We need to skip voice-card injection (we're generating it, not reading it)
  // - Voice card generation is infrequent (every 30 captures / 14 days), so
  //   the caching benefit of assemble.js is marginal
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

  // ─── 8. User-message: runtime context ─────────────────────────────────
  const userPrompt = `Craft: ${craft}
Project: ${user.project_name || "(unspecified)"}

Recent captures (most recent first, ${ideas.length} shown):
${captureBlock}
${lexicon?.length ? `\nDistinctive vocabulary (user's lexicon, top by frequency): ${lexiconBlock}` : ""}
${canon?.length ? `\nCanon documents (reference material):\n${canonBlock}` : ""}
${observations?.length ? `\nPrivate AI observations about this user (accumulated from prior interactions):\n${observationsBlock}` : ""}

Write the voice card.`;

  // ─── 9. Call Claude (Opus for higher signature quality on this low-volume endpoint) ──
  let signature;
  try {
    const data = await callClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: MAX_TOKENS,
      model: HIGH_QUALITY_MODEL,
    });
    signature = (data.content?.map((b) => b.text || "").join("") || "").trim();
    if (!signature) {
      return res.status(500).json({ error: "Claude returned empty signature" });
    }
  } catch (e) {
    console.error("voicecard/generate: Claude call failed:", e.message);
    return res.status(e.status || 500).json({ error: e.body || e.message });
  }

  // ─── 10. Atomic swap via swap_active_voice_card RPC ───────────────────
  // The RPC runs deactivate + insert in a single transaction, so a mid-flight
  // failure can't leave the user with no active card. The partial unique
  // index on (user_id) WHERE is_active = TRUE is satisfied at commit time.
  const { data: inserted, error: rpcErr } = await supabase.rpc(
    "swap_active_voice_card",
    {
      p_user_id: user_id,
      p_signature: signature,
      p_is_user_edited: false,
    }
  );
  if (rpcErr) {
    console.error("voicecard/generate: swap failed:", rpcErr.message);
    return res.status(500).json({ error: `Swap failed: ${rpcErr.message}` });
  }

  // ─── 11. Done ─────────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    card_id: inserted.id,
    version: inserted.version,
    word_count: signature.split(/\s+/).filter(Boolean).length,
  });
}
