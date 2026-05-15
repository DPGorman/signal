// api/_auth.js — endpoint auth helpers.
//
// Three independent checks; endpoints compose them per their threat model:
//   - isCronAuthorized(req)              : checks CRON_SECRET in Authorization header.
//                                          Vercel cron requests include this header automatically
//                                          when CRON_SECRET is set as a project env var.
//   - getAuthedUser(req)                 : verifies a Supabase user JWT; returns user or null.
//   - isWebhookAuthorized(req, envName)  : checks ?key= against an env-named shared secret.
//                                          Fail-OPEN when the env var is unset (preserves legacy
//                                          behavior) — set the env var to activate hard enforcement.

import { supabase } from "./_supabase.js";

function bearerToken(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export function isCronAuthorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = bearerToken(req) || req.headers["authorization"] || req.query?.token;
  return provided === expected || provided === `Bearer ${expected}`;
}

export async function getAuthedUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export function isWebhookAuthorized(req, envName) {
  const expected = process.env[envName];
  if (!expected) {
    console.warn(`[auth] ${envName} not set — webhook auth is OFF. Set env var to enforce.`);
    return true;
  }
  return req.query?.key === expected;
}
