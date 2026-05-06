// Telegram bot — capture-and-relay only.
// Per 2026-05-07 decision: keep both Telegram and WhatsApp bots functional, but
// deliberately dumb. Each bot saves the raw text to the ideas table with
// source="telegram"|"whatsapp" and replies with a confirmation. The desktop and
// iOS apps run the rich pipeline (voice overlay analysis, lexicon writes,
// invitations with due dates, connection generation) when the user opens them.
// Rationale: keeping the bots simple means a global user on WhatsApp/Telegram
// gets zero-friction capture without us maintaining three parallel AI pipelines.
// The workstation (web/iOS) does the work; the messaging surface is a write-only
// inbox into the same canon.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const data = await res.json();
  if (!data.ok) console.error("Telegram send error:", JSON.stringify(data));
  return data;
}

async function getUser() {
  const { data } = await supabase.from("users").select("*").order("created_at", { ascending: true }).limit(1);
  return data?.[0] || null;
}

async function getProject(userId) {
  const { data } = await supabase.from("projects").select("id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
  return data?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const msg = req.body?.message;
    const chatId = msg?.chat?.id;
    const text = msg?.text?.trim();

    if (!text || !chatId) return res.status(200).json({ ok: true });

    // /done
    if (text.startsWith("/done")) {
      const search = text.replace("/done", "").trim();
      if (!search) { await sendTelegram(chatId, "Usage: /done <keyword from deliverable>"); return res.status(200).json({ ok: true }); }
      const user = await getUser();
      const { data: delivs } = await supabase.from("deliverables").select("id, text").eq("user_id", user.id).eq("is_complete", false);
      const match = (delivs || []).find(d => d.text.toLowerCase().includes(search.toLowerCase()));
      if (match) {
        await supabase.from("deliverables").update({ is_complete: true }).eq("id", match.id);
        await sendTelegram(chatId, `✓ Done: "${match.text.slice(0, 80)}"\n\n${(delivs.length - 1)} actions remaining.`);
      } else {
        await sendTelegram(chatId, `No open deliverable matching "${search}".`);
      }
      return res.status(200).json({ ok: true });
    }

    // /status
    if (text === "/status") {
      const user = await getUser();
      const { data: ideas } = await supabase.from("ideas").select("id").eq("user_id", user.id);
      const { data: delivs } = await supabase.from("deliverables").select("id, is_complete").eq("user_id", user.id);
      const pending = (delivs || []).filter(d => !d.is_complete).length;
      const done = (delivs || []).filter(d => d.is_complete).length;
      await sendTelegram(chatId, `*${user.project_name}*\n${(ideas || []).length} ideas · ${pending} open actions · ${done} completed`);
      return res.status(200).json({ ok: true });
    }

    // /pulse
    if (text === "/pulse") {
      await sendTelegram(chatId, "Generating pulse...");
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://signal-navy-five.vercel.app";
      const user = await getUser();
      await fetch(`${baseUrl}/api/pulse?mode=nudge`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      return res.status(200).json({ ok: true });
    }

    // Default: capture idea (capture-and-relay only — no AI analysis here).
    // The idea sits as raw text in the ideas table. When the user next opens
    // the desktop or iOS app, the workstation runs the rich pipeline.
    const user = await getUser();
    if (!user) { await sendTelegram(chatId, "No user found."); return res.status(200).json({ ok: true }); }
    const project = await getProject(user.id);

    await supabase.from("ideas").insert([{
      user_id: user.id,
      text,
      source: "telegram",
      project_id: project?.id || null,
    }]);

    await sendTelegram(chatId, "◈ *Signal captured.*\nOpen the app to see the analysis.");

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Telegram webhook error:", error.message);
    return res.status(200).json({ ok: true, error: error.message });
  }
}
