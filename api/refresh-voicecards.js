// api/refresh-voicecards.js — daily voice-card auto-refresh cron.
//
// Per v19 §5 + voice doc v2.3: refresh each user's voice card every 30
// project_material captures OR every 14 days, whichever comes first. Never
// overwrite a voice card the user has manually edited.
//
// AUTH MODES:
//   GET  (cron):    Authorization: Bearer <CRON_SECRET> → iterate eligible users.
//   POST (manual):  Authorization: Bearer <user JWT> + body { user_id } →
//                   single user, owner check enforced. Skips eligibility check
//                   (treat as an admin-style force-refresh). Use for testing
//                   or letting a user opt-in to a fresh card on demand.
//
// FREQUENCY: vercel.json cron entry runs daily at 10:00 UTC. Per-user
// throttling is enforced by the eligibility check, so a daily sweep is fine.
//
// COST: ~5K input + ~400 output per refreshed user with HIGH_QUALITY_MODEL.

import { supabase } from "./_supabase.js";
import { isCronAuthorized, getAuthedUser } from "./_auth.js";
import { generateVoiceCard } from "./_voice/voicecard-core.js";

const REFRESH_CAPTURE_THRESHOLD = 30;
const REFRESH_DAYS_THRESHOLD = 14;

export default async function handler(req, res) {
  const isPost = req.method === "POST";
  const isGet = req.method === "GET";
  if (!isPost && !isGet) return res.status(405).end();

  let targetUserIds = [];
  let forceMode = false;

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
    forceMode = true;
  } else {
    if (!isCronAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    targetUserIds = await findEligibleUsers();
  }

  const results = [];
  for (const user_id of targetUserIds) {
    try {
      const r = await generateVoiceCard(user_id);
      results.push({ user_id, refreshed: true, card_id: r.card_id, version: r.version, word_count: r.word_count, captures_used: r.captures_used });
    } catch (e) {
      console.error(`refresh-voicecards failed for ${user_id}:`, e.message);
      results.push({ user_id, refreshed: false, error: e.message, code: e.code });
    }
  }

  return res.status(200).json({
    mode: forceMode ? "force" : "cron",
    users_processed: results.length,
    users_refreshed: results.filter((r) => r.refreshed).length,
    results,
  });
}

async function findEligibleUsers() {
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id")
    .eq("onboarding_complete", true);
  if (usersErr) throw new Error(`users load failed: ${usersErr.message}`);

  const eligible = [];
  const nowMs = Date.now();

  for (const u of users || []) {
    const { data: card } = await supabase
      .from("user_voice_card")
      .select("id, created_at, is_user_edited")
      .eq("user_id", u.id)
      .eq("is_active", true)
      .maybeSingle();

    // No active card yet → not eligible for refresh (cron doesn't generate
    // first-ever cards; that's a UI/onboarding flow). Skip.
    if (!card) continue;

    // User has manually edited their card → respect that absolutely.
    if (card.is_user_edited) continue;

    const ageDays = (nowMs - new Date(card.created_at).getTime()) / 86400_000;

    let triggerByAge = ageDays >= REFRESH_DAYS_THRESHOLD;
    let triggerByCaptures = false;

    if (!triggerByAge) {
      const { count } = await supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id)
        .eq("kind", "project_material")
        .gt("created_at", card.created_at);
      triggerByCaptures = (count || 0) >= REFRESH_CAPTURE_THRESHOLD;
    }

    if (triggerByAge || triggerByCaptures) eligible.push(u.id);
  }

  return eligible;
}
