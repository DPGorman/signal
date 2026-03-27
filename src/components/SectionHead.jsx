import { C, mono } from "../lib/constants";

export default function SectionHead({ label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em",
        cursor: onClick ? "pointer" : "default", display: "inline-flex",
        alignItems: "center", gap: 5, transition: "color 0.15s",
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.color = C.gold)}
      onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
      {label}{onClick && <span style={{ fontSize: 11 }}>→</span>}
    </div>
  );
}
