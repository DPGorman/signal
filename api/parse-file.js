// api/parse-file.js
import { Buffer } from "buffer";

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { content, filename } = req.body;
  if (!content || !filename) return res.status(400).json({ error: "Missing content or filename" });

  const ext = filename.split(".").pop().toLowerCase();
  const buffer = Buffer.from(content, "base64");

  try {
    let text = "";

    if (ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8");

    } else if (ext === "pdf") {
      const { default: pdfParse } = await import("pdf-parse");
      const result = await pdfParse(buffer);
      text = result.text;

    } else if (ext === "docx" || ext === "doc") {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else {
      return res.status(400).json({ error: `Unsupported file type: .${ext}` });
    }

    if (!text || text.trim().length < 5) {
      return res.status(422).json({ error: "File appears empty or could not be read." });
    }

    return res.status(200).json({ text: text.trim() });

  } catch (e) {
    console.error("parse-file error:", e);
    return res.status(500).json({ error: e.message });
  }
}
