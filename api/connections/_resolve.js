// Pure transform for the batch connection generator. Extracted from
// generate.js so the resolution logic can be unit-tested (test/resolve.test.js)
// without loading the Supabase / Anthropic clients. The `_` prefix keeps Vercel
// from routing this as a serverless function (same convention as _supabase.js).
//
// The model references ideas by their list INDEX (not UUID). We resolve each
// index to a real idea id — guaranteeing the foreign key is satisfied — then
// normalize each pair's order (smaller id first) and dedupe, so a reversed or
// repeated pair can't fail the unique (idea_id_a, idea_id_b) upsert. Anything
// out of range, self-referential, or below strength 2 is dropped.
export function resolveConnectionRows(connections, ideas, projectId) {
  const seen = new Set();
  const rows = [];
  for (const c of connections || []) {
    if (!Number.isInteger(c.a) || !Number.isInteger(c.b)) continue;
    if (c.a < 0 || c.a >= ideas.length || c.b < 0 || c.b >= ideas.length) continue;
    if (c.a === c.b || !(c.strength >= 2)) continue;
    let [ida, idb] = [ideas[c.a].id, ideas[c.b].id];
    if (ida > idb) [ida, idb] = [idb, ida];
    const key = `${ida}|${idb}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ idea_id_a: ida, idea_id_b: idb, reason: c.reason, strength: c.strength, project_id: projectId });
  }
  return rows;
}
