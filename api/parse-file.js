// ============================================
// SIGNAL: File Parser
// api/parse-file.js
// Zero external dependencies — works on any Vercel deployment
// ============================================
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { content, filename } = req.body;
    if (!content || !filename) {
      return res.status(400).json({ error: "Missing content or filename" });
    }

    const buffer = Buffer.from(content, "base64");
    const ext = filename.split(".").pop().toLowerCase();
    let text = "";

    if (ext === "txt" || ext === "md" || ext === "rtf") {
      text = buffer.toString("utf-8");

    } else if (ext === "pdf") {
      // Extract readable text from PDF binary without pdf-parse
      // PDF stores text in stream objects between BT/ET markers
      const raw = buffer.toString("latin1");
      const textParts = [];

      // Extract text from BT...ET blocks (standard PDF text blocks)
      const btMatches = raw.matchAll(/BT([\s\S]*?)ET/g);
      for (const match of btMatches) {
        const block = match[1];
        // Extract strings in parentheses: (Hello World)
        const parenMatches = block.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g);
        for (const m of parenMatches) {
          const str = m[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\n")
            .replace(/\\t/g, " ")
            .replace(/\\\\/g, "\\")
            .replace(/\\[()]/g, m => m[1]);
          if (str.trim()) textParts.push(str);
        }
        // Extract hex strings: <48656c6c6f>
        const hexMatches = block.matchAll(/<([0-9a-fA-F]+)>/g);
        for (const m of hexMatches) {
          const hex = m[1];
          if (hex.length % 2 === 0) {
            let str = "";
            for (let i = 0; i < hex.length; i += 2) {
              const code = parseInt(hex.slice(i, i + 2), 16);
              if (code > 31 && code < 127) str += String.fromCharCode(code);
            }
            if (str.trim().length > 1) textParts.push(str);
          }
        }
      }

      text = textParts.join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // Fallback: if we got very little, try raw latin1 printable chars
      if (text.length < 100) {
        text = raw
          .replace(/[^\x20-\x7E\n\r\t]/g, " ")
          .replace(/\s{3,}/g, "\n\n")
          .replace(/[^\S\n]{2,}/g, " ")
          .trim();
        // Remove obvious PDF binary noise
        text = text.split("\n")
          .filter(line => {
            const words = line.trim().split(/\s+/);
            const readable = words.filter(w => /^[a-zA-Z]{2,}/.test(w)).length;
            return readable > 0 && line.trim().length > 3;
          })
          .join("\n");
      }

    } else if (ext === "docx") {
      // DOCX is a zip file — extract word/document.xml and strip tags
      // We can find XML content without unzipping by searching for the XML pattern
      const raw = buffer.toString("latin1");

      // Find w:t (Word text) elements in the raw zip content
      const textParts = [];
      const wtMatches = raw.matchAll(/w:t[^>]*>([^<]+)</g);
      for (const m of wtMatches) {
        const str = m[1].trim();
        if (str) textParts.push(str);
      }

      if (textParts.length > 0) {
        text = textParts.join(" ").replace(/\s+/g, " ").trim();
      } else {
        // Fallback: extract any readable text runs
        text = raw
          .replace(/[^\x20-\x7E\n\r\t]/g, " ")
          .replace(/\s{3,}/g, "\n")
          .trim();
        text = text.split("\n")
          .filter(line => /[a-zA-Z]{3,}/.test(line) && line.trim().length > 5)
          .join("\n");
      }

    } else if (ext === "doc") {
      text = buffer.toString("utf-8")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      text = buffer.toString("utf-8");
    }

    // Final cleanup
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 10) {
      return res.status(422).json({ error: "Could not extract text from this file. Try copying and pasting the text directly." });
    }

    return res.status(200).json({ text, filename });

  } catch (e) {
    console.error("parse-file error:", e);
    return res.status(500).json({ error: e.message });
  }
}
