// api/augment-observations.js — weekly augmentation of ai_observations
//
// Pattern-finds across the user's recent captures + canon + lexicon and writes
// 3-7 observations to ai_observations per user. Designed to be the ongoing
// "the AI is learning about you" signal that voicecard v2 reads — without
// requiring the user to run studio or generate high-signal captures.
//
// Per voice doc v2.3 §20 + v18 lock-in #14 (ai_observations is the AI's
// private knowledge layer, append-only, RLS-locked).
//
// AUTH MODES:
//   GET  (cron):       Authorization: Bearer <CRON_SECRET> → iterate over
//                      eligible users (onboarding_complete=true, captured in
//                      last 60 days), one Claude call per user.
//   POST (manual):     Authorization: Bearer <user JWT> + body { user_id }
//                      → single user, owner check enforced. Used for backfill
//                      and on-demand augmentation from the UI.
//
// FREQUENCY: Vercel cron entry runs weekly, Sundays 12:00 UTC (4am PT).
//
// COST: ~5K input + ~1K output per user with HIGH_QUALITY_MODEL.

import { supabase } from "./_supabase.js";
import { callClaude, HIGH_QUALITY_MODEL, extractText } from "./_anthropic.js";
import { isCronAuthorized, getAuthedUser } from "./_auth.js";
import { BACKBONE } from "./_voice/backbone.js";
import { OVERLAYS } from "./_voice/overlays.js";

const MIN_CAPTURES = 5;
const MAX_CAPTURES_SAMPLE = 100;
const CAPTURE_LOOKBACK_DAYS = 60;
const MAX_LEXICON = 30;
const MAX_EXISTING_OBSERVATIONS = 30;
const MAX_TOKENS = 1500;
const DEFAULT_CRAFT = "screenwriter";
const USER_LOOKBACK_DAYS = 60;

export default async function handler(req, res) {
  const isPost = req.method === "POST";
  const isGet = req.method === "GET";
  if (!isPost && !isGet) return res.status(405).end();

  let targetUserIds = [];

  if (isPost) {
    const authUser = await getAuthedUser(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, auth_id")
      .eq("id", user_id)
      .single();
    if (userErr || !user) return res.status(404).json({ error: "user not found" });
    if (user.auth_id !== authUser.id) {
      return res.status(403).json({ error: "Forbidden: user_id does not match authenticated user" });
    }
    targetUserIds = [user_id];
  } else {
    if (!isCronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const sinceIso = new Date(Date.now() - USER_LOOKBACK_DAYS * 86400_000).toISOString();
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id")
      .eq("onboarding_complete", true);
    if (usersErr) return res.status(500).json({ error: usersErr.message });
    const eligible = [];
    for (const u of users || []) {
      const { count } = await supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id)
        .gte("created_at", sinceIso);
      if ((count || 0) >= MIN_CAPTURES) eligible.push(u.id);
    }
    targetUserIds = eligible;
  }

  const results = [];
  for (const user_id of targetUserIds) {
    try {
      const r = await augmentForUser(user_id);
      results.push({ user_id, ...r });
    } catch (e) {
      console.error(`augment-observations failed for ${user_id}:`, e);
      results.push({ user_id, error: e.message });
    }
  }

  const totalWritten = results.reduce((s, r) => s + (r.written || 0), 0);
  return res.status(200).json({
    users_processed: results.length,
    observations_written: totalWritten,
    results,
  });
}

async function augmentForUser(user_id) {
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, craft, collaborator_name, project_name")
    .eq("id", user_id)
    .single();
  if (userErr || !user) throw new Error(`user lookup failed: ${userErr?.message || "not found"}`);

  const sinceIso = new Date(Date.now() - CAPTURE_LOOKBACK_DAYS * 86400_000).toISOString();
  const { data: ideas, error: ideasErr } = await supabase
    .from("ideas")
    .select("id, text, ai_note, category, signal_strength, kind, created_at")
    .eq("user_id", user_id)
    .in("kind", ["project_material"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(MAX_CAPTURES_SAMPLE);
  if (ideasErr) throw new Error(`ideas load failed: ${ideasErr.message}`);
  if (!ideas || ideas.length < MIN_CAPTURES) {
    return { written: 0, skipped: true, reason: `only ${ideas?.length || 0} project_material captures in ${CAPTURE_LOOKBACK_DAYS}d (need ≥${MIN_CAPTURES})` };
  }

  const { data: lexicon } = await supabase
    .from("user_lexicon")
    .select("term, type, frequency")
    .eq("user_id", user_id)
    .order("frequency", { ascending: false })
    .limit(MAX_LEXICON);

  const { data: canon } = await supabase
    .from("canon_documents")
    .select("title, doc_type, summary")
    .eq("user_id", user_id)
    .eq("is_active", true);

  const { data: existingObs } = await supabase
    .from("ai_observations")
    .select("type, text, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(MAX_EXISTING_OBSERVATIONS);

  const captureBlock = ideas
    .map((i, n) => `[${n + 1}] (${i.category || "uncategorized"} · signal ${i.signal_strength ?? 3} · ${new Date(i.created_at).toISOString().split("T")[0]}) ${i.text}${i.ai_note ? `\n     ai_note: ${i.ai_note}` : ""}`)
    .join("\n\n");

  const lexiconBlock = (lexicon || [])
    .map((l) => `${l.term} (${l.type}, ${l.frequency}×)`)
    .join(", ");

  const canonBlock = (canon || [])
    .map((c) => `- ${c.title} (${c.doc_type}): ${c.summary || "[no summary]"}`)
    .join("\n");

  const existingObsBlock = (existingObs || [])
    .map((o) => `- [${o.type} · ${new Date(o.created_at).toISOString().split("T")[0]}] ${o.text}`)
    .join("\n");

  const craft = user.craft || DEFAULT_CRAFT;
  const overlay = OVERLAYS[craft] || OVERLAYS[DEFAULT_CRAFT];
  const collaboratorPhrase = user.collaborator_name ? ` with ${user.collaborator_name}` : "";
  const projectPhrase = user.project_name ? ` (project: "${user.project_name}")` : "";

  const system = `${BACKBONE}

${overlay}

────────────────────────────────────────
MODE: AUGMENT-OBSERVATIONS

You are writing to the AI's private knowledge layer about this specific ${craft}${projectPhrase}${collaboratorPhrase}. The user never sees these observations directly — they feed future Claude calls (voice card synthesis, studio passes, capture analysis) so the system gets sharper about who this person is and what their work is becoming.

Your job: find patterns ACROSS captures that no single capture states. Synthesis is permitted (per voice doc v2.3 §11). Fabrication is not. If you cannot ground a pattern in two or more specific captures (or one capture plus a canon doc), do not write it.

OBSERVATION TYPES (pick whichever apply; not all need to be present):

- pattern_recurrence — "X keeps surfacing across [captures 3, 7, 12]"
- pattern_contradiction — "captures 4 and 9 propose different solutions to the same problem"
- canon_divergence — "captures pull toward [X] while canon points at [Y]"
- gap_silence — "[topic central to canon] is absent from captures"
- register_drift — "lexicon has shifted from [old] to [new] over [period]"
- sharpening_signal — "captures since [date] show tighter language around [concept]"
- practitioner_phase — "user's working pressure right now appears to be [X]" (only if multiple captures support it; do not infer from a single sentence)

QUALITY BAR:

- Peer voice, declarative, no flattery, no recap (BACKBONE rules apply).
- 1-3 sentences per observation. Concrete: name the specific captures by their bracketed indices.
- Don't repeat existing observations (shown below). Add what's NEW since they were written.
- If after reviewing the captures + canon you have nothing genuinely new and grounded, return {"observations": []}. Empty is correct; padding is not.

────────────────────────────────────────
RECENT CAPTURES (${ideas.length}, last ${CAPTURE_LOOKBACK_DAYS} days, project_material only):

${captureBlock}

────────────────────────────────────────
LEXICON (top ${(lexicon || []).length} by frequency):

${lexiconBlock || "[empty]"}

────────────────────────────────────────
CANON (${(canon || []).length} active docs):

${canonBlock || "[none]"}

────────────────────────────────────────
EXISTING OBSERVATIONS (most recent ${(existingObs || []).length}; do not repeat):

${existingObsBlock || "[none yet]"}

────────────────────────────────────────
OUTPUT FORMAT — return JSON only, no preamble:

{
  "observations": [
    {
      "type": "pattern_recurrence",
      "text": "Park's silence keeps doing more work than his dialogue in captures [3, 8, 14]. The character speaks only when he's correcting Ava, never volunteering.",
      "evidence_indices": [3, 8, 14]
    }
  ]
}

3-7 observations is the typical range. Empty array is valid.`;

  const completion = await callClaude({
    system,
    messages: [{ role: "user", content: "Augment." }],
    maxTokens: MAX_TOKENS,
    model: HIGH_QUALITY_MODEL,
  });

  const raw = extractText(completion).trim();
  let parsed;
  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("no JSON object found");
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } catch (e) {
    throw new Error(`failed to parse augmentation response: ${e.message}; raw[0..200]=${raw.slice(0, 200)}`);
  }

  const rows = (parsed.observations || [])
    .filter((o) => o && typeof o.type === "string" && typeof o.text === "string" && o.text.trim().length > 0)
    .map((o) => {
      const indices = Array.isArray(o.evidence_indices) ? o.evidence_indices.filter((n) => Number.isInteger(n) && n >= 1 && n <= ideas.length) : [];
      const evidenceIds = indices.map((n) => ideas[n - 1].id);
      return {
        user_id,
        type: `augment_${o.type}`,
        text: o.text.trim(),
        source_type: "augment_cron",
        context: { evidence_capture_ids: evidenceIds, evidence_indices: indices, sample_size: ideas.length },
      };
    });

  if (rows.length === 0) return { written: 0, parsed: parsed.observations?.length || 0 };

  const { error: insertErr } = await supabase.from("ai_observations").insert(rows);
  if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);

  return { written: rows.length, parsed: parsed.observations?.length || 0 };
}
