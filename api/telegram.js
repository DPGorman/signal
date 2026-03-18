import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
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

async function callAI(system, message) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, system, messages: [{ role: "user", content: message }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function getUser() {
  const { data } = await supabase.from("users").select("*").order("created_at", { ascending: true }).limit(1).single();
  return data;
}

async function getProject(userId) {
  const { data } = await supabase.from("projects").select("id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).single();
  return data;
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

    // Default: capture idea
    const user = await getUser();
    if (!user) { await sendTelegram(chatId, "No user found."); return res.status(200).json({ ok: true }); }
    const project = await getProject(user.id);

    const analysis = await callAI(
      `You are a script editor. Analyze this idea. Respond ONLY with raw JSON, no markdown:
{"category":"one of premise/character/scene/dialogue/arc/production/research/business","aiNote":"1-2 sentences of insight","deliverables":["next step 1","next step 2"],"signalStrength":3}`,
      `Project: ${user.project_name}\n\nIdea: "${text}"`
    );

    let parsed;
    try { parsed = JSON.parse(analysis.replace(/```json|```/g, "").trim()); }
    catch { parsed = { category: "premise", aiNote: "Captured.", deliverables: [], signalStrength: 3 }; }

    const { data: newIdea } = await supabase.from("ideas").insert([{
      user_id: user.id, text, category: parsed.category,
      ai_note: parsed.aiNote, signal_strength: parsed.signalStrength,
      source: "telegram", project_id: project?.id || null,
    }]).select().single();

    if (parsed.deliverables?.length && newIdea) {
      await supabase.from("deliverables").insert(
        parsed.deliverables.map(d => ({ user_id: user.id, idea_id: newIdea.id, text: d, project_id: project?.id || null }))
      );
    }

    await sendTelegram(chatId, `◈ *Signal captured.*\n${parsed.aiNote}\n\nCategory: ${parsed.category}\nSignal: ${"◈".repeat(parsed.signalStrength)}`);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Telegram webhook error:", error.message);
    return res.status(200).json({ ok: true, error: error.message });
  }
}
