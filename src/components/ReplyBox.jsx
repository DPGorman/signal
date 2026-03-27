import { useState } from "react";
import { C, mono, sans } from "../lib/constants";

export default function ReplyBox({ ideaId, section, compact, replies, onAddReply }) {
  const [draft, setDraft] = useState("");

  const existing = replies.filter(r =>
    ideaId
      ? (r.idea_id === ideaId && r.target_section === section)
      : (!r.idea_id && r.target_section === `studio_${section}`)
  );

  const send = async () => {
    if (await onAddReply(ideaId, section, draft)) setDraft("");
  };

  return (
    <div style={{ marginTop: 10 }}>
      {existing.map(r => (
        <div key={r.id} style={{ padding: "10px 14px", background: C.bg, borderLeft: `3px solid ${C.blue}`, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.blue, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 4 }}>
            YOU · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div style={{ fontSize: compact ? 12 : 14, color: C.textPrimary, lineHeight: 1.65 }}>{r.content}</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && draft.trim()) send(); }}
          placeholder="Respond..."
          style={{
            flex: 1, background: C.bg, border: `1px solid ${C.border}`,
            color: C.textPrimary, padding: compact ? "7px 10px" : "9px 12px",
            fontFamily: sans, fontSize: compact ? 12 : 13, outline: "none",
          }}
        />
        {draft.trim() && (
          <button
            onClick={send}
            style={{
              background: C.blue, border: "none", color: C.bg,
              padding: "7px 12px", fontFamily: mono, fontSize: 11,
              cursor: "pointer", flexShrink: 0,
            }}>
            ↵
          </button>
        )}
      </div>
    </div>
  );
}
