// api/voicecard/generate.js — voice-card generator
//
// POST { user_id }
// → 200 { success: true, card_id, version, word_count }
// → 4xx { error: "..." }
//
// Reads the user's captures, lexicon, canon, and craft. Asks Claude to write
// a 200–400 word peer-readable signature describing how the user thinks.
// Deactivates the prior active card, inserts the new one at version+1.
//
// Per voice doc v2.1 §15.2: voice card describes the user, never endorses.
// Sycophancy-guarded by structural prompt design.
//
// Refresh cadence is the caller's concern (iOS button + every 30 captures /
// 14 days via a cron we haven't wired yet). This endpoint is idempotent only
// in the sense that calling it twice produces two new versions, not in the
// sense that it dedupes.

import { supabase } from "../_supabase.js";
import { callClaude, HIGH_QUALITY_MODEL } from "../_anthropic.js";

const MIN_CAPTURES = 5;
const MAX_CAPTURES_SAMPLE = 100;
const MAX_TOKENS = 1200;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  // ─── 1. Load user profile ─────────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, craft, collaborator_name, project_name")
    .eq("id", user_id)
    .single();
  if (userErr) {
    console.error("voicecard/generate: user lookup failed:", userErr.message);
    return res.status(500).json({ error: userErr.message });
  }
  if (!user) return res.status(404).json({ error: "user not found" });

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

  // ─── 5. Build prompts ─────────────────────────────────────────────────
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

  const craft = user.craft || "screenwriter";

  const systemPrompt = `You are writing a voice card — a peer-readable signature of how a specific creative thinks, drawn from their actual captures and reference material. The card will live inside Signal as the user-layer that conditions every AI response, so it is read by future Signal calls, not by the user themselves.

VOICE
- Plain register. Concrete nouns. The cadence of someone telling you something rather than presenting to you.
- No hype words: no "elevate", "delight", "10x", "frictionless", "growth hack", "insightful", "thoughtful", "rich".
- No analyst voice. No therapy voice. No predictions about what they'll do next. No second-person ("you") — write in third-person observational mode.

STANCE
- DESCRIBE the user. Do NOT endorse them. No "their captures show thoughtful engagement", no "they have a strong sense of voice", no flattery in any form.
- Catch patterns in HOW they think — what they return to, what they sidestep, the tension that keeps surfacing, the register they default to, what they take for granted.
- Name the actual thing. If a specific capture or canon doc sharpens the description, reference it concretely.
- Reads like a senior peer in their craft (${craft}) describing them to a new collaborator joining the project mid-stream.

LENGTH
200–400 words. Continuous prose. No bullet lists. No section headers.

DO NOT include
- The phrase "voice card" or any self-referential meta ("this card describes…")
- Bullet points or headers
- Generic creative-process platitudes
- Predictions ("they'll likely pivot toward…")
- Any sentence that could plausibly come from a chatbot, a dashboard, or an assistant

Output only the prose. Begin immediately.`;

  const userPrompt = `Craft: ${craft}
Project: ${user.project_name || "(unspecified)"}

Recent captures (most recent first, ${ideas.length} shown):
${captureBlock}
${lexicon?.length ? `\nDistinctive vocabulary: ${lexiconBlock}` : ""}
${canon?.length ? `\nCanon documents (reference material):\n${canonBlock}` : ""}

Write the voice card.`;

  // ─── 6. Call Claude (Opus for higher signature quality on this low-volume endpoint) ──
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

  // ─── 7. Determine new version ─────────────────────────────────────────
  const { data: currentActive } = await supabase
    .from("user_voice_card")
    .select("id, version")
    .eq("user_id", user_id)
    .eq("is_active", true)
    .maybeSingle();

  const newVersion = (currentActive?.version || 0) + 1;

  // ─── 8. Deactivate old card (partial unique index requires this) ──────
  if (currentActive) {
    const { error: deactErr } = await supabase
      .from("user_voice_card")
      .update({ is_active: false })
      .eq("id", currentActive.id);
    if (deactErr) {
      console.error("voicecard/generate: deactivate failed:", deactErr.message);
      return res.status(500).json({ error: `Deactivate failed: ${deactErr.message}` });
    }
  }

  // ─── 9. Insert new card ───────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("user_voice_card")
    .insert({
      user_id,
      signature,
      version: newVersion,
      is_active: true,
      is_user_edited: false,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("voicecard/generate: insert failed:", insertErr.message);
    return res.status(500).json({ error: `Insert failed: ${insertErr.message}` });
  }

  // ─── 10. Done ─────────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    card_id: inserted.id,
    version: newVersion,
    word_count: signature.split(/\s+/).filter(Boolean).length,
  });
}
