// api/parse-file.js
// Zero-dependency text extraction for PDF, DOCX, TXT, MD

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

function extractPdfText(buffer) {
  const str = buffer.toString("latin1");
  const chunks = [];

  // Extract text from BT...ET blocks
  const btBlocks = str.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btBlocks) {
    // Match parentheses strings: (text)
    const parens = block.match(/\(([^)\\]*(\\.[^)\\]*)*)\)/g) || [];
    for (const p of parens) {
      const inner = p.slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()\\\n])/g, "$1");
      if (inner.trim()) chunks.push(inner);
    }
    // Match hex strings: <hex>
    const hexes = block.match(/<[0-9a-fA-F]+>/g) || [];
    for (const h of hexes) {
      const hex = h.slice(1, -1);
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code > 31 && code < 127) decoded += String.fromCharCode(code);
      }
      if (decoded.trim()) chunks.push(decoded);
    }
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function extractDocxText(buffer) {
  // DOCX is a zip — find word/document.xml and extract text from w:t elements
  const str = buffer.toString("latin1");
  const xmlMatch = str.match(/word\/document\.xml/);
  if (!xmlMatch) return "";

  // Find the XML content after the filename in the zip
  const chunks = [];
  const wtMatches = str.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  for (const match of wtMatches) {
    const text = match.replace(/<[^>]+>/g, "").trim();
    if (text) chunks.push(text);
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

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
      text = extractPdfText(buffer);

    } else if (ext === "docx" || ext === "doc") {
      text = extractDocxText(buffer);

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
