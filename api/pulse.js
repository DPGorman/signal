import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown" }),
  });
  const data = await res.json();
  if (!data.ok) console.error("Telegram error:", data);
  return data;
}

async function callAI(system, message) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 600, system, messages: [{ role: "user", content: message }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const mode = req.query?.mode || req.body?.mode || "nudge";
  const userId = req.body?.user_id || req.query?.user_id || null;

  try {
    let q = supabase.from("users").select("*");
    if (userId) { q = q.eq("id", userId); } else { q = q.order("created_at", { ascending: true }); }
    const { data: users } = await q.limit(1);
    const user = users?.[0];
    if (!user) return res.status(400).json({ error: "No user found" });

    const [{ data: ideas }, { data: deliverables }, { data: canonDocs }, { data: connections }] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("deliverables").select("*, idea:ideas(text, category)").eq("user_id", user.id),
      supabase.from("canon_documents").select("id, title, content, summary, is_active").eq("user_id", user.id).eq("is_active", true),
      supabase.from("connections").select("*").eq("user_id", user.id),
    ]);

    const pending = (deliverables || []).filter(d => !d.is_complete);
    const completed = (deliverables || []).filter(d => d.is_complete);
    const recentIdeas = (ideas || []).filter(i => Date.now() - new Date(i.created_at) < 3 * 86400000);

    const connCounts = {};
    (connections || []).forEach(c => {
      connCounts[c.idea_id_a] = (connCounts[c.idea_id_a] || 0) + 1;
      connCounts[c.idea_id_b] = (connCounts[c.idea_id_b] || 0) + 1;
    });
    const nerveCenters = (ideas || []).map(i => ({ ...i, connCount: connCounts[i.id] || 0 })).sort((a, b) => b.connCount - a.connCount).slice(0, 5);

    const catActivity = {};
    (ideas || []).forEach(i => {
      const age = Date.now() - new Date(i.created_at);
      if (!catActivity[i.category] || age < catActivity[i.category]) catActivity[i.category] = age;
    });
    const staleCats = Object.entries(catActivity).filter(([, age]) => age > 7 * 86400000).map(([cat]) => cat);

    const FULL_CONTENT_LIMIT = 12000;
    const canonFeed = (canonDocs || []).map(d => {
      const content = d.content || "";
      if (content.length <= FULL_CONTENT_LIMIT) return `[${d.title}] (FULL):\n${content}`;
      if (d.summary) return `[${d.title}] (SUMMARY):\n${d.summary}`;
      return `[${d.title}]: ${content.slice(0, 800)}`;
    }).join("\n\n---\n\n");

    if (mode === "checkin") {
      const msg = `Good morning ${user.display_name || user.project_name || "friend"}. What's on your agenda today?\n\nReply here or type /status for a project snapshot.`;
      await sendTelegram(msg);
      return res.status(200).json({ sent: true, mode: "checkin", message: msg });
    }

    const context = `PROJECT: ${user.project_name}
STATS: ${(ideas || []).length} ideas, ${pending.length} open actions, ${completed.length} completed, ${(connections || []).length} connections
CANON:\n${canonFeed || "none"}
RECENT IDEAS (last 72h): ${recentIdeas.map(i => `[${i.category}] "${i.text.slice(0, 80)}"`).join(" | ") || "none"}
NERVE CENTERS: ${nerveCenters.map(i => `"${i.text.slice(0, 60)}" (${i.connCount} connections)`).join(" | ")}
STALE CATEGORIES: ${staleCats.join(", ") || "none"}
OPEN ACTIONS:\n${pending.slice(0, 15).map((d, i) => `${i + 1}. [${d.idea?.category || "?"}] ${d.text}`).join("\n") || "all caught up"}`;

    const nudge = await callAI(
      `You are Daniel's creative partner on "${user.project_name}". Read the canon carefully — do not ask questions already answered there. Send ONE Telegram message. Under 200 words. Pick the single most important open action and tell him to do it NOW. End with: "Reply /done [keyword] when it's handled." Tone: showrunner texting his lead writer. Use Telegram markdown: *bold* sparingly.`,
      context
    );

    await sendTelegram(nudge);
    return res.status(200).json({ sent: true, mode: "nudge", message: nudge });

  } catch (error) {
    console.error("Pulse error:", error);
    return res.status(500).json({ error: error.message });
  }
}
