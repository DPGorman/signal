// ============================================
// SIGNAL: Pulse — Daily Creative Nudge Engine
// api/pulse.js — Telegram + Canon-aware
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown" }),
  });
  const data = await res.json();
  if (!data.ok) console.error("Telegram error:", data);
  return data;
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
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: message }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mode = req.query?.mode || req.body?.mode || "nudge";

  try {
    const { data: user } = await supabase
      .from("users").select("*")
      .order("created_at", { ascending: false })
      .limit(1).single();

    if (!user) return res.status(400).json({ error: "No user found" });

    const [
      { data: ideas },
      { data: deliverables },
      { data: canonDocs },
      { data: connections },
    ] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("deliverables").select("*, idea:ideas(text, category)").eq("user_id", user.id),
      supabase.from("canon_documents").select("id, title, content, is_active").eq("user_id", user.id).eq("is_active", true),
      supabase.from("connections").select("*"),
    ]);

    const pending = (deliverables || []).filter(d => !d.is_complete);
    const completed = (deliverables || []).filter(d => d.is_complete);
    const recentIdeas = (ideas || []).filter(i => Date.now() - new Date(i.created_at) < 3 * 86400000);

    const connCounts = {};
    (connections || []).forEach(c => {
      connCounts[c.idea_id_a] = (connCounts[c.idea_id_a] || 0) + 1;
      connCounts[c.idea_id_b] = (connCounts[c.idea_id_b] || 0) + 1;
    });
    const nerveCenters = (ideas || [])
      .map(i => ({ ...i, connCount: connCounts[i.id] || 0 }))
      .sort((a, b) => b.connCount - a.connCount)
      .slice(0, 5);

    const catActivity = {};
    (ideas || []).forEach(i => {
      const age = Date.now() - new Date(i.created_at);
      if (!catActivity[i.category] || age < catActivity[i.category]) catActivity[i.category] = age;
    });
    const staleCats = Object.entries(catActivity).filter(([, age]) => age > 7 * 86400000).map(([cat]) => cat);

    // Canon summaries — first 800 chars of each active doc
    const canonSummaries = (canonDocs || []).map(d => 
      `[${d.title}]: ${(d.content || "").slice(0, 800)}`
    ).join("\n\n");

    if (mode === "checkin") {
      const msg = `Good morning Daniel. Before I crack the whip — what's on your agenda today? What feels most pressing right now?\n\nReply here. Or type /status for a project snapshot.`;
      await sendTelegram(msg);
      return res.status(200).json({ sent: true, mode: "checkin", message: msg });
    }

    const context = `PROJECT: ${user.project_name}
STATS: ${(ideas || []).length} ideas, ${pending.length} open actions, ${completed.length} completed, ${(connections || []).length} connections

CANON DOCUMENTS (established story material — DO NOT ask questions that are answered here):
${canonSummaries || "none"}

RECENT IDEAS (last 72h): ${recentIdeas.map(i => `[${i.category}] "${i.text.slice(0, 80)}"`).join(" | ") || "none"}
NERVE CENTERS (most connected): ${nerveCenters.map(i => `"${i.text.slice(0, 60)}" (${i.connCount} connections)`).join(" | ")}
STALE CATEGORIES (7+ days idle): ${staleCats.join(", ") || "none"}

OPEN ACTIONS (these are the actual deliverables — pick the most important one):
${pending.slice(0, 15).map((d, i) => `${i + 1}. [${d.idea?.category || "?"}] ${d.text}`).join("\n") || "all caught up"}`;

    const nudge = await callAI(
      `You are Daniel's creative partner on "${user.project_name}". You know his idea library, canon documents, connections, and open actions.

CRITICAL: Read the CANON DOCUMENTS carefully. Do NOT ask Daniel questions that are already answered in canon. If a character's motivation, a plot point, or a story element is defined in canon, treat it as established fact.

Your job: send ONE Telegram message. Direct, specific, actionable.

Rules:
- Address him as Daniel
- Pick the single most important open action from the list and tell him to do it NOW
- Explain WHY this action matters based on connection density, dependencies, or momentum
- If a recent capture connects to a nerve center, surface that
- Keep it under 200 words — this is a text message, not an essay
- End with: "Reply /done [keyword] when it's handled."
- Tone: showrunner texting his lead writer. Direct. Warm but no bullshit.
- Use Telegram markdown: *bold* for key phrases only`,
      context
    );

    await sendTelegram(nudge);
    return res.status(200).json({ sent: true, mode: "nudge", message: nudge });

  } catch (error) {
    console.error("Pulse error:", error);
    return res.status(500).json({ error: error.message });
  }
}
