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
    while (idx !== -1) {
      if (idx > last) parts.push(<span key={"t"+idx}>{text.slice(last, idx)}</span>);
      parts.push(<span key={"h"+idx} style={{ background: "#E8C54740", color: "#E8C547", borderRadius: 2, padding: "0 1px" }}>{text.slice(idx, idx + term.length)}</span>);
      last = idx + term.length;
      idx = lower.indexOf(tLower, last);
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [globalSearch, setGlobalSearch] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditing, setAuditing] = useState(false);

  const studioFired = useRef(false);
  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const composeContentRef = useRef(null);
  const composeTitleRef = useRef(null);
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
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]);

  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    const nodes = ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const cat = getCat(idea.category);
      const nodeConnections = connections.filter(c => c.idea_a === idea.id || c.idea_b === idea.id);
      const radius = Math.max(120, 360 - nodeConnections.length * 20);
      return {
        id: idea.id, category: idea.category,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        color: cat.color, text: idea.text.slice(0, 50),
        signal: idea.signal_strength || 3, connCount: nodeConnections.length
      };
    });
    setMapNodes(nodes);
  }, [ideas.length, connections.length]);

  const loadAll = async (uid) => {
    try {
      const [{ data: u }, { data: i }, { data: d }, { data: c }, { data: r }, { data: cd }, { data: cn }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("replies").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
        supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false }),
        supabase.from("connections").select("*").eq("user_id", uid),
      ]);
      if (u) setUser(u);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
      if (r) setReplies(r);
      if (cd) setComposeDocs(cd);
      if (cn) setConnections(cn);
    } catch (e) { console.error("loadAll:", e); }
    finally { setIsLoading(false); }
  };

  const runStudio = async (ideasList, userObj) => {
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map((i, n) => `#${n + 1} [${i.category}, signal ${i.signal_strength || "?"}] "${i.text}"`).join("\n");
      const result = await callAI(
        `You are a senior dramaturg. Analyze this project. Respond ONLY in raw JSON:\n{\n  "provocation": "one sentence unresolved drama",\n  "pattern": "underlying creative focus",\n  "urgentIdea": "what to write now"\n}`,
        `Project: ${userObj?.project_name}\nIDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (!ideas.length || auditing) return;
    if (window.location.hostname === "localhost") return notify("Vercel required for Audit.", "error");
    setAuditing(true); notify("Scanning library...");
    try {
      const result = await callAI("Find test entries/duplicates.", ideas.map(i => `${i.id}: ${i.text}`).join("\n"));
      if (result.toDelete?.length) {
        for (const id of result.toDelete) { await supabase.from("ideas").delete().eq("id", id); }
        await loadAll(user.id); notify(`Deleted ${result.toDelete.length} entries.`);
      }
    } finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    const ctx = (contextInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true); notify("Analyzing signal...", "processing");
    try {
      const analysis = await callAI("Analyze signal. Return JSON: {category, aiNote, signalStrength}", text);
      const { data: saved } = await supabase.from("ideas").insert([{
        user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || "", inspiration_question: ctx, signal_strength: analysis.signalStrength || 3
      }]).select().single();
      await loadAll(user.id);
      setActiveIdea(saved); navGo("library");
      notify("Captured.", "success");
    } catch(e) { notify("Error", "error"); }
    finally { setIsAnalyzing(false); }
  };

  const saveCompose = async (id, updates) => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(async () => {
      await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }, 1000);
  };

  const addReply = async (ideaId, section, text) => {
    if (!text.trim() || !user) return false;
    const { data } = await supabase.from("replies").insert([{ user_id: user.id, idea_id: ideaId || null, target_section: section, content: text.trim() }]).select().single();
    setReplies(prev => [...prev, data]);
    return true;
  };

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library") setActiveIdea(item || ideas[0]);
    if (v === "canon") setActiveDoc(item || canonDocs[0]);
    if (v === "compose") setActiveCompose(item || composeDocs[0]);
  };

  const notify = (msg, type = "info") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const filterList = () => {
    if (!globalSearch || globalSearch.length < 2) return ideas;
    const q = globalSearch.toLowerCase();
    return ideas.filter(i => i.text.toLowerCase().includes(q) || (i.ai_note && i.ai_note.toLowerCase().includes(q)));
  };

  const currentIdeas = filterList();
  const pending = deliverables.filter(d => !d.is_complete);

  const sans = "'Inter', sans-serif";
  const mono = "'Roboto Mono', monospace";

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: sans, overflow: "hidden" }}>
      {notification && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, padding: "10px 24px", borderRadius: 8, zHash: 1000 }}>{notification.msg}</div>}

      {/* SIDEBAR: SOURCES & NAVIGATION */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input placeholder="Search everywhere..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} 
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, padding: "10px 32px", borderRadius: 8, color: "white", outline: "none", fontSize: 13 }} />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
              <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view===v?C.gold:C.border}`, color: view===v?C.gold:C.textMuted, padding: "5px 10px", borderRadius: 6, fontSize: 10, fontFamily: mono, fontWeight: 600 }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 20px" }}>
            <div style={{ fontSize: 10, color: C.textMuted, padding: "10px", letterSpacing: "0.1em" }}>SOURCES / LIST</div>
            {view === "library" ? currentIdeas.map(i => (
              <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px 12px", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", borderRadius: 8, fontSize: 13, cursor: "pointer", marginBottom: 2, borderLeft: `2px solid ${activeIdea?.id === i.id ? getCat(i.category).color : "transparent"}` }}>{i.text.slice(0, 45)}...</div>
            )) : view === "compose" ? composeDocs.map(d => (
              <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: "10px 12px", background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 2 }}>{d.title}</div>
            )) : canonDocs.map(d => (
              <div key={d.id} onClick={() => { setActiveDoc(d); setView("canon"); }} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 8, color: d.is_active ? "white" : C.textMuted }}>
                <span>{d.is_active ? "✓" : "○"}</span><span style={{ fontSize: 13 }}>{d.title}</span>
              </div>
            ))}
        </div>
      </div>

      {/* CENTER: WORKSPACE */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <div style={{ padding: 60 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{user?.project_name} Dashboard</div></div>}
        {view === "capture" && (
          <div style={{ padding: "60px 40px", maxWidth: 660, margin: "0 auto", width: "100%" }}>
            <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40 }}><div style={{ fontSize: 18, fontStyle: "italic", color: C.textSecondary, lineHeight: 1.6 }}>{todayInvitation}</div></div>
            <textarea ref={captureInputRef} placeholder="What's the creative signal?" rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6, resize: "none" }} />
            <button onClick={captureIdea} disabled={isAnalyzing} style={{ width: "100%", marginTop: 20, background: C.gold, padding: 18, borderRadius: 12, fontWeight: 700 }}>SEND SIGNAL →</button>
          </div>
        )}
        {view === "library" && activeIdea && (
          <div style={{ padding: "60px", maxWidth: 800 }}>
             <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 600, marginBottom: 10 }}>{activeIdea.category.toUpperCase()}</div>
             <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
             <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.borderSubtle}` }}>
                <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginBottom: 12 }}>AI INSIGHT</div>
                <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7 }}>{activeIdea.ai_note}</div>
             </div>
          </div>
        )}
        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => saveCompose(activeCompose.id, { title: e.target.value })} style={{ background: "transparent", border: "none", fontSize: 28, color: "white", fontWeight: 700, marginBottom: 24, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => saveCompose(activeCompose.id, { content: e.target.value })} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, color: "white", padding: 30, fontSize: 16, lineHeight: 1.8, outline: "none", resize: "none" }} />
          </div>
        )}
        {view === "connections" && (
           <div ref={mapContainerRef} onMouseUp={() => setDragNode(null)} onMouseMove={(e) => {
             if (!dragNode) return;
             const rect = mapContainerRef.current.getBoundingClientRect();
             setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: e.clientX - rect.left, y: e.clientY - rect.top } : n));
           }} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
             <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
               {connections.map((c, i) => {
                 const a = mapNodes.find(n => n.id === c.idea_a); const b = mapNodes.find(n => n.id === c.idea_b);
                 return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} opacity={0.4} /> : null;
               })}
             </svg>
             {mapNodes.map(n => <div key={n.id} onMouseDown={() => setDragNode(n.id)} onClick={() => setActiveIdea(ideas.find(i => i.id === n.id))} style={{ position: "absolute", left: n.x-12, top: n.y-12, width: 24, height: 24, borderRadius: "50%", background: n.color, cursor: "grab", border: activeIdea?.id === n.id ? "3px solid white" : "none" }} />)}
           </div>
        )}
        {view === "canon" && activeDoc && (
          <div style={{ flex: 1, padding: 60, overflowY: "auto" }}>
             <div style={{ maxWidth: 740 }}>
                <h1 style={{ marginBottom: 24 }}>{activeDoc.title}</h1>
                <div style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{activeDoc.content}</div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT: STUDIO */}
      <div style={{ width: 300, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 20 }}>STUDIO</div>
            <div style={{ display: "grid", gap: 10 }}>
               <button onClick={() => runStudio(ideas, user)} style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, padding: 12, borderRadius: 10, cursor: "pointer", color: "white" }}>💡 Synthesis</button>
               <button onClick={auditLibrary} style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, padding: 12, borderRadius: 10, cursor: "pointer", color: "white" }}>🧹 Audit Library</button>
            </div>
        </div>
        {studio && <div style={{ flex: 1, padding: 24, borderTop: `1px solid ${C.border}`, lineHeight: 1.7, fontSize: 14 }}>{studio.provocation}</div>}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Roboto+Mono&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
        input, textarea { font-family: inherit; }
      `}} />
    </div>
  );
}