// api/activation.js — Day-3 first-Pulse + Day-7 first-Studio activation cron
//
// Locked in SIGNAL-OPS · 5/7 · activation pattern lock:
//   Day 3: real Pulse if captures ≥ 3; else silent-presence one-liner (NOT
//          labeled as a Pulse — protects the Pulse brand on weak data).
//   Day 7: first Studio re-read announcement, regardless of capture count.
//
// Architecture: scans all users daily, fires per-user events when the user
// hits the qualifying day-since-signup AND the corresponding sent-at column
// is NULL. Stamps users.day3_pulse_sent_at / day7_studio_sent_at on success
// to prevent re-fires.
//
// Delivery (PoC): single global Telegram chat (TG_CHAT). Multi-user-aware
// delivery (per-user telegram_chat_id, email, in-app notification) is
// deferred to a follow-on chunk.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY3_CAPTURE_THRESHOLD = 3;

// Use signal-multi.vercel.app as canonical for internal cron→pulse hops.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://signal-multi.vercel.app";

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return { skipped: true, reason: "no telegram config" };
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown" }),
  });
  return res.json();
}

function daysSince(timestamp) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / DAY_MS);
}

async function captureCount(userId) {
  const { count } = await supabase
    .from("ideas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count || 0;
}

async function fireDay3Pulse(user) {
  // Trigger the existing pulse pipeline for this specific user.
  // pulse.js handles a per-user invocation when ?user_id= is present.
  const url = `${APP_URL}/api/pulse?user_id=${user.id}&mode=nudge`;
  const res = await fetch(url, { method: "GET" });
  return res.ok;
}

async function fireDay3SilentPresence(user) {
  const name = user.collaborator_name || "Signal";
  // Deliberately NOT labeled as a Pulse — see voice doc §1.7 + retention memo §6.
  const msg = `Still here when you are. — ${name}`;
  await sendTelegram(msg);
  return true;
}

async function fireDay7StudioAnnouncement(user) {
  const name = user.collaborator_name || "Signal";
  const project = user.project_name || "your project";
  const msg = `Your first Studio re-read on *${project}* is ready. Open Signal and tap Studio to see what's pattern in your captures so far.\n\n— ${name}\n${APP_URL}`;
  await sendTelegram(msg);
  return true;
}

async function processUser(user, dryRun) {
  const days = daysSince(user.created_at);
  const events = [];

  // Day-3 activation
  if (days >= 3 && !user.day3_pulse_sent_at) {
    const captures = await captureCount(user.id);
    const variant = captures >= DAY3_CAPTURE_THRESHOLD ? "pulse" : "silent_presence";
    events.push({ user_id: user.id, day: 3, variant, captures });

    if (!dryRun) {
      const ok = variant === "pulse"
        ? await fireDay3Pulse(user)
        : await fireDay3SilentPresence(user);

      if (ok) {
        await supabase
          .from("users")
          .update({ day3_pulse_sent_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }
  }

  // Day-7 activation
  if (days >= 7 && !user.day7_studio_sent_at) {
    events.push({ user_id: user.id, day: 7, variant: "studio_announcement" });

    if (!dryRun) {
      const ok = await fireDay7StudioAnnouncement(user);
      if (ok) {
        await supabase
          .from("users")
          .update({ day7_studio_sent_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }
  }

  return events;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dryRun = req.query?.dry_run === "1" || req.query?.dry_run === "true";
  const userId = req.query?.user_id || null;

  try {
    let q = supabase
      .from("users")
      .select("id, project_name, collaborator_name, created_at, day3_pulse_sent_at, day7_studio_sent_at");
    if (userId) q = q.eq("id", userId);

    const { data: users, error } = await q;
    if (error) throw error;

    const allEvents = [];
    for (const user of users || []) {
      const events = await processUser(user, dryRun);
      allEvents.push(...events);
    }

    return res.status(200).json({
      ok:        true,
      dry_run:   dryRun,
      scanned:   users?.length || 0,
      fired:     allEvents.length,
      events:    allEvents,
    });
  } catch (err) {
    console.error("Activation error:", err);
    return res.status(500).json({ error: err.message });
  }
}
