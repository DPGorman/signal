// api/_anthropic.js — shared Claude / Anthropic Messages API caller.
//
// Single source of truth for model choice + Anthropic fetch boilerplate.
// Previously each AI-consuming endpoint inlined the fetch + headers + JSON
// shape; model swaps (Sonnet 4.6 → Opus 4.6 → back) required edits in 3+ files
// and could leave callers on different models (e.g. voicecard ended up on Opus
// while ai/pulse/recrawl stayed on Sonnet).
//
// Default model is DEFAULT_MODEL. Callers that intentionally want a different
// model (e.g. voicecard wanting Opus for signature quality) pass `model:` explicitly.

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const HIGH_QUALITY_MODEL = "claude-opus-4-6";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Call the Anthropic Messages API.
 *
 * @param {Object}        opts
 * @param {string|Array}  opts.system          - System prompt (string or cacheable content array)
 * @param {Array}         opts.messages        - Messages array [{role, content}]
 * @param {number}        [opts.maxTokens=1000]
 * @param {string}        [opts.model]         - Defaults to DEFAULT_MODEL
 * @param {string[]}      [opts.betas]         - e.g. ["pdfs-2024-09-25"]
 * @returns {Promise<Object>}                  - Parsed Anthropic response body
 * @throws  {Error}                            - Non-2xx throws with .status and .body attached
 */
export async function callClaude({
  system,
  messages,
  maxTokens = 1000,
  model = DEFAULT_MODEL,
  betas = [],
}) {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": ANTHROPIC_VERSION,
  };
  if (betas.length > 0) headers["anthropic-beta"] = betas.join(",");

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Anthropic ${response.status}: ${body}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return response.json();
}

/** Extract the concatenated text from an Anthropic response body. */
export function extractText(data) {
  return data.content?.map((b) => b.text || "").join("") || "";
}
