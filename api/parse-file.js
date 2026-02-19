// ============================================
// SIGNAL: File Parser
// api/parse-file.js
// Handles PDF, docx, txt, md — any text-bearing file
// ============================================

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { content, filename, mimeType } = req.body;

    if (!content || !filename) {
      return res.status(400).json({ error: "Missing content or filename" });
    }

    // content arrives as base64
    const buffer = Buffer.from(content, "base64");
    const ext = filename.split(".").pop().toLowerCase();

    let text = "";

    if (ext === "txt" || ext === "md" || ext === "rtf") {
      // Plain text — just decode
      text = buffer.toString("utf-8");

    } else if (ext === "pdf") {
      // Extract text from PDF using pdf-parse
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const data = await pdfParse(buffer);
      text = data.text;

    } else if (ext === "docx") {
      // Extract text from Word doc using mammoth
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else if (ext === "doc") {
      // Older Word format — best effort text extraction
      text = buffer.toString("utf-8")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    } else {
      // Unknown — try utf-8 decode
      text = buffer.toString("utf-8");
    }

    // Clean up
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return res.status(200).json({ text, filename });

  } catch (e) {
    console.error("parse-file error:", e);
    return res.status(500).json({ error: e.message });
  }
}
