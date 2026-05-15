// api/_supabase.js — shared server-side Supabase client.
//
// Single source of truth for the service-role client used across all Vercel
// serverless functions. Previously each endpoint inlined its own createClient()
// call; rotating credentials or changing client config required touching 9 files.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
