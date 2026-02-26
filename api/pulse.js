// ============================================
// SIGNAL: Pulse — Daily Creative Nudge Engine
// api/pulse.js
// ============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM;

async function sendWhatsApp(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: `whatsapp:${TWILIO_FROM}`,
      To: `whatsapp:${to}`,
      Body: body,
    }),
  });
  const data = await res.json();
  if (!res.ok) console.error("Twilio error:", data);
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
  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional: check for cron secret or manual mode
  const mode = req.query?.mode || req.body?.mode || "nudge";

  try {
    // Load user
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!user?.whatsapp_number) {
      return res.status(400).json({ error: "No WhatsApp number configured" });
    }

    // Load project state
    const [
      { data: ideas },
      { data: deliverables },
      { data: canonDocs },
      { data: connections },
    ] = await Promise.all([
      supabase.from("ideas").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("deliverables").select("*, idea:ideas(text, category)").eq("user_id", user.id),
      supabase.from("canon_documents").select("id, title, is_active").eq("user_id", user.id),
      supabase.from("connections").select("*"),
    ]);

    const pending = (deliverables || []).filter(d => !d.is_complete);
    const completed = (deliverables || []).filter(d => d.is_complete);
    const recentIdeas = (ideas || []).filter(i => Date.now() - new Date(i.created_at) < 3 * 86400000);
    
    // Connection density per idea
    const connCounts = {};
    (connections || []).forEach(c => {
      connCounts[c.idea_id_a] = (connCounts[c.idea_id_a] || 0) + 1;
      connCounts[c.idea_id_b] = (connCounts[c.idea_id_b] || 0) + 1;
    });
    const nerveCenters = (ideas || [])
      .map(i => ({ ...i, connCount: connCounts[i.id] || 0 }))
      .sort((a, b) => b.connCount - a.connCount)
      .slice(0, 5);

    // Categories with no activity in 7+ days
    const catActivity = {};
    (ideas || []).forEach(i => {
      const age = Date.now() - new Date(i.created_at);
      if (!catActivity[i.category] || age < catActivity[i.category]) catActivity[i.category] = age;
    });
    const staleCats = Object.entries(catActivity).filter(([, age]) => age > 7 * 86400000).map(([cat]) => cat);

    if (mode === "checkin") {
      // Morning check-in: ask what's on the agenda
      const msg = `Good morning Daniel. Before I tell you what I think matters today — what's on your agenda? What feels most pressing right now?`;
      await sendWhatsApp(user.whatsapp_number, msg);
      return res.status(200).json({ sent: true, mode: "checkin", message: msg });
    }

    // Build context for AI
    const context = `PROJECT: ${user.project_name}
STATS: ${(ideas || []).length} ideas, ${pending.length} open actions, ${completed.length} completed, ${(connections || []).length} connections
RECENT IDEAS (last 72h): ${recentIdeas.map(i => `[${i.category}] "${i.text.slice(0, 80)}"`).join(" | ") || "none"}
NERVE CENTERS (most connected): ${nerveCenters.map(i => `"${i.text.slice(0, 60)}" (${i.connCount} connections)`).join(" | ")}
STALE CATEGORIES (no new ideas in 7+ days): ${staleCats.join(", ") || "none"}
OPEN ACTIONS (first 10): ${pending.slice(0, 10).map(d => `[${d.idea?.category || "?"}] ${d.text.slice(0, 60)}`).join(" | ") || "all caught up"}
CANON SOURCES: ${(canonDocs || []).filter(d => d.is_active).map(d => d.title).join(", ") || "none"}`;

    const nudge = await callAI(
      `You are Daniel's creative partner on a film/TV project. You know his entire idea library, every connection, every open action.

Your job: send ONE WhatsApp message that is direct, specific, and actionable. You are not a to-do app. You are a collaborator who sees the whole board.

Rules:
- Address him as Daniel
- Reference specific ideas, connections, or patterns by name
- Tell him the ONE thing that matters most right now and WHY based on connection density and project momentum
- If recent captures connect to existing nerve centers, surface that
- If a category is stale, flag it only if it's blocking progress
- Keep it under 300 words
- End with one clear ask: what to do RIGHT NOW
- Tone: direct creative collaborator, not a manager. Think showrunner, not Jira.`,
      context
    );

    await sendWhatsApp(user.whatsapp_number, nudge);
    return res.status(200).json({ sent: true, mode: "nudge", message: nudge });

  } catch (error) {
    console.error("Pulse error:", error);
    return res.status(500).json({ error: error.message });
  }
}
