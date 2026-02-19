// ============================================
// SIGNAL: AI Proxy
// api/ai.js
// Handles both text prompts and file extraction (PDF, DOCX, images)
// Claude reads files natively — no parsing libraries needed
// ============================================
export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, message, maxTokens, file } = req.body;

  // Build the user content — either plain text or file + text
  let userContent;

  if (file) {
    // file = { base64, mediaType, filename }
    // Claude supports: application/pdf, image/*, and treats docx as document
    const mediaType = file.mediaType || "application/pdf";

    userContent = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: mediaType,
          data: file.base64,
        },
      },
      {
        type: "text",
        text: message || "Extract all the text from this document. Return only the extracted text, no commentary.",
      },
    ];
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
        model: "claude-opus-4-6",
        max_tokens: maxTokens || 1000,
        system: system || undefined,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";

    // If this was a file extraction, return raw text
    if (file) {
      return res.status(200).json({ text });
    }

    // Otherwise parse as JSON (existing behavior)
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
