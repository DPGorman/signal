import { supabase } from "../_supabase.js";
import { callClaude, extractText } from "../_anthropic.js";
import { getAuthedUser } from "../_auth.js";
import { resolveConnectionRows } from "./_resolve.js";

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

  // Each idea is keyed by its list index, NOT its UUID. The model references
  // ideas by index; we resolve index -> real UUID server-side below. This is the
  // same robust pattern the per-capture generator uses (src/app.jsx) — never trust
  // the model to reproduce 36-char UUIDs verbatim, or one bad character fails the
  // whole FK-constrained insert.
  const ideaList = ideas.map((i, n) => `${n}|${i.category || "idea"}|${i.text.slice(0, 150)}`).join("\n");

  let data;
  try {
    data = await callClaude({
      system: `You find meaningful creative connections between ideas. Only return genuine thematic, narrative, or conceptual relationships — not just similar categories. Be selective: a weak connection is worse than none.`,
      messages: [{
        role: "user",
        content: `Find meaningful connections between these ideas. Each idea is listed as "index|category|text". Reference ideas by their integer index. Return ONLY raw JSON — no markdown, no explanation:\n{"connections":[{"a":<index>,"b":<index>,"reason":"why they connect","strength":3}]}\n\na and b are the integer indices of the two connected ideas (a != b). strength: 1–5 (only include strength >= 2). Empty array if none.\n\nIDEAS:\n${ideaList}`,
      }],
      maxTokens: 4000,
      model: "claude-haiku-4-5-20251001",
    });
  } catch (e) {
    return res.status(500).json({ error: `AI call failed: ${e.message}` });
  }

  let parsed;
  try {
    const full = extractText(data);
    const start = full.indexOf("{");
    const end = full.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON object in response");
    parsed = JSON.parse(full.slice(start, end + 1));
  } catch (e) {
    return res.status(500).json({ error: `Failed to parse AI response: ${e.message}` });
  }

  // Resolve model indices -> real, FK-safe rows (normalize order + dedupe).
  // Logic lives in ./_resolve.js so it's unit-tested (test/resolve.test.js).
  const rows = resolveConnectionRows(parsed.connections, ideas, projectId);

  if (rows.length === 0) return res.status(200).json({ count: 0 });

  // Return the REAL persisted count, and surface write errors instead of
  // swallowing them — the old code reported the model's count even when the
  // insert failed, so "Mapped N connections" could be a lie.
  const { data: inserted, error } = await supabase
    .from("connections")
    .upsert(rows, { onConflict: "idea_id_a,idea_id_b" })
    .select("id");
  if (error) return res.status(500).json({ error: `Failed to save connections: ${error.message}` });

  return res.status(200).json({ count: inserted?.length ?? rows.length });
}
