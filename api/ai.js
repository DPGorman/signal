// api/ai.js
export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, message, maxTokens, file } = req.body;

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
        model: "claude-sonnet-4-5-20250929",
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
