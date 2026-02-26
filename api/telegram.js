// ============================================
// SIGNAL: Telegram Webhook
// api/telegram.js
// Receives replies from Telegram, captures as
// ideas, and can mark deliverables complete.
// ============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown" }),
  });
}

async function callAI(system, message) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg?.text || String(msg.chat?.id) !== TG_CHAT) {
      return res.status(200).json({ ok: true });
    }

    const text = msg.text.trim();

    // Command: /done <search term> — marks a deliverable complete
    if (text.startsWith("/done")) {
      const search = text.replace("/done", "").trim();
      if (!search) {
        await sendTelegram("Usage: /done <keyword from deliverable>");
        return res.status(200).json({ ok: true });
      }
      const { data: user } = await supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single();
      const { data: delivs } = await supabase.from("deliverables").select("id, text, is_complete").eq("user_id", user.id).eq("is_complete", false);
      const match = (delivs || []).find(d => d.text.toLowerCase().includes(search.toLowerCase()));
      if (match) {
        await supabase.from("deliverables").update({ is_complete: true }).eq("id", match.id);
        await sendTelegram(`✓ Done: "${match.text.slice(0, 80)}"\n\n${(delivs.length - 1)} actions remaining.`);
      } else {
        await sendTelegram(`No open deliverable matching "${search}". Try a different keyword.`);
      }
      return res.status(200).json({ ok: true });
    }

    // Command: /status — quick project status
    if (text === "/status") {
      const { data: user } = await supabase.from("users").select("id, project_name").order("created_at", { ascending: false }).limit(1).single();
      const { data: ideas } = await supabase.from("ideas").select("id").eq("user_id", user.id);
      const { data: delivs } = await supabase.from("deliverables").select("id, is_complete").eq("user_id", user.id);
      const pending = (delivs || []).filter(d => !d.is_complete).length;
      const done = (delivs || []).filter(d => d.is_complete).length;
      await sendTelegram(`*${user.project_name}*\n${(ideas || []).length} ideas · ${pending} open actions · ${done} completed`);
      return res.status(200).json({ ok: true });
    }

    // Command: /pulse — trigger a nudge
    if (text === "/pulse") {
      const pulseUrl = `https://signal-navy-five.vercel.app/api/pulse?mode=nudge`;
      await fetch(pulseUrl);
      return res.status(200).json({ ok: true });
    }

    // Default: capture as idea (same as WhatsApp flow)
    const { data: user } = await supabase.from("users").select("*").order("created_at", { ascending: false }).limit(1).single();
    if (!user) {
      await sendTelegram("No user found. Set up Signal first.");
      return res.status(200).json({ ok: true });
    }

    // AI analysis
    const analysis = await callAI(
      `You are a brilliant script editor and dramaturg. Analyze ideas across MULTIPLE dimensions simultaneously.
Respond ONLY with a raw JSON object — no markdown, no backticks, no explanation:
{
  "category": one of [premise,character,scene,dialogue,arc,production,research,business],
  "dimensions": array of 2-4 strings,
  "aiNote": "1-2 sentences of genuine dramaturgical insight",
  "deliverables": array of 2-3 next steps as invitations,
  "signalStrength": integer 1-5
}`,
      `Project: ${user.project_name}\n\nIdea: "${text}"`
    );

    let parsed;
    try {
      parsed = JSON.parse(analysis.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { category: "premise", dimensions: ["story"], aiNote: "Captured.", deliverables: [], signalStrength: 3 };
    }

    // Save idea
    const { data: newIdea } = await supabase.from("ideas").insert([{
      user_id: user.id,
      text,
      category: parsed.category,
      ai_note: parsed.aiNote,
      signal_strength: parsed.signalStrength,
      source: "telegram",
    }]).select().single();

    // Save deliverables
    if (parsed.deliverables?.length && newIdea) {
      await supabase.from("deliverables").insert(
        parsed.deliverables.map(d => ({ user_id: user.id, idea_id: newIdea.id, text: d }))
      );
    }

    // Save dimensions
    if (parsed.dimensions?.length && newIdea) {
      await supabase.from("dimensions").insert(
        parsed.dimensions.map(d => ({ idea_id: newIdea.id, dimension: d }))
      );
    }

    await sendTelegram(`◈ *Signal captured.*\n${parsed.aiNote}\n\nCategory: ${parsed.category}\nSignal: ${"◈".repeat(parsed.signalStrength)}\n\n_${parsed.deliverables?.[0] || "Sit with this idea."}_`);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.status(200).json({ ok: true }); // Always 200 for Telegram
  }
}
