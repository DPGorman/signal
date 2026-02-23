import { useState, useEffect, useRef } from "react";
import { supabase, loadAllData, getMapCoords, callAI } from "./logic";

const C = { bg: "#1C1B1F", surface: "#2B2930", border: "#48454E", gold: "#E8C547", textP: "#E6E1E5", textS: "#938F99" };

export default function Signal() {
  const [data, setData] = useState({ ideas: [], deliverables: [], canonDocs: [], composeDocs: [], connections: [] });
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const captureInputRef = useRef(null);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) loadAllData(uid).then(d => { setData(d); setIsLoading(false); });
    else setIsLoading(false);
  }, []);

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textP, fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>signal</div>
        {["Dashboard", "Capture", "Library", "Compose", "Map"].map(v => (
          <button key={v} onClick={() => setView(v.toLowerCase())} style={{ display: "block", width: "100%", padding: 10, background: view === v.toLowerCase() ? C.gold : "transparent", color: view === v.toLowerCase() ? C.bg : "white", border: "none", borderRadius: 4, cursor: "pointer", textAlign: "left", marginBottom: 5 }}>{v.toUpperCase()}</button>
        ))}
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, overflowY: "auto", padding: 60 }}>
        {view === "dashboard" && <div><h1 style={{ fontSize: 28 }}>{data.user?.project_name}</h1><div style={{ fontSize: 40, color: C.gold, marginTop: 40 }}>{data.ideas.length} <span style={{ fontSize: 14, color: "white" }}>IDEAS</span></div></div>}
        {view === "library" && (
            <div style={{ display: "flex", gap: 40 }}>
                <div style={{ width: 250 }}>{data.ideas.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: 10, cursor: "pointer", background: activeIdea?.id === i.id ? C.border : "transparent" }}>{i.text.slice(0, 30)}...</div>)}</div>
                <div style={{ flex: 1 }}>{activeIdea && <div style={{ fontSize: 22 }}>{activeIdea.text}</div>}</div>
            </div>
        )}
      </div>

      {/* Right Studio */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 11, color: C.textS, marginBottom: 20 }}>STUDIO</div>
        <button style={{ width: "100%", padding: 12, background: C.bg, color: "white", borderRadius: 8, border: `1px solid ${C.border}` }}>💡 Synthesis</button>
      </div>
    </div>
  );
}