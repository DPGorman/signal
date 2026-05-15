import { supabase } from "./_supabase.js";
import { callClaude, extractText } from "./_anthropic.js";
import { isCronAuthorized, getAuthedUser } from "./_auth.js";
import { assembleSystemPrompt, toCacheableSystemContent } from "./_voice/assemble.js";
import { getUpcomingEvents, formatEventsForContext } from "./_calendar/get-events.js";

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
  // Anthropic rejects empty user content. Pulse is mode-driven (the system prompt
  // is self-sufficient) so callers may pass "" — substitute a trigger phrase.
  const userContent = (typeof message === "string" && message.length > 0) ? message : "Generate today's pulse.";
  const data = await callClaude({
    system,
    messages: [{ role: "user", content: userContent }],
    maxTokens: 600,
  });
  return extractText(data);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Mixed-auth: cron requests (Vercel cron, internal hops from activation/telegram)
  // carry CRON_SECRET in the Authorization header. Frontend user-triggered nudges
  // carry the user's Supabase JWT. Either is sufficient.
  if (!isCronAuthorized(req)) {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
  }

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

    // Inject calendar awareness so pulse can reference specific time windows
    // ("you have 90 minutes free tomorrow morning"). Calendar is optional — if
    // not connected, returns [] and runtime context is unchanged.
    const events = await getUpcomingEvents(supabase, user.id, 7);
    const calendarBlock = formatEventsForContext(events);
    const fullContext = [context, calendarBlock].filter(Boolean).join("\n\n");

    // System prompt assembled server-side from [backbone] + [craft overlay] + [user-layer] + [pulse mode contract].
    // The "showrunner texting his lead writer" voice is now in the screenwriter overlay's pulse named-voice;
    // other crafts get their craft-appropriate equivalent (chef = sous chef texting CDC, founder = trusted advisor, etc.).
    // Stable portion (~2.7K tokens) wrapped with cache_control so daily cron-triggered pulses share cached prefix.
    const parts = await assembleSystemPrompt({
      supabase,
      userId: user.id,
      mode: "pulse",
      runtimeContext: fullContext,
    });
    const systemContent = toCacheableSystemContent(parts);

    const nudge = await callAI(systemContent, "");

    await sendTelegram(nudge);
    return res.status(200).json({ sent: true, mode: "nudge", message: nudge });

  } catch (error) {
    console.error("Pulse error:", error);
    return res.status(500).json({ error: error.message });
  }
}
