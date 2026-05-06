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
import { assembleSystemPrompt } from "./_voice/assemble.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, message, maxTokens, file, mode, userId, context } = req.body;

  // Resolve the system prompt: new-shape assembly OR legacy passthrough.
  // Legacy behavior preserved exactly: if no {mode, userId}, fall back to whatever
  // `system` is (defined or undefined) — same as the original handler.
  let systemPrompt;
  if (mode && userId) {
    try {
      systemPrompt = await assembleSystemPrompt({
        supabase,
        userId,
        mode,
        runtimeContext: context,
      });
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

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return res.status(200).json(JSON.parse(clean));
    } catch {
      return res.status(200).json({ raw: text });
    }
  } catch (e) {
    console.error("AI proxy error:", e);
    return res.status(500).json({ error: e.message });
  }
}
