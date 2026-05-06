// api/ai.js — AI proxy for Signal
//
// Accepts TWO request shapes (additive — old callers keep working):
//
//   1. Legacy shape (existing iOS app, existing client app.jsx callers):
//        { system, message, maxTokens?, file? }
//      The caller has constructed the full system prompt themselves.
//      Behavior unchanged from prior versions.
//
//   2. New shape (voice-overlay system, used by migrated callers):
//        { mode, userId, message, maxTokens?, file?, context? }
//      The proxy assembles the system prompt server-side from
//      [backbone] + [craft overlay] + [user lexicon + voice card] + [mode contract] + [context].
//      Per voice doc v2.1 §15 (user-layer architecture).
//
// Exactly one of {system} or {mode + userId} must be provided.

import { createClient } from "@supabase/supabase-js";
import { assembleSystemPrompt, toCacheableSystemContent } from "./_voice/assemble.js";
import { getUpcomingEvents, formatEventsForContext } from "./_calendar/get-events.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

// Flatten capture-mode lexicon_extract into [{term, type}] for upsert_lexicon_terms RPC.
// Schema: {proper_nouns:[], project_terms:[], user_phrasings:[]} → user_lexicon.type values.
function flattenLexicon(lex) {
  if (!lex || typeof lex !== "object") return [];
  const map = {
    proper_nouns: "proper_noun",
    project_terms: "project_term",
    user_phrasings: "user_phrasing",
  };
  const out = [];
  for (const [key, type] of Object.entries(map)) {
    const arr = lex[key];
    if (!Array.isArray(arr)) continue;
    for (const term of arr) {
      if (typeof term === "string" && term.trim()) {
        out.push({ term: term.trim(), type });
      }
    }
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, message, maxTokens, file, mode, userId, context } = req.body;

  // Resolve the system prompt:
  //   - New shape ({mode, userId}) → assemble {stable, runtime}, build a cacheable
  //     content array so the stable portion (backbone + overlay + user-layer + mode
  //     contract, ~2.7K tokens) gets ~90% off on cache hits within the 5-min TTL.
  //   - Legacy shape ({system} string) → pass through unchanged. Anthropic accepts
  //     both string and array forms in the system field.
  let systemPrompt;
  if (mode && userId) {
    try {
      // Inject calendar context for modes that benefit from time-window awareness.
      // Audit is skipped — it's a hygiene utility, calendar is irrelevant.
      // Failures are logged but never block the call (calendar is optional).
      let runtimeContext = context || "";
      if (["capture", "studio", "pulse", "insight"].includes(mode)) {
        const events = await getUpcomingEvents(supabase, userId, 7);
        const calendarBlock = formatEventsForContext(events);
        if (calendarBlock) {
          runtimeContext = [runtimeContext, calendarBlock].filter(Boolean).join("\n\n");
        }
      }

      const parts = await assembleSystemPrompt({
        supabase,
        userId,
        mode,
        runtimeContext,
      });
      systemPrompt = toCacheableSystemContent(parts);
    } catch (e) {
      console.error("AI proxy: assemble failed:", e.message);
      return res.status(400).json({ error: `Failed to assemble system prompt: ${e.message}` });
    }
  } else {
    systemPrompt = system;
  }

  // Build user content (unchanged from prior version — file handling intact).
  let userContent;

  if (file) {
    // Claude natively supports PDF only
    // For all other types, extract text server-side and send as text
    const ext = (file.filename || "").split(".").pop().toLowerCase();

    if (ext === "pdf" || file.mediaType === "application/pdf") {
      // Send as native document
      userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: file.base64,
          },
        },
        {
          type: "text",
          text: message || "Extract all the text from this document. Return only the extracted text, preserving paragraph breaks. No commentary.",
        },
      ];
    } else {
      // Decode base64 and send as plain text
      const buffer = Buffer.from(file.base64, "base64");
      const text = buffer.toString("utf-8");
      userContent = `${message || "Here is a document:"}\n\n${text}`;
    }
  } else {
    userContent = message;
  }

  // Anthropic rejects empty user content. Mode-driven calls (studio, audit, insight)
  // are fully specified by the system prompt and don't have a natural user message —
  // supply a minimal trigger phrase so the API accepts the request.
  if (typeof userContent !== "string" || userContent.length === 0) {
    userContent = mode ? `Begin ${mode}.` : "Begin.";
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens || 1000,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";

    if (file) {
      return res.status(200).json({ text });
    }

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({ raw: text });
    }

    // Capture mode: persist lexicon_extract to user_lexicon. Failures are logged
    // but never block the analysis response — the user always gets their result.
    if (mode === "capture" && userId && parsed?.lexicon_extract) {
      const flat = flattenLexicon(parsed.lexicon_extract);
      if (flat.length > 0) {
        try {
          const { error: lexErr } = await supabase.rpc("upsert_lexicon_terms", {
            p_user_id: userId,
            p_terms: flat,
          });
          if (lexErr) console.warn("Lexicon write failed:", lexErr.message);
        } catch (e) {
          console.warn("Lexicon write threw:", e.message);
        }
      }
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error("AI proxy error:", e);
    return res.status(500).json({ error: e.message });
  }
}
