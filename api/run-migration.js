// Temporary endpoint to run RLS policy migration
// DELETE THIS FILE after running successfully
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = req.headers["x-migration-secret"];
  if (secret !== "signal-rls-fix-2026") return res.status(401).json({ error: "unauthorized" });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    db: { schema: "public" },
  });

  const results = [];

  // Helper to run a policy creation (ignores "already exists" errors)
  const createPolicy = async (name, table, operation, clause) => {
    const sql = operation === "INSERT"
      ? `CREATE POLICY "${name}" ON ${table} FOR ${operation} WITH CHECK (${clause})`
      : `CREATE POLICY "${name}" ON ${table} FOR ${operation} USING (${clause})`;

    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
    // If rpc doesn't exist, try raw query via postgrest
    results.push({ name, error: error?.message || "ok" });
  };

  try {
    // Since we can't run raw DDL via PostgREST, let's check what policies exist
    // by querying the tables to see if they're accessible

    // Test: can we read from each table?
    const tables = ["users", "projects", "ideas", "deliverables", "canon_documents",
                     "dimensions", "replies", "connections", "compose_documents"];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      results.push({
        table,
        accessible: !error,
        error: error?.message || null,
        rowCount: data?.length || 0
      });
    }

    // Check newer tables
    for (const table of ["check_ins", "user_integrations", "user_work_types"]) {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      results.push({
        table,
        accessible: !error,
        error: error?.message || null,
        rowCount: data?.length || 0
      });
    }

    return res.status(200).json({
      message: "Database health check complete. Raw DDL must be run in Supabase SQL Editor.",
      sqlFile: "database/fix_rls_policies.sql",
      results
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
