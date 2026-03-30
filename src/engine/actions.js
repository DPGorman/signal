import { supabase } from "../lib/supabase";

export { supabase };

export const loadProjectData = async (uid) => {
  const [u, i, d, c, r, cd, cn] = await Promise.all([
    supabase.from("users").select("*").eq("id", uid).limit(1),
    supabase.from("ideas").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid),
    supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("replies").select("*").eq("user_id", uid),
    supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
    supabase.from("connections").select("*").eq("user_id", uid)
  ]);
  return { user: u.data?.[0] || null, ideas: i.data, deliverables: d.data, canonDocs: c.data, replies: r.data, composeDocs: cd.data, connections: cn.data };
};

export const saveDoc = async (id, updates) => {
    return await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
};
