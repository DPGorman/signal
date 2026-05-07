// api/admin/metrics.js — D14 retention + activation-pattern instrumentation
//
// Locked in SIGNAL-OPS · 5/7 · activation pattern lock §5 + retention memo §5.
//
// Returns the canonical activation-health metrics:
//   - D14 retention: % of users (created ≥14d ago) who captured at least once
//                    between day 7 and day 14 from their signup.
//   - Time-to-first-canon: median minutes from signup → first canon doc.
//   - D7 captures: median capture count by day 7 (leading indicator of D14).
//
// Auth: CRON_SECRET in Authorization header OR ?key= query param. Same pattern
// as api/recrawl.js. This is admin-only data, not user-facing.
//
// PoC implementation: pulls users + ideas + canon_documents in three queries
// and computes the rollup in JS. Trivial at current scale; refactor to SQL
// aggregation if user count crosses ~10k.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const DAY_MS = 24 * 60 * 60 * 1000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function checkAuth(req) {
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
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkAuth(req))      return res.status(401).json({ error: "Unauthorized" });

  try {
    const now = Date.now();

    // Pull what we need in three queries.
    const [{ data: users }, { data: ideas }, { data: canonDocs }] = await Promise.all([
      supabase.from("users").select("id, created_at"),
      supabase.from("ideas").select("user_id, created_at"),
      supabase.from("canon_documents").select("user_id, created_at"),
    ]);

    const usersById = new Map((users || []).map(u => [u.id, new Date(u.created_at).getTime()]));

    // Group ideas + canon by user
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

    // ── D14 retention ─────────────────────────────────────────────────────
    // Cohort: users created ≥14 days ago.
    // Returned: those users with at least one capture between day 7 and 14
    //           after their signup.
    let d14Cohort = 0;
    let d14Returned = 0;
    for (const [userId, signup] of usersById.entries()) {
      const ageMs = now - signup;
      if (ageMs < 14 * DAY_MS) continue; // still in trial window
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

    // ── Time-to-first-canon (median minutes) ──────────────────────────────
    const ttfcSamples = [];
    for (const [userId, signup] of usersById.entries()) {
      const firstCanon = firstCanonByUser.get(userId);
      if (firstCanon === undefined) continue;
      ttfcSamples.push((firstCanon - signup) / 60000); // minutes
    }
    const ttfcMedianMin = median(ttfcSamples);
    const usersWithCanon = ttfcSamples.length;

    // ── D7 captures (median) ──────────────────────────────────────────────
    // Cohort: users created ≥7 days ago.
    // Sample: count of captures within first 7 days of signup.
    const d7Samples = [];
    for (const [userId, signup] of usersById.entries()) {
      const ageMs = now - signup;
      if (ageMs < 7 * DAY_MS) continue;
      const userIdeas = ideasByUser.get(userId) || [];
      const captures = userIdeas.filter(t => t <= signup + 7 * DAY_MS).length;
      d7Samples.push(captures);
    }
    const d7MedianCaptures = median(d7Samples);

    // ── Adoption rates ────────────────────────────────────────────────────
    // % of users who completed canon-upload at any point.
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
        target: 35.0, // per retention memo §5: D14 > 35% means F&F path is plausible
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

      // Deferred metrics (require event-logging infrastructure not yet built):
      pulse_open_rate:        { status: "deferred", note: "needs delivery-side instrumentation" },
      studio_engagement_rate: { status: "deferred", note: "needs ai.js mode-call logging" },
    });
  } catch (err) {
    console.error("Metrics error:", err);
    return res.status(500).json({ error: err.message });
  }
}
