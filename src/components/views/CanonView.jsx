import { useState } from "react";
import { C, DOC_TYPES, mono, sans, inputBase } from "../../lib/constants";
import Highlight from "../Highlight";

export default function CanonView({ canonDocs, activeDoc, searchHighlight, onToggleCanon, onDeleteCanon, onSetActiveDoc, onUploadCanon }) {
  const [showUpload, setShowUpload] = useState(false);
  const [canonUpload, setCanonUpload] = useState({ title: "", type: "reference", content: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedName, setUploadedName] = useState("");

  const processFile = async (file) => {
    if (!file || isProcessing) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    setIsProcessing(true);
    setUploadedName("");
    setCanonUpload(p => ({ ...p, content: "" }));
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let data = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch("/api/parse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: base64, filename: file.name }),
          });
          data = await res.json();
          if (res.ok && data.text) break;
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
        } catch (fetchErr) {
          if (attempt === 3) throw fetchErr;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (!data?.text) throw new Error(data?.error || "Failed to parse file.");
      if (data.text.trim().length < 10) throw new Error("File appears empty or could not be read.");

      setCanonUpload(p => ({ ...p, content: data.text.trim(), title: p.title || name }));
      setUploadedName(file.name);
    } catch (err) {
      console.error("File read error:", err);
      alert("Could not read file. Try pasting the text instead.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!canonUpload.title || !canonUpload.content) return;
    setIsUploading(true);
    const success = await onUploadCanon(canonUpload);
    setIsUploading(false);
    if (success) {
      setCanonUpload({ title: "", type: "reference", content: "" });
      setUploadedName("");
      setShowUpload(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      {showUpload && (
        <div style={{ maxWidth: 500, marginBottom: 32, padding: "20px 24px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))}
            placeholder="Document title"
            style={{ ...inputBase, marginBottom: 10, fontSize: 11 }} />
          <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
            style={{ ...inputBase, marginBottom: 10, fontSize: 11 }}>
            {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>UPLOAD FILE</div>
          <label style={{ display: "block", marginBottom: 10 }}>
            <input type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }} disabled={isProcessing}
              onChange={async (e) => { const file = e.target.files[0]; if (file) await processFile(file); e.target.value = ""; }} />
            <div style={{ background: isProcessing ? C.border : C.bg, border: `1px solid ${isProcessing ? C.gold : uploadedName ? C.green : C.border}`, color: isProcessing ? C.gold : uploadedName ? C.green : C.textSecondary, padding: "10px 14px", fontFamily: mono, fontSize: 11, cursor: isProcessing ? "default" : "pointer", borderRadius: 4 }}>
              {isProcessing ? "READING FILE..." : uploadedName ? `✓ ${uploadedName}` : "CHOOSE FILE →"}
            </div>
          </label>

          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>OR PASTE TEXT</div>
          <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
            placeholder="Paste document text here..." rows={5}
            style={{ ...inputBase, fontSize: 11, resize: "vertical", marginBottom: 8 }} />

          <button onClick={handleUpload} disabled={isUploading || !canonUpload.title || !canonUpload.content}
            style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
            {isUploading ? "SAVING..." : "ADD TO CANON →"}
          </button>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setShowUpload(!showUpload)}
          style={{ background: showUpload ? "transparent" : C.gold, color: showUpload ? C.textMuted : C.bg, border: showUpload ? `1px solid ${C.border}` : "none", padding: "8px 16px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
          {showUpload ? "CANCEL" : "+ ADD TO CANON"}
        </button>
      </div>

      {!activeDoc
        ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>Select a document from the sidebar.</div>
        : (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, color: C.textPrimary, fontWeight: 500 }}>
                <Highlight text={activeDoc.title} term={searchHighlight} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onToggleCanon(activeDoc.id, activeDoc.is_active)}
                  style={{ fontSize: 11, color: activeDoc.is_active ? C.textMuted : C.green, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  {activeDoc.is_active ? "DEACTIVATE" : "ACTIVATE"}
                </button>
                <button onClick={() => onDeleteCanon(activeDoc.id)}
                  style={{ fontSize: 11, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  DELETE
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 32 }}>
              {activeDoc.content?.length?.toLocaleString()} chars · {activeDoc.is_active ? "active" : "inactive"}
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: sans }}>
              <Highlight text={activeDoc.content} term={searchHighlight} />
            </div>
          </div>
        )
      }
    </div>
  );
}
