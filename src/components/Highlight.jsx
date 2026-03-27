export default function Highlight({ text, term }) {
  if (!term || term.length < 2 || !text || typeof text !== "string") return <>{text || ""}</>;
  try {
    const parts = [];
    const lower = text.toLowerCase();
    const tLower = term.toLowerCase();
    let last = 0;
    let idx = lower.indexOf(tLower);
    let count = 0;
    while (idx !== -1 && count < 50) {
      if (idx > last) parts.push(<span key={"t" + idx}>{text.slice(last, idx)}</span>);
      parts.push(
        <span key={"h" + idx} style={{ background: "#E8C54740", color: "#E8C547", borderRadius: 2, padding: "0 1px" }}>
          {text.slice(idx, idx + term.length)}
        </span>
      );
      last = idx + term.length;
      idx = lower.indexOf(tLower, last);
      count++;
    }
    if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
    return parts.length ? <>{parts}</> : <>{text}</>;
  } catch {
    return <>{text}</>;
  }
}
