// api/admin.js — unified admin/system endpoint.
//
// Bundles three previously-separate functions under a single Vercel serverless
// function to stay within the Hobby plan's 12-function cap:
//   ?mode=health   — public no-auth Supabase health ping (used by daily sanity-check routine)
//   ?mode=metrics  — admin-only D14 retention + activation-pattern instrumentation
//   ?mode=recrawl  — admin-only full project re-analysis (cron-style)
//
// Old paths (/api/health, /api/admin/metrics, /api/recrawl) are preserved as
// rewrites in vercel.json so external callers (Anthropic Routines, manual triggers)
// keep working.

import { supabase } from "./_supabase.js";
import { callClaude, extractText } from "./_anthropic.js";
import { isCronAuthorized } from "./_auth.js";
import { assembleSystemPrompt, toCacheableSystemContent } from "./_voice/assemble.js";
import { getUpcomingEvents, formatEventsForContext } from "./_calendar/get-events.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function checkMetricsAuth(req) {
  const expected = process.env.CRON_SECRET || "signal-recrawl-2024";
  const header = req.headers?.authorization || "";
  const queryKey = req.query?.key || "";
  return (
    header === `Bearer ${expected}` ||
    header === expected ||
    queryKey === expected
  );
}

export default async function handler(req, res) {
  const mode = req.query?.mode || "health";

  if (mode === "health") return handleHealth(req, res);
  if (mode === "metrics") return handleMetrics(req, res);
  if (mode === "recrawl") return handleRecrawl(req, res);

  return res.status(400).json({ error: "Unknown mode", expected: ["health", "metrics", "recrawl"] });
}

// ─── HEALTH ────────────────────────────────────────────────────────────────
// Public no-auth Supabase ping. Used by daily sanity-check routine so it
// doesn't have to ping /api/activation (which requires CRON_SECRET and was
// producing 401 noise in runtime logs).
async function handleHealth(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ts = new Date().toISOString();
  let backend = "reachable";
  try {
    const { error } = await supabase.from("users").select("id", { count: "exact", head: true }).limit(1);
    if (error) backend = "degraded";
  } catch {
    backend = "degraded";
  }

  const status = backend === "reachable" ? 200 : 503;
  return res.status(status).json({ ok: backend === "reachable", ts, backend });
}

// ─── METRICS ───────────────────────────────────────────────────────────────
// D14 retention + activation-pattern instrumentation. Locked in SIGNAL-OPS
// 5/7 activation pattern lock §5 + retention memo §5.
async function handleMetrics(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkMetricsAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = Date.now();

    const [{ data: users }, { data: ideas }, { data: canonDocs }] = await Promise.all([
      supabase.from("users").select("id, created_at"),
      supabase.from("ideas").select("user_id, created_at"),
      supabase.from("canon_documents").select("user_id, created_at"),
    ]);

    const usersById = new Map((users || []).map(u => [u.id, new Date(u.created_at).getTime()]));

    const ideasByUser = new Map();
    (ideas || []).forEach(i => {
      const arr = ideasByUser.get(i.user_id) || [];
      arr.push(new Date(i.created_at).getTime());
      ideasByUser.set(i.user_id, arr);
    });

    const firstCanonByUser = new Map();
    (canonDocs || []).forEach(c => {
      const t = new Date(c.created_at).getTime();
      const cur = firstCanonByUser.get(c.user_id);
      if (cur === undefined || t < cur) firstCanonByUser.set(c.user_id, t);
    });

    // D14 retention
    let d14Cohort = 0;
    let d14Returned = 0;
    for (const [userId, signup] of usersById.entries()) {
      const ageMs = now - signup;
      if (ageMs < 14 * DAY_MS) continue;
      d14Cohort++;
      const userIdeas = ideasByUser.get(userId) || [];
      const window = userIdeas.some(t =>
        t >= signup + 7 * DAY_MS && t <= signup + 14 * DAY_MS
      );
      if (window) d14Returned++;
    }
    const d14Percent = d14Cohort === 0
      ? null
      : Math.round((100 * d14Returned / d14Cohort) * 10) / 10;

    // Time-to-first-canon
    const ttfcSamples = [];
    for (const [userId, signup] of usersById.entries()) {
      const firstCanon = firstCanonByUser.get(userId);
      if (firstCanon === undefined) continue;
      ttfcSamples.push((firstCanon - signup) / 60000);
    }
    const ttfcMedianMin = median(ttfcSamples);
    const usersWithCanon = ttfcSamples.length;

    // D7 captures
    const d7Samples = [];
    for (const [userId, signup] of usersById.entries()) {
      const ageMs = now - signup;
      if (ageMs < 7 * DAY_MS) continue;
      const userIdeas = ideasByUser.get(userId) || [];
      const captures = userIdeas.filter(t => t <= signup + 7 * DAY_MS).length;
      d7Samples.push(captures);
    }
    const d7MedianCaptures = median(d7Samples);

    const canonAdoption = usersById.size === 0
      ? null
      : Math.round((100 * usersWithCanon / usersById.size) * 10) / 10;

    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      total_users: usersById.size,
      total_ideas: (ideas || []).length,
      total_canon_docs: (canonDocs || []).length,

      d14_retention: {
        cohort_size: d14Cohort,
        returned: d14Returned,
        percent: d14Percent,
        target: 35.0,
      },

      time_to_first_canon: {
        users_with_canon: usersWithCanon,
        median_minutes: ttfcMedianMin === null ? null : Math.round(ttfcMedianMin * 10) / 10,
        canon_adoption_percent: canonAdoption,
      },

      d7_captures: {
        cohort_size: d7Samples.length,
        median: d7MedianCaptures,
      },

      pulse_open_rate:        { status: "deferred", note: "needs delivery-side instrumentation" },
      studio_engagement_rate: { status: "deferred", note: "needs ai.js mode-call logging" },
    });
  } catch (err) {
    console.error("Metrics error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── RECRAWL ───────────────────────────────────────────────────────────────
// Full project re-analysis. Called by Vercel cron or manually.
async function handleRecrawl(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: users } = await supabase
      .from("users")
      .select("id, project_name")
      .order("created_at", { ascending: false })
      .limit(1);
    const user = users?.[0];

    if (!user) {
      return res.status(200).json({ message: "No users found." });
    }

    const [{ data: ideas }, { data: canon }, { data: replies }, { data: deliverables }] = await Promise.all([
      supabase.from("ideas").select("*, dimensions(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("canon_documents").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.from("replies").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("deliverables").select("*").eq("user_id", user.id).eq("is_complete", false),
    ]);

    if (!ideas?.length) {
      return res.status(200).json({ message: "No ideas to analyze." });
    }

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

    const events = await getUpcomingEvents(supabase, user.id, 7);
    const calendarBlock = formatEventsForContext(events);

    const runtimeContext = [
      canonText ? `CANON DOCUMENTS:\n${canonText}` : null,
      openActions ? `OPEN ACTIONS:\n${openActions}` : null,
      lastInsight || null,
      studioReplyText || null,
      calendarBlock || null,
      `Timestamp: ${Date.now()}`,
    ].filter(Boolean).join("\n\n");

    const parts = await assembleSystemPrompt({
      supabase,
      userId: user.id,
      mode: "recrawl",
      runtimeContext,
    });
    const systemContent = toCacheableSystemContent(parts);

    const data = await callClaude({
      system: systemContent,
      messages: [{
        role: "user",
        content: `Project: ${user.project_name || "Film Series"}\nTotal ideas: ${ideas.length}\nTimestamp: ${new Date().toISOString()}\n\nALL IDEAS:\n${allIdeas}`,
      }],
      maxTokens: 1200,
    });
    const raw = extractText(data).replace(/```json|```/g, "").trim();
    const insight = JSON.parse(raw);

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
