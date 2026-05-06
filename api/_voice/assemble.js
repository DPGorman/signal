// Signal — System prompt assembler
// Pure composition (composePrompt) + DB-aware wrapper (assembleSystemPrompt).
// Source of truth: SIGNAL_VOICE_AND_OVERLAYS_2026-05-06_v2.1.md §15 (user layer architecture).

import { BACKBONE } from "./backbone.js";
import { OVERLAYS } from "./overlays.js";
import { MODES } from "./modes.js";

const SEPARATOR = "\n\n---\n\n";
const DEFAULT_CRAFT = "screenwriter"; // fallback if user has no craft set
const LEXICON_LIMIT = 30;

/**
 * Format the user-layer block from extracted lexicon + voice card + collaborator name.
 * Returns empty string if there's nothing to inject (cold start).
 */
function formatUserLayer({ lexicon, voiceCard, collaboratorName }) {
  const blocks = [];

  if (collaboratorName) {
    blocks.push(`The user has named you ${collaboratorName}. Use that name when self-referring (e.g., "${collaboratorName} noticed…" instead of "Signal noticed…"). Do not reference Signal as a separate product.`);
  }

  if (lexicon && lexicon.length > 0) {
    const proper = lexicon.filter(l => l.type === "proper_noun").map(l => l.term);
    const project = lexicon.filter(l => l.type === "project_term").map(l => l.term);
    const phrasings = lexicon.filter(l => l.type === "user_phrasing").map(l => l.term);

    const lex = [];
    if (proper.length) lex.push(`Proper nouns this user uses: ${proper.join(", ")}.`);
    if (project.length) lex.push(`Project-specific terms: ${project.join(", ")}.`);
    if (phrasings.length) lex.push(`Recurring phrasings the user has used: ${phrasings.join(", ")}.`);

    if (lex.length) {
      blocks.push(`USER LEXICON (recognize and use these — they're how this user names their work):\n${lex.join("\n")}`);
    }
  }

  if (voiceCard) {
    blocks.push(`USER VOICE CARD (a peer-readable note about how this user thinks — for recognition, not imitation; you stay in your own voice):\n${voiceCard}`);
  }

  return blocks.length > 0 ? blocks.join("\n\n") : "";
}

/**
 * Format runtime context (canon docs, recent ideas, open deliverables) into a single block.
 * Caller passes either a string (pre-formatted) or a structured object.
 */
function formatRuntimeContext(runtimeContext) {
  if (!runtimeContext) return "";
  if (typeof runtimeContext === "string") return runtimeContext;

  // Structured form: {projectName, canonText, recentIdeas, openDeliverables, ...}
  const lines = [];
  if (runtimeContext.projectName) lines.push(`PROJECT: ${runtimeContext.projectName}`);
  if (runtimeContext.canonText) lines.push(`CANON:\n${runtimeContext.canonText}`);
  if (runtimeContext.recentIdeas) lines.push(`RECENT IDEAS:\n${runtimeContext.recentIdeas}`);
  if (runtimeContext.openDeliverables) lines.push(`OPEN DELIVERABLES:\n${runtimeContext.openDeliverables}`);
  if (runtimeContext.extra) lines.push(runtimeContext.extra);
  return lines.join("\n\n");
}

/**
 * Pure prompt composition. No I/O, no DB. Easy to test in isolation.
 *
 * Splits the assembled prompt into a STABLE part (backbone + craft overlay
 * + user layer + mode contract — same across calls within a user/mode pair)
 * and a RUNTIME part (canon + recent ideas + open deliverables — changes
 * every call). The split lets the API caller put a cache_control breakpoint
 * between them so the stable portion gets cached for ~90% off on subsequent
 * calls within the 5-minute TTL. See B13 in handoff.
 *
 * @param {object} params
 * @param {string} params.craft — one of the OVERLAYS keys; falls back to DEFAULT_CRAFT
 * @param {Array<{term:string,type:string}>} [params.lexicon] — user's distinctive vocabulary, top-N
 * @param {string} [params.voiceCard] — 200-400 word peer-readable signature
 * @param {string} [params.collaboratorName] — optional user-supplied AI name
 * @param {string} params.mode — one of the MODES keys
 * @param {string|object} [params.runtimeContext] — canon + recent ideas + open deliverables
 * @returns {{stable: string, runtime: string}} the assembled prompt in two parts
 */
export function composePrompt({ craft, lexicon, voiceCard, collaboratorName, mode, runtimeContext }) {
  const overlayKey = craft && OVERLAYS[craft] ? craft : DEFAULT_CRAFT;
  const overlay = OVERLAYS[overlayKey];

  const modeContract = MODES[mode];
  if (!modeContract) {
    throw new Error(`Unknown mode: ${mode}. Valid modes: ${Object.keys(MODES).join(", ")}`);
  }

  const userLayer = formatUserLayer({ lexicon, voiceCard, collaboratorName });
  const runtime = formatRuntimeContext(runtimeContext);

  const stable = [BACKBONE, overlay, userLayer, modeContract]
    .filter(Boolean)
    .join(SEPARATOR);

  return { stable, runtime };
}

/**
 * Build the Anthropic API system content array with a cache_control breakpoint
 * after the stable portion. Anthropic silently ignores cache_control on prompts
 * smaller than the per-model minimum (1024 tokens for Sonnet 4.x), so this is
 * always safe. Returns undefined if both parts are empty.
 *
 * @param {{stable: string, runtime: string}} parts
 * @returns {Array|undefined} system content array shaped for Anthropic's messages API
 */
export function toCacheableSystemContent({ stable, runtime } = {}) {
  const blocks = [];
  if (stable) {
    blocks.push({
      type: "text",
      text: stable,
      cache_control: { type: "ephemeral" },
    });
  }
  if (runtime) {
    blocks.push({ type: "text", text: runtime });
  }
  return blocks.length > 0 ? blocks : undefined;
}

/**
 * DB-aware wrapper. Takes a Supabase client + userId + mode + runtime context.
 * Reads the user's craft, lexicon, and active voice card from the database.
 * Returns {stable, runtime} so callers can apply cache_control to the stable
 * portion (see toCacheableSystemContent).
 *
 * @returns {Promise<{stable: string, runtime: string}>}
 */
export async function assembleSystemPrompt({ supabase, userId, mode, runtimeContext }) {
  if (!supabase) throw new Error("assembleSystemPrompt: supabase client required");
  if (!userId) throw new Error("assembleSystemPrompt: userId required");
  if (!mode) throw new Error("assembleSystemPrompt: mode required");

  // User's craft + collaborator name (one row)
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("craft, sub_craft, collaborator_name")
    .eq("id", userId)
    .single();

  if (userErr) {
    console.warn(`assembleSystemPrompt: could not load user ${userId}:`, userErr.message);
  }

  // Top-N lexicon entries by frequency
  const { data: lexiconRows, error: lexErr } = await supabase
    .from("user_lexicon")
    .select("term, type")
    .eq("user_id", userId)
    .order("frequency", { ascending: false })
    .limit(LEXICON_LIMIT);

  if (lexErr) {
    console.warn(`assembleSystemPrompt: could not load lexicon for ${userId}:`, lexErr.message);
  }

  // Active voice card (at most 1 — partial unique index enforces this)
  const { data: voiceCardRow, error: vcErr } = await supabase
    .from("user_voice_card")
    .select("signature")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (vcErr) {
    console.warn(`assembleSystemPrompt: could not load voice card for ${userId}:`, vcErr.message);
  }

  return composePrompt({
    craft: user?.craft,
    lexicon: lexiconRows || [],
    voiceCard: voiceCardRow?.signature,
    collaboratorName: user?.collaborator_name,
    mode,
    runtimeContext,
  });
}

// Named exports for callers
export { BACKBONE, OVERLAYS, MODES };
