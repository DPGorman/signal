// api/voicecard/generate.js — voice-card generator (v2)
//
// POST { user_id }
// → 200 { success: true, card_id, version, word_count }
// → 4xx { error: "..." }
//
// Thin endpoint wrapper around the shared core at api/_voice/voicecard-core.js.
// Handles user-JWT auth + owner check, then delegates the generation +
// atomic swap to the shared helper. The same helper is called by the cron
// endpoint /api/refresh-voicecards (different auth, same generation).
//
// v2 behavior (2026-05-16 workshop) lives in voicecard-core.js: craft overlay
// + BACKBONE + ai_observations reads + permissive synthesis + atomic swap via
// swap_active_voice_card RPC.

import { supabase } from "../_supabase.js";
import { getAuthedUser } from "../_auth.js";
import { generateVoiceCard } from "../_voice/voicecard-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const authUser = await getAuthedUser(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const { data: ownerCheck, error: ownerErr } = await supabase
    .from("users")
    .select("id, auth_id")
    .eq("id", user_id)
    .single();
  if (ownerErr || !ownerCheck) return res.status(404).json({ error: "user not found" });
  if (ownerCheck.auth_id !== authUser.id) {
    return res.status(403).json({ error: "Forbidden: user_id does not match authenticated user" });
  }

  try {
    const result = await generateVoiceCard(user_id);
    return res.status(200).json({
      success: true,
      card_id: result.card_id,
      version: result.version,
      word_count: result.word_count,
    });
  } catch (e) {
    console.error("voicecard/generate failed:", e.message);
    const status = e.code === "INSUFFICIENT_CAPTURES" ? 400 : e.code === "SIGNATURE_ENVELOPE" ? 500 : 500;
    return res.status(status).json({ error: e.message, code: e.code });
  }
}
