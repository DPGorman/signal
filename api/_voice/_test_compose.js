// Isolation test for composePrompt + toCacheableSystemContent.
// Run with: node api/_voice/_test_compose.js
// Tests:
//   1. Three crafts × all modes compose without errors and split into {stable, runtime}
//   2. Cold-start case (no lexicon, no voice card) doesn't crash
//   3. Full case (lexicon + voice card + collaborator name) composes the user-layer block
//   4. Unknown craft falls back to default
//   5. Unknown mode throws
//   6. toCacheableSystemContent puts cache_control on stable, omits it from runtime

import { composePrompt, toCacheableSystemContent, BACKBONE, OVERLAYS, MODES } from "./assemble.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
}

console.log("=== Signal voice-module composition tests ===\n");

// 1. Three crafts × all modes
const fakeUsers = [
  { craft: "screenwriter", lexicon: [], voiceCard: null, collaboratorName: null },
  { craft: "founder", lexicon: [], voiceCard: null, collaboratorName: null },
  { craft: "chef", lexicon: [], voiceCard: null, collaboratorName: null },
];

const allModes = Object.keys(MODES);

for (const user of fakeUsers) {
  for (const mode of allModes) {
    const parts = composePrompt({ ...user, mode, runtimeContext: "PROJECT: Foo" });
    assert(typeof parts === "object" && parts !== null, `compose: ${user.craft} × ${mode} returns object`);
    assert(typeof parts.stable === "string" && parts.stable.length > 0, `compose: ${user.craft} × ${mode} has stable string`);
    assert(typeof parts.runtime === "string", `compose: ${user.craft} × ${mode} has runtime string`);
    assert(parts.stable.includes(BACKBONE.slice(0, 50)), `compose: ${user.craft} × ${mode} stable includes backbone`);
    assert(parts.stable.includes(OVERLAYS[user.craft].slice(0, 30)), `compose: ${user.craft} × ${mode} stable includes craft overlay`);
    assert(parts.stable.includes(MODES[mode].slice(0, 30)), `compose: ${user.craft} × ${mode} stable includes mode contract`);
    assert(parts.runtime.includes("PROJECT: Foo"), `compose: ${user.craft} × ${mode} runtime carries runtimeContext`);
    assert(!parts.stable.includes("PROJECT: Foo"), `compose: ${user.craft} × ${mode} runtime context NOT in stable`);
  }
}

// 2. Cold-start: no user-layer content
const coldStart = composePrompt({
  craft: "screenwriter",
  lexicon: [],
  voiceCard: null,
  collaboratorName: null,
  mode: "capture",
  runtimeContext: "",
});
assert(!coldStart.stable.includes("USER LEXICON"), "cold-start: no USER LEXICON block");
assert(!coldStart.stable.includes("USER VOICE CARD"), "cold-start: no USER VOICE CARD block");
assert(!coldStart.stable.includes("named you"), "cold-start: no collaborator name reference");
assert(coldStart.runtime === "", "cold-start: empty runtimeContext yields empty runtime");

// 3. Full user-layer
const fullUserLayer = composePrompt({
  craft: "screenwriter",
  lexicon: [
    { term: "Ava", type: "proper_noun" },
    { term: "CRISPR", type: "proper_noun" },
    { term: "ep 4", type: "project_term" },
    { term: "soft-tell", type: "user_phrasing" },
  ],
  voiceCard: "Daniel buries his thesis in the third paragraph. He uses humor as deflection on hard scenes.",
  collaboratorName: "Sal",
  mode: "studio",
  runtimeContext: "PROJECT: CRISPR\nIDEAS: 4 captures this week",
});
assert(fullUserLayer.stable.includes("Sal"), "full: collaborator name 'Sal' injected into stable");
assert(fullUserLayer.stable.includes("Ava"), "full: proper noun 'Ava' injected into stable");
assert(fullUserLayer.stable.includes("soft-tell"), "full: phrasing 'soft-tell' injected into stable");
assert(fullUserLayer.stable.includes("Daniel buries his thesis"), "full: voice card text injected into stable");
assert(fullUserLayer.runtime.includes("CRISPR"), "full: runtime context goes to runtime");
assert(!fullUserLayer.stable.includes("4 captures this week"), "full: runtime context NOT duplicated into stable");

// 4. Unknown craft → fallback to default
const unknownCraft = composePrompt({
  craft: "luthier", // not a V1 overlay
  lexicon: [],
  voiceCard: null,
  collaboratorName: null,
  mode: "capture",
  runtimeContext: "",
});
assert(unknownCraft.stable.includes(OVERLAYS.screenwriter.slice(0, 30)), "unknown craft falls back to screenwriter");

// 5. Unknown mode throws
let threw = false;
try {
  composePrompt({
    craft: "screenwriter",
    lexicon: [],
    mode: "unicorn", // invalid
    runtimeContext: "",
  });
} catch (e) {
  threw = true;
  assert(e.message.includes("Unknown mode"), `unknown mode throws expected error: ${e.message}`);
}
assert(threw, "unknown mode actually throws");

// 6. toCacheableSystemContent shapes the array correctly for Anthropic
const blocks = toCacheableSystemContent({
  stable: "STABLE PORTION (backbone + overlay + ...)",
  runtime: "RUNTIME PORTION (canon, ideas)",
});
assert(Array.isArray(blocks) && blocks.length === 2, "cache: returns 2-element array when both parts present");
assert(blocks[0].type === "text" && blocks[0].text.startsWith("STABLE"), "cache: first block is stable text");
assert(blocks[0].cache_control?.type === "ephemeral", "cache: first block has ephemeral cache_control");
assert(blocks[1].type === "text" && blocks[1].text.startsWith("RUNTIME"), "cache: second block is runtime text");
assert(blocks[1].cache_control === undefined, "cache: second block has NO cache_control");

const stableOnly = toCacheableSystemContent({ stable: "S", runtime: "" });
assert(stableOnly.length === 1 && stableOnly[0].cache_control?.type === "ephemeral", "cache: empty runtime collapses to single cached block");

const empty = toCacheableSystemContent({ stable: "", runtime: "" });
assert(empty === undefined, "cache: both empty returns undefined");

const nothing = toCacheableSystemContent();
assert(nothing === undefined, "cache: no args returns undefined");

// 7. Show one full prompt for visual inspection (founder, capture mode, full layer)
console.log("\n=== Sample assembled prompt (founder · capture · full user layer) ===\n");
const sample = composePrompt({
  craft: "founder",
  lexicon: [
    { term: "CRISPR", type: "proper_noun" },
    { term: "the wedge", type: "user_phrasing" },
  ],
  voiceCard: "Daniel ladders up before he ladders down. Frames decisions as bets.",
  collaboratorName: "V",
  mode: "capture",
  runtimeContext: "PROJECT: Better Lab\nRECENT: 3 captures about pricing",
});
console.log(`Stable length:  ${sample.stable.length} chars (~${Math.round(sample.stable.length / 4)} tokens) — CACHED`);
console.log(`Runtime length: ${sample.runtime.length} chars (~${Math.round(sample.runtime.length / 4)} tokens) — fresh per call`);
console.log(`Contains backbone in stable:    ${sample.stable.includes(BACKBONE.slice(0, 50))}`);
console.log(`Contains founder overlay:        ${sample.stable.includes("OVERLAY: FOUNDER")}`);
console.log(`Contains capture mode contract:  ${sample.stable.includes("MODE: CAPTURE")}`);
console.log(`Contains user-layer in stable:   ${sample.stable.includes("USER LEXICON")}`);
console.log(`Contains 'V' collaborator:       ${sample.stable.includes("named you V")}`);

console.log("\n=== ALL TESTS PASSED ===");
