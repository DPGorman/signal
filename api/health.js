// api/health.js — public health-check endpoint.
//
// GET → { ok: true, ts, backend: 'reachable' | 'degraded' }
// No auth. Returns 200 with backend status; returns 503 only if Supabase
// can't be reached at all (which would indicate a real outage).
//
// Used by the daily sanity-check routine in Anthropic Routines
// (trig_018Lig4ejBEGHS1nqDsB99Jn) instead of pinging /api/activation,
// which requires CRON_SECRET and produces 401 noise in runtime logs
// when the routine doesn't have the secret. Health checks should not
// require privileged auth.

import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ts = new Date().toISOString();
  let backend = "reachable";
  try {
    // Cheap DB ping: HEAD against users table (RLS-safe; just confirms
    // Supabase responds + the table exists). Service-role bypasses RLS.
    const { error } = await supabase.from("users").select("id", { count: "exact", head: true }).limit(1);
    if (error) backend = "degraded";
  } catch {
    backend = "degraded";
  }

  const status = backend === "reachable" ? 200 : 503;
  return res.status(status).json({ ok: backend === "reachable", ts, backend });
}
