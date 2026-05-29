import { supabase } from "../_supabase.js";
import { callClaude, extractText } from "../_anthropic.js";
import { getAuthedUser } from "../_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authedUser = await getAuthedUser(req);
  if (!authedUser) return res.status(401).json({ error: "Unauthorized" });

  const projectId = req.body?.project_id;
  if (!projectId) return res.status(400).json({ error: "project_id required" });

  // Resolve internal user id
  const { data: userRows } = await supabase.from("users").select("id").eq("auth_id", authedUser.id).limit(1);
  const userId = userRows?.[0]?.id;
  if (!userId) return res.status(400).json({ error: "User not found" });

  // Fetch all non-archived project_material ideas for this project
  const { data: ideas } = await supabase
    .from("ideas")
    .select("id, text, category")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("is_archived", false)
    .or("kind.is.null,kind.eq.project_material")
    .order("created_at", { ascending: false });

  if (!ideas || ideas.length < 2) {
    return res.status(200).json({ count: 0, message: "Not enough ideas to connect" });
  }

  const ideaList = ideas.map((i, n) => `${n}|${i.id}|${i.category || "idea"}|${i.text.slice(0, 150)}`).join("\n");

  const data = await callClaude({
    system: `You find meaningful creative connections between ideas. Only return genuine thematic, narrative, or conceptual relationships — not just similar categories. Be selective: a weak connection is worse than none.`,
    messages: [{
      role: "user",
      content: `Find meaningful connections between these ideas. Return ONLY raw JSON — no markdown, no explanation:\n{"connections":[{"idea_id_a":"<uuid>","idea_id_b":"<uuid>","reason":"why they connect","strength":3}]}\n\nstrength: 1–5 (only include strength >= 2). Empty array if none.\n\nIDEAS:\n${ideaList}`,
    }],
    maxTokens: 1500,
    model: "claude-haiku-4-5-20251001",
  });

  let parsed;
  try {
    const raw = extractText(data).replace(/```json|```/g, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return res.status(500).json({ error: "Failed to parse AI response" });
  }

  const conns = (parsed.connections || []).filter(
    (c) => c.idea_id_a && c.idea_id_b && c.strength >= 2
  );

  // Clean remap — delete existing connections for this project
  await supabase.from("connections").delete().eq("project_id", projectId);

  if (conns.length > 0) {
    const rows = conns.map((c) => ({
      idea_id_a: c.idea_id_a,
      idea_id_b: c.idea_id_b,
      reason: c.reason,
      strength: c.strength,
      project_id: projectId,
    }));
    await supabase.from("connections").insert(rows);
  }

  return res.status(200).json({ count: conns.length });
}
