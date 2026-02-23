import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function callAI(system, message) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message }),
  });
  return res.json();
}

export const loadAllData = async (uid) => {
  const [u, i, d, c, r, cd, cn] = await Promise.all([
    supabase.from("users").select("*").eq("id", uid).single(),
    supabase.from("ideas").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid),
    supabase.from("canon_documents").select("*").eq("user_id", uid),
    supabase.from("replies").select("*").eq("user_id", uid),
    supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
    supabase.from("connections").select("*").eq("user_id", uid)
  ]);
  return { user: u.data, ideas: i.data, deliverables: d.data, canonDocs: c.data, replies: r.data, composeDocs: cd.data, connections: cn.data };
};

export const getMapCoords = (ideas, connections) => {
  const cx = 500, cy = 400;
  return ideas.map((idea, i) => {
    const angle = (i / ideas.length) * Math.PI * 2;
    return { id: idea.id, x: cx + Math.cos(angle) * 300, y: cy + Math.sin(angle) * 300 };
  });
};