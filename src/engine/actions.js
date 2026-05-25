import { supabase } from "../lib/supabase";

export { supabase };

export const loadProjectData = async (uid, projId = null) => {
  // Project-scope the per-project collections when a project id is given (matches app.jsx loadAll).
  // Connections MUST be scoped or the mind-map/counts leak links across all of the user's projects.
  const scope = (q) => (projId ? q.eq("project_id", projId) : q);
  const [u, i, d, c, r, cd, cn] = await Promise.all([
    supabase.from("users").select("*").eq("id", uid).limit(1),
    scope(supabase.from("ideas").select("*").eq("user_id", uid)).order("created_at", { ascending: false }),
    scope(supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid)),
    scope(supabase.from("canon_documents").select("*").eq("user_id", uid)).order("created_at", { ascending: false }),
    supabase.from("replies").select("*").eq("user_id", uid),
    supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
    scope(supabase.from("connections").select("*"))
  ]);
  return { user: u.data?.[0] || null, ideas: i.data, deliverables: d.data, canonDocs: c.data, replies: r.data, composeDocs: cd.data, connections: cn.data };
};

export const saveDoc = async (id, updates) => {
    return await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
};
