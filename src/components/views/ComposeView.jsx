import { useRef } from "react";
import { C, mono, sans } from "../../lib/constants";

export default function ComposeView({ activeCompose, onSaveCompose, onNotify }) {
  const composeTitleRef = useRef(null);
  const composeContentRef = useRef(null);
  const composeSaveTimer = useRef(null);

  const autoSave = () => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(() => {
      const content = composeContentRef.current?.value || "";
      const title = composeTitleRef.current?.value || "Untitled";
      onSaveCompose(activeCompose.id, { title, content });
    }, 1500);
  };

  const saveNow = () => {
    const content = composeContentRef.current?.value || "";
    const title = composeTitleRef.current?.value || "Untitled";
    onSaveCompose(activeCompose.id, { title, content });
    onNotify("Saved.", "success");
  };

  if (!activeCompose) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>
        Select or create a document.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "36px 48px", overflow: "hidden" }}>
      <input
        ref={composeTitleRef}
        key={activeCompose.id + "-title"}
        defaultValue={activeCompose.title}
        placeholder="Document title..."
        onChange={autoSave}
        style={{ background: "transparent", border: "none", color: C.textPrimary, fontSize: 16, fontWeight: 500, outline: "none", marginBottom: 20, fontFamily: sans }}
      />
      <textarea
        ref={composeContentRef}
        key={activeCompose.id + "-content"}
        defaultValue={activeCompose.content}
        placeholder="Start writing, or paste content here..."
        onChange={autoSave}
        style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "20px 24px", fontFamily: sans, fontSize: 11, lineHeight: 1.9, outline: "none", resize: "none", overflowY: "auto", borderRadius: 6 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>Auto-saves as you type</span>
        <button onClick={saveNow}
          style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "6px 14px", fontFamily: mono, fontSize: 11, cursor: "pointer", borderRadius: 4 }}>
          SAVE NOW
        </button>
      </div>
    </div>
  );
}
