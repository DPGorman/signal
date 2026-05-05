// Isolation test for composePrompt. Run with: node api/_voice/_test_compose.js
// Tests:
//   1. Three crafts compose without errors (screenwriter, founder, chef)
//   2. All 6 modes resolve
//   3. Cold-start case (no lexicon, no voice card) doesn't crash
//   4. Full case (lexicon + voice card + collaborator name) composes the user-layer block
//   5. Unknown craft falls back to default
//   6. Unknown mode throws

import { composePrompt, BACKBONE, OVERLAYS, MODES } from "./assemble.js";

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
    const prompt = composePrompt({ ...user, mode, runtimeContext: "" });
    assert(typeof prompt === "string", `compose: ${user.craft} × ${mode} returns string`);
    assert(prompt.includes(BACKBONE.slice(0, 50)), `compose: ${user.craft} × ${mode} includes backbone`);
    assert(prompt.includes(OVERLAYS[user.craft].slice(0, 30)), `compose: ${user.craft} × ${mode} includes craft overlay`);
    assert(prompt.includes(MODES[mode].slice(0, 30)), `compose: ${user.craft} × ${mode} includes mode contract`);
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
assert(!coldStart.includes("USER LEXICON"), "cold-start: no USER LEXICON block");
assert(!coldStart.includes("USER VOICE CARD"), "cold-start: no USER VOICE CARD block");
assert(!coldStart.includes("named you"), "cold-start: no collaborator name reference");

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
assert(fullUserLayer.includes("Sal"), "full: collaborator name 'Sal' injected");
assert(fullUserLayer.includes("Ava"), "full: proper noun 'Ava' injected");
assert(fullUserLayer.includes("soft-tell"), "full: phrasing 'soft-tell' injected");
assert(fullUserLayer.includes("Daniel buries his thesis"), "full: voice card text injected");
assert(fullUserLayer.includes("CRISPR"), "full: runtime context injected");

// 4. Unknown craft → fallback to default
const unknownCraft = composePrompt({
  craft: "luthier", // not a V1 overlay
  lexicon: [],
  voiceCard: null,
  collaboratorName: null,
  mode: "capture",
  runtimeContext: "",
});
assert(unknownCraft.includes(OVERLAYS.screenwriter.slice(0, 30)), "unknown craft falls back to screenwriter");

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

// 6. Show one full prompt for visual inspection (founder, capture mode, full layer)
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
console.log(`Prompt length: ${sample.length} chars (~${Math.round(sample.length / 4)} tokens)`);
console.log(`Contains backbone: ${sample.includes(BACKBONE.slice(0, 50))}`);
console.log(`Contains founder overlay: ${sample.includes("OVERLAY: FOUNDER")}`);
console.log(`Contains capture mode: ${sample.includes("MODE: CAPTURE")}`);
console.log(`Contains user layer: ${sample.includes("USER LEXICON")}`);
console.log(`Contains 'V' collaborator: ${sample.includes("named you V")}`);

console.log("\n=== ALL TESTS PASSED ===");
