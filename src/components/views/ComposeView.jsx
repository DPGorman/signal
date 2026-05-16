import { useRef } from "react";
import { C, mono, sans } from "../../lib/constants";

export default function ComposeView({ activeCompose, onSave, onNotify }) {
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const saveTimer = useRef(null);

  const autoSave = (id) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const content = contentRef.current?.value || "";
      const title = titleRef.current?.value || "Untitled";
      onSave(id, { title, content });
    }, 1500);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {!activeCompose
        ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>Select or create a document.</div>
        : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "36px 48px", overflow: "hidden" }}>
            <input
              ref={titleRef}
              key={activeCompose.id + "-title"}
              defaultValue={activeCompose.title}
              placeholder="Document title..."
              onChange={() => autoSave(activeCompose.id)}
              style={{ background: "transparent", border: "none", color: C.textPrimary, fontSize: 17, fontWeight: 500, outline: "none", marginBottom: 20, fontFamily: sans }}
            />
            <textarea
              ref={contentRef}
              key={activeCompose.id + "-content"}
              defaultValue={activeCompose.content}
              placeholder="Start writing, or paste content here..."
              onChange={() => autoSave(activeCompose.id)}
              style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "20px 24px", fontFamily: sans, fontSize: 12, lineHeight: 1.9, outline: "none", resize: "none", overflowY: "auto", borderRadius: 6 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>Auto-saves as you type</span>
              <button onClick={() => {
                const content = contentRef.current?.value || "";
                const title = titleRef.current?.value || "Untitled";
                onSave(activeCompose.id, { title, content });
                onNotify("Saved.", "success");
              }}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "6px 14px", fontFamily: mono, fontSize: 12, cursor: "pointer", borderRadius: 4 }}>
                SAVE NOW
              </button>
            </div>
          </div>
        )
      }
    </div>
  );
}
