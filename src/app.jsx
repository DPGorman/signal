import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Master Supabase Config
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
      const connCount = connections.filter(c => c.idea_a === idea.id || c.idea_b === idea.id).length;
      const radius = Math.max(120, 350 - connCount * 40);
      return {
        id: idea.id, category: idea.category,
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
        text: idea.text.slice(0, 50), fullText: idea.text,
        color: cat.color, icon: cat.icon,
        signal: idea.signal_strength || 3, connCount,
      };
    });
    setMapNodes(nodes);
  }, [ideas.length, connections.length]);

  const loadAll = async (uid) => {
    try {
      const [{ data: u }, { data: i }, { data: d }, { data: c }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);
      if (u) setUser(u);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
      
      const { data: r } = await supabase.from("replies").select("*").eq("user_id", uid).order("created_at", { ascending: true });
      if (r) setReplies(r);
      const { data: cd } = await supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
      if (cd) setComposeDocs(cd);
      const { data: cn } = await supabase.from("connections").select("*").eq("user_id", uid);
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
        `You are a senior creative collaborator — script editor, dramaturg, producer. Respond ONLY in raw JSON:
{
  "provocation": "sharpest unresolved question this work raises",
  "pattern": "what the creator is actually working on beneath the surface",
  "urgentIdea": "single idea most deserving focus",
  "blind_spot": "what work isn't grappling with"
}`,
        `Project: ${userObj?.project_name}\nTotal: ${ideasList.length}\n\nALL IDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } catch (e) { console.error("Studio:", e); }
    finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (!ideas.length || auditing) return;
    if (window.location.hostname === "localhost") return notify("Vercel required", "error");
    setAuditing(true); notify("Auditing library...", "processing");
    try {
      const result = await callAI("Identify test entries. JSON: { toDelete: [] }", ideas.map(i => `${i.id}: ${i.text}`).join("\n"));
      if (result.toDelete?.length) {
        for (const id of result.toDelete) { await supabase.from("ideas").delete().eq("id", id); }
        await loadAll(user.id); notify(`Cleaned ${result.toDelete.length} entries.`);
      } else notify("Library is high signal.");
    } catch (e) { notify("Audit fail"); }
    finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true); notify("Analyzing signal...", "processing");
    try {
      const analysis = await callAI("Analyze and categorize idea. Return JSON.", text);
      const { data: saved } = await supabase.from("ideas").insert([{
        user_id: user.id, text, source: "app", category: analysis.category || "premise", ai_note: analysis.aiNote || "", signal_strength: analysis.signalStrength || 3
      }]).select().single();
      await loadAll(user.id);
      setActiveIdea(saved); navGo("library");
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

  const navGo = (v, idea = null) => {
    setView(v); setGlobalSearch("");
    if (idea) setActiveIdea(idea);
  };

  const notify = (msg, type = "info") => {
    setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000);
  };

  const searchResults = (q) => {
    if (q.length < 2) return [];
    return ideas.filter(i => i.text.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  };

  const currentIdeas = globalSearch.length < 2 ? ideas : ideas.filter(i => i.text.toLowerCase().includes(globalSearch.toLowerCase()));
  const pending = deliverables.filter(d => !d.is_complete);

  const DashboardView = () => (
    <div style={{ flex: 1, padding: "40px 60px", overflowY: "auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary }}>{user?.project_name} Dashboard</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Roboto Mono', monospace" }}>{new Date().toLocaleDateString()}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Ideas", value: ideas.length, color: C.gold, dest: "library" },
          { label: "Tasks", value: pending.length, color: C.red, dest: "deliverables" },
          { label: "High Signal", value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, dest: "library" },
          { label: "Docs", value: canonDocs.length, color: C.purple, dest: "canon" }
        ].map(s => (
          <div key={s.label} onClick={() => navGo(s.dest)} style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
            <div style={{ fontSize: 32, fontWeight: 300, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.1em" }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const MindMapView = () => {
    const handleMouseMove = (e) => {
      if (!dragNode) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: e.clientX - rect.left, y: e.clientY - rect.top } : n));
    };
    return (
      <div ref={mapContainerRef} onMouseMove={handleMouseMove} onMouseUp={() => setDragNode(null)} style={{ flex: 1, position: "relative", background: C.bg, overflow: "hidden" }}>
        <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
          {connections.map((c, i) => {
            const a = mapNodes.find(n => n.id === c.idea_a); const b = mapNodes.find(n => n.id === c.idea_b);
            if (a && b) return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} opacity={0.4} />;
            return null;
          })}
        </svg>
        {mapNodes.map(n => (
          <div key={n.id} onMouseDown={() => setDragNode(n.id)} onClick={() => { setActiveIdea(ideas.find(i => i.id === n.id)); navGo("library"); }}
            style={{ position: "absolute", left: n.x - 12, top: n.y - 12, width: 24, height: 24, borderRadius: "50%", background: n.color, cursor: "grab", border: activeIdea?.id === n.id ? "3px solid white" : "none" }} />
        ))}
      </div>
    );
  };

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
            <div style={{ position: "relative", marginBottom: 20 }}>
                <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px 10px 32px", outline: "none", color: "white" }} />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
                {searchResults(globalSearch).length > 0 && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surfaceHigh, zIndex: 10, borderRadius: 8, border: `1px solid ${C.border}` }}>{searchResults(globalSearch).map(r => <div key={r.id} onClick={() => navGo("library", r)} style={{ padding: 12, cursor: "pointer", borderBottom: `1px solid ${C.borderSubtle}` }}>{r.text.slice(0, 30)}</div>)}</div>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
                    <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{v.toUpperCase()}</button>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {view === "library" ? currentIdeas.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px 12px", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8, fontSize: 13, borderLeft: `2px solid ${activeIdea?.id === i.id ? getCat(i.category).color : "transparent"}` }}>{i.text.slice(0, 40)}...</div>) : 
             view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: 10, background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8 }}>{d.title}</div>) :
             canonDocs.map(d => <div key={d.id} onClick={() => { setActiveDoc(d); navGo("canon"); }} style={{ padding: "8px 10px", fontSize: 13, color: d.is_active ? "white" : C.textMuted, cursor: "pointer" }}>{d.title}</div>)}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <DashboardView />}
        {view === "capture" && (
          <div style={{ padding: 60, maxWidth: 660, margin: "0 auto", width: "100%" }}>
            <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40, fontStyle: "italic", fontSize: 18 }}>{todayInvitation}</div>
            <textarea ref={captureInputRef} placeholder="Record the signal..." rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6 }} />
            <button onClick={captureIdea} disabled={isAnalyzing} style={{ width: "100%", marginTop: 20, padding: 16, background: C.gold, color: C.bg, fontWeight: 700, borderRadius: 12 }}>SEND SIGNAL →</button>
          </div>
        )}
        {view === "library" && activeIdea && (
          <div style={{ padding: 60, maxWidth: 800 }}>
             <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 700, marginBottom: 12 }}>{activeIdea.category.toUpperCase()}</div>
             <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
             {activeIdea.ai_note && <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.borderSubtle}`, lineHeight: 1.75 }}>{activeIdea.ai_note}</div>}
          </div>
        )}
        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => saveCompose(activeCompose.id, { title: e.target.value })} style={{ background: "transparent", border: "none", color: "white", fontSize: 24, fontWeight: 700, marginBottom: 20 }} />
            <textarea value={activeCompose.content} onChange={e => saveCompose(activeCompose.id, { content: e.target.value })} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 30, fontSize: 16, lineHeight: 1.8, color: "white", outline: "none", resize: "none" }} />
          </div>
        )}
        {view === "connections" && <MindMapView />}
        {view === "canon" && activeDoc && <div style={{ padding: 60 }}><h1 style={{ marginBottom: 20 }}>{activeDoc.title}</h1><div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{activeDoc.content}</div></div>}
      </div>

      {/* RIGHT */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 24 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>STUDIO</div>
          <button onClick={() => runStudio(ideas, user)} style={{ width: "100%", padding: 12, background: C.bg, border: `1px solid ${C.border}`, color: "white", borderRadius: 8, cursor: "pointer" }}>💡 Synthesis</button>
          <button onClick={auditLibrary} style={{ width: "100%", padding: 12, background: C.bg, border: `1px solid ${C.border}`, color: "white", borderRadius: 8, cursor: "pointer", marginTop: 10 }}>🧹 Audit Library</button>
          {studio && <div style={{ marginTop: 30, fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>}
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