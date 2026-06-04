import { describe, it, expect } from "vitest";
import {
  pickSynthesisPair,
  buildInsightMessage,
  extractSynthesis,
  SYNTHESIS_MIN_STRENGTH,
} from "../src/lib/synthesis.js";

describe("pickSynthesisPair", () => {
  it("returns the strongest link when one clears the >=4 bar", () => {
    const links = [
      { partnerId: "a", strength: 2 },
      { partnerId: "b", strength: 5 },
      { partnerId: "c", strength: 4 },
    ];
    expect(pickSynthesisPair(links).partnerId).toBe("b");
  });

  it("returns null when no link reaches the collision bar", () => {
    const links = [{ strength: 1 }, { strength: 2 }, { strength: 3 }];
    expect(pickSynthesisPair(links)).toBe(null);
  });

  it("does not assume the input is pre-sorted", () => {
    const links = [{ partnerId: "x", strength: 4 }, { partnerId: "y", strength: 5 }];
    expect(pickSynthesisPair(links).partnerId).toBe("y");
  });

  it("ignores non-numeric / missing strengths without throwing", () => {
    expect(pickSynthesisPair([{ strength: "oops" }, { strength: null }, {}])).toBe(null);
    expect(pickSynthesisPair([{ partnerId: "z", strength: "5" }]).partnerId).toBe("z"); // numeric-string coerces
  });

  it("handles empty / bad input", () => {
    expect(pickSynthesisPair([])).toBe(null);
    expect(pickSynthesisPair(null)).toBe(null);
    expect(pickSynthesisPair(undefined)).toBe(null);
  });

  it("the default bar is 4 (genuine collision only)", () => {
    expect(SYNTHESIS_MIN_STRENGTH).toBe(4);
    expect(pickSynthesisPair([{ strength: 3 }])).toBe(null);
  });
});

describe("buildInsightMessage", () => {
  it("labels both captures and includes both texts in full", () => {
    const msg = buildInsightMessage("the lighthouse keeper lies", "she never returns the letters");
    expect(msg).toContain("the lighthouse keeper lies");
    expect(msg).toContain("she never returns the letters");
    expect(msg).toMatch(/CAPTURE A/);
    expect(msg).toMatch(/CAPTURE B/);
  });

  it("trims and tolerates empty input", () => {
    expect(buildInsightMessage("  a  ", "")).toContain('"a"');
    expect(() => buildInsightMessage(null, undefined)).not.toThrow();
  });
});

describe("extractSynthesis", () => {
  it("reads {raw}, strips fences, trims", () => {
    expect(extractSynthesis({ raw: "  Signal noticed the keeper and the letters both hinge on withheld truth.  " }))
      .toBe("Signal noticed the keeper and the letters both hinge on withheld truth.");
    expect(extractSynthesis({ raw: "```\nSignal noticed X.\n```" })).toBe("Signal noticed X.");
  });

  it("falls back to {text} and handles junk", () => {
    expect(extractSynthesis({ text: "ok" })).toBe("ok");
    expect(extractSynthesis({})).toBe("");
    expect(extractSynthesis(null)).toBe("");
    expect(extractSynthesis({ raw: 42 })).toBe("");
  });
});
