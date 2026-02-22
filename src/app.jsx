import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

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

const DAILY_INVITATIONS = [
  "What are you afraid to write? That's probably the most important scene.",
  "Which character are you avoiding? Go there.",
  "What does your protagonist want that they can't admit?",
  "Name one thing that happens in this story that only this story could contain.",
  "What's the scene you keep circling without writing?",
  "If this series had a moral argument, what would it be?",
  "What would the antagonist say if they were the hero?",
  "Which idea from this week is still alive in you right now?",
];

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const todayInvitation = DAILY_INVITATIONS[new Date().getDay() % DAILY_INVITATIONS.length];

const Highlight = ({ text, term }) => {
  if (!term || term.length < 2 || !text || typeof text !== "string") return <span>{text || ""}</span>;
  try {
    const parts = [];
    const lower = text.toLowerCase();
    const tLower = term.toLowerCase();
    let last = 0;
    let idx = lower.indexOf(tLower);
    let count = 0;
    while (idx !== -1 && count < 50) {
      if (idx > last) parts.push(<span key={"t" + idx}>{text.slice(last, idx)}</span>);
      parts.push(<span key={"h" + idx} style={{ background: "#E8C54740", color: "#E8C547", borderRadius: 2, padding: "0 1px" }}>{text.slice(idx, idx + term.length)}</span>);
      last = idx + term.length;
      idx = lower.indexOf(tLower, last);
      count++;
    }
    if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
    return <span>{parts}</span>;
  } catch (e) { return <span>{text}</span>; }
};

async function callAI(system, userMsg, maxTokens = 1000) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message: userMsg, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
  return res.json();
}

export default function Signal() {
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [activeCompose, setActiveCompose] = useState(null);
  const [connections, setConnections] = useState([]);
  const [mapNodes, setMapNodes] = useState([]);
  const [dragNode, setDragNode] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");

  const captureInputRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) { loadAll(uid); }
    else {
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => {
          if (data?.id) { localStorage.setItem("signal_user_id", data.id); loadAll(data.id); }
          else setIsLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    setMapNodes(ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const radius = 300;
      return {
        id: idea.id, color: getCat(idea.category).color,
        x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius
      };
    }));
  }, [ideas.length]);

  const loadAll = async (uid) => {
    try {
      const [{ data: u }, { data: i }, { data: d }, { data: c }, { data: r }, { data: cd }, { data: cn }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid),
        supabase.from("canon_documents").select("*").eq("user_id", uid),
        supabase.from("replies").select("*").eq("user_id", uid),
        supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
        supabase.from("connections").select("*").eq("user_id", uid)
      ]);
      if (u) setUser(u);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
      if (r) setReplies(r);
      if (cd) setComposeDocs(cd);
      if (cn) setConnections(cn);
    } finally { setIsLoading(false); }
  };

  const runStudio = async (ideasList, userObj) => {
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map(i => i.text).join("\n");
      const result = await callAI(
        "You are a script editor. Provide JSON with provocation, pattern, urgentIdea.",
        `Project: ${userObj?.project_name}\nIDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } finally { setStudioLoading(false); }
  };

  const captureIdea = async () => {
    const text = captureInputRef.current?.value.trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    notify("Capturing signal...", "processing");
    try {
      const analysis = await callAI("Analyze this.", `Idea: "${text}"`);
      const { data: saved } = await supabase.from("ideas").insert([{
        user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || ""
      }]).select().single();
      await loadAll(user.id);
      setActiveIdea(saved);
      navGo("library");
      notify("Captured.", "success");
    } finally { setIsAnalyzing(false); }
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

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const searchAll = (q) => {
    if (q.length < 2) return [];
    return ideas.filter(i => i.text.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  };

  const pending = deliverables.filter(d => !d.is_complete);
  const globalResults = searchAll(globalSearch);

  if (isLoading) return <div style={{ background: C.bg, height: "100vh" }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer" }} onClick={() => setView("dashboard")}>signal</div>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: "white", padding: "10px 12px 10px 32px", borderRadius: 8, outline: "none", fontSize: 13 }} />
            {globalResults.length > 0 && (
              <div style={{ position: "absolute", top: "110%", background: C.surfaceHigh, width: "100%", zIndex: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {globalResults.map(r => <div key={r.id} onClick={() => navGo("library", r)} style={{ padding: 12, cursor: "pointer", borderBottom: `1px solid ${C.borderSubtle}` }}>{r.text.slice(0, 40)}</div>)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
              <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold + "20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "5px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          {view === "library" ? ideas.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px 12px", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", borderRadius: 8, fontSize: 13, cursor: "pointer", marginBottom: 2 }}>{i.text.slice(0, 40)}</div>) : 
           view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: "10px 12px", background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 2 }}>{d.title}</div>) :
           canonDocs.map(d => <div key={d.id} onClick={() => setActiveDoc(d)} style={{ padding: "10px 12px", fontSize: 13, color: d.is_active ? "white" : C.textDisabled }}>{d.title}</div>)}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <div style={{ padding: 60 }}><h1 style={{ fontSize: 24, marginBottom: 32 }}>{user?.project_name} Dashboard</h1></div>}
        {view === "capture" && (
          <div style={{ padding: 60, maxWidth: 640, margin: "0 auto", width: "100%" }}>
            <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40, fontStyle: "italic", color: C.textSecondary }}>{todayInvitation}</div>
            <textarea ref={captureInputRef} placeholder="Enter your signal..." rows={8} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: "white", fontSize: 16, lineHeight: 1.6, resize: "none", outline: "none" }} />
            <button onClick={captureIdea} disabled={isAnalyzing} style={{ width: "100%", marginTop: 20, background: C.gold, color: C.bg, padding: 16, borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>SEND SIGNAL →</button>
          </div>
        )}
        {view === "library" && activeIdea && (
          <div style={{ padding: 60, maxWidth: 800 }}>
            <div style={{ fontSize: 11, color: C.gold, marginBottom: 12, fontWeight: 600 }}>{activeIdea.category.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
            {activeIdea.ai_note && <div style={{ background: C.surface, padding: 24, borderRadius: 12, fontSize: 15, lineHeight: 1.7, color: C.textSecondary, border: `1px solid ${C.borderSubtle}` }}>{activeIdea.ai_note}</div>}
          </div>
        )}
        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => saveCompose(activeCompose.id, { title: e.target.value })} style={{ background: "transparent", border: "none", color: "white", fontSize: 24, fontWeight: 700, marginBottom: 24, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => saveCompose(activeCompose.id, { content: e.target.value })} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: "white", padding: 30, fontSize: 16, lineHeight: 1.8, outline: "none", resize: "none" }} />
          </div>
        )}
        {view === "connections" && (
          <div ref={mapContainerRef} style={{ flex: 1, position: "relative", background: C.bg }}>
            <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
              {connections.map((c, i) => {
                const a = mapNodes.find(n => n.id === c.idea_a), b = mapNodes.find(n => n.id === c.idea_b);
                return a && b && <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} opacity={0.4} />;
              })}
            </svg>
            {mapNodes.map(n => <div key={n.id} style={{ position: "absolute", left: n.x - 12, top: n.y - 12, width: 24, height: 24, background: n.color, borderRadius: "50%", cursor: "grab" }} />)}
          </div>
        )}
      </div>

      {/* STUDIO */}
      <div style={{ width: 290, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>STUDIO</div>
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => runStudio(ideas, user)} style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, padding: 12, borderRadius: 8, cursor: "pointer", color: "white" }}>💡 Insight</button>
            <button onClick={auditLibrary} style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, padding: 12, borderRadius: 8, cursor: "pointer", color: "white" }}>🧹 Audit Library</button>
          </div>
        </div>
        {studio && <div style={{ flex: 1, padding: 20, fontSize: 13, borderTop: `1px solid ${C.border}`, lineHeight: 1.6, color: C.textSecondary }}>{studio.provocation}</div>}
      </div>
    </div>
  );
}