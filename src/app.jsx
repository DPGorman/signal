import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Database Configuration ---
const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  bg:           "#1C1B1F",
  surface:      "#2B2930",
  surfaceHigh:  "#36333D",
  border:       "#48454E",
  borderSubtle: "#3A3740",
  textPrimary:  "#E6E1E5",
  textSecondary:"#CAC4D0",
  textMuted:    "#938F99",
  textDisabled: "#49454F",
  gold:         "#E8C547",
  green:        "#6DD58C",
  red:          "#FF8A80",
  blue:         "#7ABCF6",
  purple:       "#CF9FFF",
};

const CATEGORIES = [
  { id: "premise",    label: "Premise",    icon: "⬥", color: "#E8C547" },
  { id: "character",  label: "Character",  icon: "⬥", color: "#FFB27A" },
  { id: "scene",      label: "Scene",      icon: "⬥", color: "#7ABCF6" },
  { id: "dialogue",   label: "Dialogue",   icon: "⬥", color: "#CF9FFF" },
  { id: "arc",        label: "Story Arc",  icon: "⬥", color: "#6DD58C" },
  { id: "production", label: "Production", icon: "⬥", color: "#FF8A80" },
  { id: "research",   label: "Research",   icon: "⬥", color: "#A8D8A8" },
  { id: "business",   label: "Business",   icon: "⬥", color: "#FF8FB1" },
];

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const DAILY_INVITATIONS = [
  "What are you afraid to write? That's probably the most important scene.",
  "Which character are you avoiding? Go there.",
  "What does your protagonist want that they can't admit?",
  "Name one thing that happens in this story that only this story could contain.",
  "What's the scene you keep circling without writing?",
];
const todayInvitation = DAILY_INVITATIONS[new Date().getDay() % DAILY_INVITATIONS.length];

export default function Signal() {
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [mapNodes, setMapNodes] = useState([]);
  
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeCompose, setActiveCompose] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [dragNode, setDragNode] = useState(null);

  const captureInputRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) loadAll(uid);
    else {
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => { if (data?.id) { localStorage.setItem("signal_user_id", data.id); loadAll(data.id); } else setIsLoading(false); });
    }
  }, []);

  const loadAll = async (uid) => {
    try {
      const [u, i, d, c, r, cd, cn] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid),
        supabase.from("canon_documents").select("*").eq("user_id", uid),
        supabase.from("replies").select("*").eq("user_id", uid),
        supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
        supabase.from("connections").select("*").eq("user_id", uid)
      ]);
      if (u.data) setUser(u.data);
      if (i.data) setIdeas(i.data);
      if (d.data) setDeliverables(d.data);
      if (c.data) setCanonDocs(c.data);
      if (r.data) setReplies(r.data);
      if (cd.data) setComposeDocs(cd.data);
      if (cn.data) setConnections(cn.data);
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    setMapNodes(ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      return { id: idea.id, color: getCat(idea.category).color, x: cx + Math.cos(angle) * 300, y: cy + Math.sin(angle) * 300, text: idea.text.slice(0, 30) };
    }));
  }, [ideas.length]);

  const captureIdea = async () => {
    const text = captureInputRef.current?.value.trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    const { data: saved } = await supabase.from("ideas").insert([{ user_id: user.id, text, category: "premise" }]).select().single();
    await loadAll(user.id);
    setActiveIdea(saved); navGo("library");
    setIsAnalyzing(false);
  };

  const saveCompose = async (id, updates) => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(async () => {
      await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }, 1000);
  };

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library") setActiveIdea(item || ideas[0]);
    if (v === "canon") setActiveDoc(item || canonDocs[0]);
    if (v === "compose") setActiveCompose(item || composeDocs[0]);
  };

  const currentFiltered = ideas.filter(i => !globalSearch || i.text.toLowerCase().includes(globalSearch.toLowerCase()));

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
          <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, padding: "10px 12px 10px 32px", borderRadius: 8, color: "white", outline: "none", fontSize: 13 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {["Dashboard", "Capture", "Library", "Canon", "Compose", "Connections", "Deliverables"].map(v => (
              <button key={v} onClick={() => navGo(v.toLowerCase() === "dashboard" ? "dashboard" : v.toLowerCase() === "deliverables" ? "deliverables" : v.toLowerCase() === "connections" ? "connections" : v.toLowerCase())} style={{ background: view === v.toLowerCase() ? C.gold+"20" : "transparent", border: `1px solid ${view === v.toLowerCase() ? C.gold : C.border}`, color: view === v.toLowerCase() ? C.gold : C.textMuted, padding: "5px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer" }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {view === "library" ? currentFiltered.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: 10, background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8, fontSize: 13 }}>{i.text.slice(0, 40)}</div>) : 
           view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: 10, background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8 }}>{d.title}</div>) :
           canonDocs.map(d => <div key={d.id} onClick={() => setActiveDoc(d)} style={{ padding: 10, color: d.is_active ? "white" : C.textDisabled, fontSize: 13 }}>{d.title}</div>)}
        </div>
      </div>

      {/* CENTER WORKSPACE */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <div style={{ padding: 60 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{user?.project_name} Dashboard</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 40 }}><div style={{ background: C.surface, padding: 24, borderRadius: 12 }}><div style={{ fontSize: 32, color: C.gold }}>{ideas.length}</div><div style={{ fontSize: 11, color: C.textMuted }}>IDEAS</div></div></div></div>}
        {view === "capture" && (
          <div style={{ padding: 60, maxWidth: 660, margin: "0 auto", width: "100%" }}>
            <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40, fontStyle: "italic", fontSize: 18 }}>{todayInvitation}</div>
            <textarea ref={captureInputRef} placeholder="Record signal..." rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6 }} />
            <button onClick={captureIdea} style={{ width: "100%", marginTop: 20, background: C.gold, padding: 16, borderRadius: 12, fontWeight: 700 }}>SEND SIGNAL →</button>
          </div>
        )}
        {view === "library" && activeIdea && (
          <div style={{ padding: 60, maxWidth: 800 }}>
             <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 12 }}>{activeIdea.category.toUpperCase()}</div>
             <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
             {activeIdea.ai_note && <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.borderSubtle}`, lineHeight: 1.7 }}>{activeIdea.ai_note}</div>}
          </div>
        )}
        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, title: val})); saveCompose(activeCompose.id, { title: val }); }} style={{ background: "transparent", border: "none", color: "white", fontSize: 24, fontWeight: 700, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, content: val})); saveCompose(activeCompose.id, { content: val }); }} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: "white", padding: 30, fontSize: 16, lineHeight: 1.8, outline: "none", resize: "none", marginTop: 20 }} />
          </div>
        )}
        {view === "connections" && (
          <div ref={mapContainerRef} onMouseUp={() => setDragNode(null)} onMouseMove={(e) => {
            if (!dragNode) return;
            const rect = mapContainerRef.current.getBoundingClientRect();
            setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: e.clientX - rect.left, y: e.clientY - rect.top } : n));
          }} style={{ flex: 1, position: "relative", background: C.bg }}>
            <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
              {connections.map((c, i) => {
                const a = mapNodes.find(n => n.id === c.idea_a); const b = mapNodes.find(n => n.id === c.idea_b);
                return a && b && <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} opacity={0.4} />;
              })}
            </svg>
            {mapNodes.map(n => <div key={n.id} onMouseDown={() => setDragNode(n.id)} style={{ position: "absolute", left: n.x - 12, top: n.y - 12, width: 24, height: 24, borderRadius: "50%", background: n.color, cursor: "grab", border: activeIdea?.id === n.id ? "3px solid white" : "none" }} />)}
          </div>
        )}
        {view === "deliverables" && <div style={{ padding: 60 }}><div style={{ fontSize: 24, fontWeight: 700 }}>Invitations to Action</div><div style={{ marginTop: 20 }}>{deliverables.map(d => <div key={d.id} style={{ padding: 16, background: C.surface, borderRadius: 8, marginBottom: 8 }}>{d.text}</div>)}</div></div>}
        {view === "canon" && activeDoc && <div style={{ padding: 60 }}><h1 style={{ marginBottom: 20 }}>{activeDoc.title}</h1><div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{activeDoc.content}</div></div>}
      </div>

      {/* RIGHT STUDIO */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, padding: 24 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>STUDIO AI</div>
          {studio && <div style={{ fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Roboto+Mono&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
      `}} />
    </div>
  );
}