import { C, DOC_TYPES, mono, sans, inputBase } from "../../lib/constants";
import Highlight from "../Highlight";

export default function CanonView({
  showUpload,
  canonUpload,
  isProcessing,
  isUploading,
  uploadedName,
  onChangeUpload,
  onProcessFile,
  onUpload,
  activeDoc,
  searchHighlight,
  onToggleCanon,
  onDeleteCanon,
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      {showUpload && (
        <div style={{ maxWidth: 500, marginBottom: 32, padding: "20px 24px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <input value={canonUpload.title} onChange={e => onChangeUpload(p => ({ ...p, title: e.target.value }))}
            placeholder="Document title"
            style={{ ...inputBase, marginBottom: 10, fontSize: 12 }} />
          <select value={canonUpload.type} onChange={e => onChangeUpload(p => ({ ...p, type: e.target.value }))}
            style={{ ...inputBase, marginBottom: 10, fontSize: 12 }}>
            {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>UPLOAD FILE</div>
          <label style={{ display: "block", marginBottom: 10 }}>
            <input type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }} disabled={isProcessing}
              onChange={async (e) => { const file = e.target.files[0]; if (file) await onProcessFile(file); e.target.value = ""; }} />
            <div style={{ background: isProcessing ? C.border : C.bg, border: `1px solid ${isProcessing ? C.gold : uploadedName ? C.green : C.border}`, color: isProcessing ? C.gold : uploadedName ? C.green : C.textSecondary, padding: "10px 14px", fontFamily: mono, fontSize: 12, cursor: isProcessing ? "default" : "pointer", borderRadius: 4 }}>
              {isProcessing ? "READING FILE..." : uploadedName ? `✓ ${uploadedName}` : "CHOOSE FILE →"}
            </div>
          </label>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>OR PASTE TEXT</div>
          <textarea value={canonUpload.content} onChange={e => onChangeUpload(p => ({ ...p, content: e.target.value }))}
            placeholder="Paste document text here..." rows={5}
            style={{ ...inputBase, fontSize: 12, resize: "vertical", marginBottom: 8 }} />
          <button onClick={onUpload} disabled={isUploading || !canonUpload.title || !canonUpload.content}
            style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: sans, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
            {isUploading ? "SAVING..." : "ADD TO CANON →"}
          </button>
        </div>
      )}
      {!activeDoc
        ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>Select a document from the sidebar.</div>
        : (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 17, color: C.textPrimary, fontWeight: 500 }}><Highlight text={activeDoc.title} term={searchHighlight} /></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onToggleCanon(activeDoc.id, activeDoc.is_active)}
                  style={{ fontSize: 12, color: activeDoc.is_active ? C.textMuted : C.green, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  {activeDoc.is_active ? "DEACTIVATE" : "ACTIVATE"}
                </button>
                <button onClick={() => onDeleteCanon(activeDoc.id)}
                  style={{ fontSize: 12, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  DELETE
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, marginBottom: 32 }}>{activeDoc.content?.length?.toLocaleString()} chars · {activeDoc.is_active ? "active" : "inactive"}</div>
            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: sans }}><Highlight text={activeDoc.content} term={searchHighlight} /></div>
          </div>
        )
      }
    </div>
  );
}
