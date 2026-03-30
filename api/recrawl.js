// ============================================
// SIGNAL: Periodic AI Re-crawl
// api/recrawl.js
// ============================================
// Called by Vercel cron or manually to re-analyze
// the entire project and generate fresh insights.
// ============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simple auth check — cron sends this header, or pass as query param
  const authToken = req.headers["authorization"] || req.query?.token;
  const expectedToken = process.env.CRON_SECRET || "signal-recrawl-2024";
  if (authToken !== `Bearer ${expectedToken}` && authToken !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all users (for now, just the most recent one — single-user setup)
    const { data: users } = await supabase
      .from("users")
      .select("id, project_name")
      .order("created_at", { ascending: false })
      .limit(1);
    const user = users?.[0];

    if (!user) {
      return res.status(200).json({ message: "No users found." });
    }

    // Load everything
    const [{ data: ideas }, { data: canon }, { data: replies }, { data: deliverables }] = await Promise.all([
      supabase.from("ideas").select("*, dimensions(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("canon_documents").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.from("replies").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("deliverables").select("*").eq("user_id", user.id).eq("is_complete", false),
    ]);

    if (!ideas?.length) {
      return res.status(200).json({ message: "No ideas to analyze." });
    }

    // Build the full context
    const allIdeas = ideas.map((i, n) => {
      const ideaReplies = (replies || []).filter(r => r.idea_id === i.id);
      const replyText = ideaReplies.length
        ? `\n  Creator's responses: ${ideaReplies.map(r => `[${r.target_section}]: "${r.content}"`).join("; ")}`
        : "";
      const dims = i.dimensions?.length ? ` (${i.dimensions.map(d => d.label).join(", ")})` : "";
      return `#${n + 1} [${i.category}, signal ${i.signal_strength || "?"}${dims}] "${i.text}"${replyText}`;
    }).join("\n");

    const canonText = (canon || []).slice(0, 3).map(d => `[${d.title}]:\n${d.content.slice(0, 600)}`).join("\n\n");

    const studioReplies = (replies || []).filter(r => !r.idea_id && r.target_section.startsWith("studio_"));
    const studioReplyText = studioReplies.length
      ? `\n\nCREATOR'S RESPONSES TO PREVIOUS INSIGHTS:\n${studioReplies.map(r => `[${r.target_section.replace("studio_", "")}]: "${r.content}"`).join("\n")}`
      : "";

    const openActions = (deliverables || []).slice(0, 10).map(d => `- ${d.text}`).join("\n");

    // Get the last snapshot to avoid repetition
    const { data: lastSnapshots } = await supabase
      .from("studio_snapshots")
      .select("snapshot")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const lastSnapshot = lastSnapshots?.[0];

    const lastInsight = lastSnapshot?.snapshot
      ? `\n\nYOUR PREVIOUS INSIGHT (do NOT repeat this — build on it or challenge it):\nProvocation: "${lastSnapshot.snapshot.provocation}"\nBlind spot: "${lastSnapshot.snapshot.blind_spot}"`
      : "";

    // Call Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1200,
        system: `You are a senior creative collaborator — script editor, dramaturg, producer — performing a periodic re-analysis of a creator's entire project. You have access to their full idea library, their canon documents, their responses to your previous insights, and open action items.

Your job: find NEW connections. Don't repeat previous insights. Go deeper. Notice what has changed since last time. If the creator has responded to your provocations, engage with those responses. If new ideas have been added, see how they reshape the whole.

${canonText ? `CANON DOCUMENTS:\n${canonText}\n\n` : ""}${openActions ? `OPEN ACTIONS:\n${openActions}\n\n` : ""}${lastInsight}${studioReplyText}

Timestamp: ${Date.now()}

Respond ONLY in raw JSON:
{
  "provocation": "the sharpest NEW unresolved question this work raises. 2-3 sentences. Must be different from previous.",
  "pattern": "what the creator is actually working on beneath the surface — evolved from last time if applicable.",
  "urgentIdea": "single idea most deserving development RIGHT NOW, and one sentence why.",
  "blind_spot": "what this work isn't yet grappling with that it must. NEW angle.",
  "duplicates": "ideas that overlap and which articulation to keep. null if none.",
  "newConnections": "2-3 connections between ideas that weren't obvious before."
}`,
        messages: [{
          role: "user",
          content: `Project: ${user.project_name || "Film Series"}\nTotal ideas: ${ideas.length}\nTimestamp: ${new Date().toISOString()}\n\nALL IDEAS:\n${allIdeas}`,
        }],
      }),
    });

    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, "").trim();
    const insight = JSON.parse(raw);

    // Save snapshot
    await supabase.from("studio_snapshots").insert([{
      user_id: user.id,
      snapshot: insight,
    }]);

    console.log("Recrawl complete:", insight.provocation?.slice(0, 80));

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ideasAnalyzed: ideas.length,
      repliesIncluded: (replies || []).length,
      provocation: insight.provocation,
    });

  } catch (error) {
    console.error("Recrawl error:", error);
    return res.status(500).json({ error: "Recrawl failed", details: error.message });
  }
}
