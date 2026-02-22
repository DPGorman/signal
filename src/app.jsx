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
      const radius = Math.max(120, 320 - connCount * 10);
      return {
        id: idea.id, category: idea.category,
        x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
        color: cat.color, text: idea.text.slice(0, 40)
      };
    });
    setMapNodes(nodes);
  }, [ideas, connections]);

  const loadAll = async (uid) => {
    try {
      const [{ data: u }, { data: i }, { data: d }, { data: c }, { data: r }, { data: cd }, { data: cn }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("replies").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
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
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map(i => `[${i.category}] ${i.text}`).join("\n");
      const result = await callAI(
        `You are a senior creative collaborator. Respond ONLY in raw JSON:
{
  "provocation": "sharpest unresolved question this work raises",
  "pattern": "underlying creative focus",
  "urgentIdea": "single idea to develop now",
  "blind_spot": "what work isn't grappling with",
  "duplicates": null
}`,
        `Project: ${userObj?.project_name}\nIDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (window.location.hostname === "localhost") return notify("Vercel Required", "error");
    setAuditing(true); notify("Scanning library...");
    try {
        const result = await callAI("Identify ideas to DELETE. Return JSON { toDelete: [ids] }", ideas.map(i => `${i.id}: ${i.text}`).join("\n"));
        if (result.toDelete?.length) {
            for (const id of result.toDelete) { await supabase.from("ideas").delete().eq("id", id); }
            await loadAll(user.id); notify(`Deleted ${result.toDelete.length} entries.`);
        } else notify("Library clean.");
    } finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true); notify("Processing signal...");
    try {
      const res = await callAI("Analyze and categorize idea. JSON: { category, aiNote }", text);
      const { data: saved } = await supabase.from("ideas").insert([{ 
        user_id: user.id, text, category: res.category || "premise", ai_note: res.aiNote || ""
      }]).select().single();
      await loadAll(user.id);
      setActiveIdea(saved); navGo("library");
      notify("Signal Captured.", "success");
      generateConnections(saved.id, text, user.id);
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

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library") setActiveIdea(item || ideas[0]);
    if (v === "canon") setActiveDoc(item || canonDocs[0]);
    if (v === "compose") setActiveCompose(item || composeDocs[0]);
  };

  const notify = (msg, type = "info") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const pending = deliverables.filter(d => !d.is_complete);

  const MindMapView = () => {
    const handleMouseMove = (e) => {
      if (!dragNode) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: e.clientX - rect.left, y: e.clientY - rect.top } : n));
    };
    return (
      <div ref={mapContainerRef} onMouseMove={handleMouseMove} onMouseUp={() => setDragNode(null)} style={{ flex: 1, position: "relative", background: C.bg }}>
        <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
          {connections.map((c, i) => {
            const a = mapNodes.find(n => n.id === c.idea_a); const b = mapNodes.find(n => n.id === c.idea_b);
            if (a && b) return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} opacity={0.4} />;
            return null;
          })}
        </svg>
        {mapNodes.map(n => (
          <div key={n.id} onMouseDown={() => setDragNode(n.id)} onClick={() => setActiveIdea(ideas.find(i => i.id === n.id))}
            style={{ position: "absolute", left: n.x - 12, top: n.y - 12, width: 24, height: 24, borderRadius: "50%", background: n.color, cursor: "grab", border: activeIdea?.id === n.id ? "3px solid white" : "none" }} />
        ))}
      </div>
    );
  };

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif" }}>
      {notification && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, padding: "12px 24px", borderRadius: 8, border: `1px solid ${C.border}`, zIndex: 1000 }}>{notification.msg}</div>}

      {/* LEFT COLUMN */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
            <input placeholder="Search Everything..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} 
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px 10px 32px", color: "white", outline: "none", marginBottom: 16 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
                    <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view===v?C.gold:C.border}`, color: view===v?C.gold:C.textMuted, padding: "5px 12px", fontSize: 10, borderRadius: 6, fontWeight: 600 }}>{v.toUpperCase()}</button>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {view === "library" ? ideas.filter(i => !globalSearch || i.text.toLowerCase().includes(globalSearch.toLowerCase())).map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: 10, background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8, fontSize: 13 }}>{i.text.slice(0, 45)}...</div>) : 
             view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: 10, background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8 }}>{d.title}</div>) :
             canonDocs.map(d => <div key={d.id} onClick={() => { setActiveDoc(d); setView("canon"); }} style={{ padding: 10, fontSize: 13, color: d.is_active ? "white" : C.textMuted, cursor: "pointer" }}>{d.title}</div>)}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "dashboard" && (
            <div style={{ padding: 60 }}>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{user?.project_name} Dashboard</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 40 }}>
                   <div style={{ background: C.surface, padding: 24, borderRadius: 12 }}>
                        <div style={{ fontSize: 32, color: C.gold }}>{ideas.length}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>IDEAS</div>
                   </div>
                   <div style={{ background: C.surface, padding: 24, borderRadius: 12 }}>
                        <div style={{ fontSize: 32, color: C.red }}>{pending.length}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>INVITATIONS</div>
                   </div>
                </div>
            </div>
          )}
          {view === "capture" && (
              <div style={{ padding: 60, maxWidth: 700, margin: "0 auto", width: "100%" }}>
                <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40, fontStyle: "italic", fontSize: 18 }}>{todayInvitation}</div>
                <textarea ref={captureInputRef} placeholder="Record the creative signal..." rows={8} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, color: "white", fontSize: 16, outline: "none", lineHeight: 1.6 }} />
                <button onClick={captureIdea} style={{ width: "100%", marginTop: 20, padding: 16, background: C.gold, color: C.bg, fontWeight: 700, borderRadius: 12 }}>SEND SIGNAL</button>
              </div>
          )}
          {view === "library" && activeIdea && (
              <div style={{ padding: 60, maxWidth: 800 }}>
                  <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 600, marginBottom: 10 }}>{activeIdea.category.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
                  {activeIdea.ai_note && <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.borderSubtle}`, lineHeight: 1.75 }}>{activeIdea.ai_note}</div>}
              </div>
          )}
          {view === "compose" && activeCompose && (
              <div style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column" }}>
                <input value={activeCompose.title} onChange={e => saveCompose(activeCompose.id, { title: e.target.value })} style={{ background: "transparent", border: "none", color: "white", fontSize: 24, fontWeight: 700, marginBottom: 24 }} />
                <textarea value={activeCompose.content} onChange={e => saveCompose(activeCompose.id, { content: e.target.value })} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 30, color: "white", fontSize: 16, lineHeight: 1.8 }} />
              </div>
          )}
          {view === "connections" && <MindMapView />}
          {view === "canon" && activeDoc && <div style={{ padding: 60 }}><h2 style={{ marginBottom: 20 }}>{activeDoc.title}</h2><div style={{ whiteSpace: "pre-wrap", color: C.textSecondary, lineHeight: 1.8 }}>{activeDoc.content}</div></div>}
      </div>

      {/* RIGHT */}
      <div style={{ width: 290, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 20, letterSpacing: "0.1em" }}>STUDIO TOOLS</div>
            <div style={{ display: "grid", gap: 10 }}>
                <button onClick={() => runStudio(ideas, user)} style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}`, color: "white", cursor: "pointer", borderRadius: 10 }}>💡 Studio Insight</button>
                <button onClick={auditLibrary} style={{ background: C.bg, padding: 12, border: `1px solid ${C.border}`, color: "white", cursor: "pointer", borderRadius: 10 }}>🧹 Audit Library</button>
            </div>
          </div>
          {studio && (
              <div style={{ flex: 1, padding: 20, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>
              </div>
          )}
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