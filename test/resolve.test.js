import { describe, it, expect } from "vitest";
import { resolveConnectionRows } from "../api/connections/_resolve.js";

const ideas = [{ id: "aaa" }, { id: "bbb" }, { id: "ccc" }]; // indices 0,1,2

describe("resolveConnectionRows", () => {
  it("resolves indices to real ids, normalizes order, dedupes, drops bad rows", () => {
    // This is the exact regression the MAP-ALL fix targets: the model's output
    // used to be trusted verbatim, so a reversed/duplicate/out-of-range/non-int
    // reference failed the whole FK-constrained upsert and 0 connections saved.
    const rows = resolveConnectionRows(
      [
        { a: 0, b: 1, reason: "valid", strength: 3 },
        { a: 1, b: 0, reason: "reversed dup", strength: 4 }, // dedupe
        { a: 0, b: 1, reason: "exact dup", strength: 5 },     // dedupe
        { a: 2, b: 2, reason: "self-ref", strength: 5 },      // drop
        { a: 0, b: 9, reason: "out of range", strength: 5 },  // drop
        { a: "x", b: 1, reason: "non-int (model echoed a UUID)", strength: 5 }, // drop
        { a: 1, b: 2, reason: "valid 2", strength: 2 },
        { a: 1, b: 2, reason: "weak/dup", strength: 1 },      // drop (below 2, and dup)
      ],
      ideas,
      "proj",
    );

    expect(rows).toHaveLength(2);

    const real = new Set(["aaa", "bbb", "ccc"]);
    for (const r of rows) {
      expect(real.has(r.idea_id_a)).toBe(true); // FK-safe: only real idea ids
      expect(real.has(r.idea_id_b)).toBe(true);
      expect(r.idea_id_a <= r.idea_id_b).toBe(true); // normalized order
      expect(r.project_id).toBe("proj");
    }
    expect(rows[0]).toMatchObject({ idea_id_a: "aaa", idea_id_b: "bbb" });
    expect(rows[1]).toMatchObject({ idea_id_a: "bbb", idea_id_b: "ccc" });
  });

  it("returns [] for empty or undefined input", () => {
    expect(resolveConnectionRows(undefined, ideas, "p")).toEqual([]);
    expect(resolveConnectionRows([], ideas, "p")).toEqual([]);
  });
});
