import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
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

/**
 * Global Highlight Component for Search
 */
const Highlight = ({ text, term }) => {
  if (!term || term.length < 2 || !text) return <span>{text || ""}</span>;
  try {
    const parts = [];
    const lower = text.toLowerCase();
    const tLower = term.toLowerCase();
    let last = 0;
    let idx = lower.indexOf(tLower);
    while (idx !== -1) {
      if (idx > last) parts.push(text.slice(last, idx));
      parts.push(<span key={idx} style={{ background: "#E8C54740", color: "#E8C547", borderRadius: 2 }}>{text.slice(idx, idx + term.length)}</span>);
      last = idx + term.length;
      idx = lower.indexOf(tLower, last);
    }
    if (last < text.length) parts.push(text.slice(last));
    return <span>{parts}</span>;
  } catch (e) { return <span>{text}</span>; }
};

/**
 * AI Proxy
 */
async function callAI(system, userMsg, maxTokens = 1000) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message: userMsg, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  return res.json();
}

/**
 * MAIN APP ENGINE
 */
export default function Signal() {
  // --- Persistent State ---
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [connections, setConnections] = useState([]);

  // --- UI Routing ---
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeCompose, setActiveCompose] = useState(null);
  const [mapNodes, setMapNodes] = useState([]);

  // --- Process State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notification, setNotification] = useState(null);
  const [dragNode, setDragNode] = useState(null);

  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);

  // --- Data Fetching Engine ---
  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) { loadAll(uid); }
    else {
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => {
          if (data?.id) {
            localStorage.setItem("signal_user_id", data.id);
            loadAll(data.id);
          } else { setIsLoading(false); }
        });
    }
  }, []);

  const loadAll = async (uid) => {
    try {
      const [u, i, d, c, r, cd, cn] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*").eq("user_id", uid),
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
    } catch (e) {
      console.error("Load failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Mind Map Circle Logic ---
  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    const nodes = ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const cat = getCat(idea.category);
      const connCount = connections.filter(c => c.idea_a === idea.id || c.idea_b === idea.id).length;
      const radius = Math.max(120, 340 - connCount * 15);
      return {
        id: idea.id, color: cat.color,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        text: idea.text.slice(0, 40)
      };
    });
    setMapNodes(nodes);
  }, [ideas.length, connections.length]);

  // --- Handlers ---
  const captureIdea = async () => {
    const text = captureInputRef.current?.value.trim();
    const ctx = contextInputRef.current?.value.trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    notify("Analyzing signal...", "processing");
    try {
      const analysis = await callAI("Senior Dramaturg. Return JSON: {category, aiNote, signalStrength}", text);
      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || "", inspiration_question: ctx, signal_strength: analysis.signalStrength || 3
      }]).select().single();
      if (error) throw error;
      await loadAll(user.id);
      setActiveIdea(saved); navGo("library");
      notify("Signal captured.", "success");
    } catch (e) { notify("Error", "error"); }
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

  // --- Search Logic ---
  const searchResults = globalSearch.length < 2 ? [] : ideas.filter(i => i.text.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 8);
  const filteredIdeas = globalSearch.length < 2 ? ideas : ideas.filter(i => i.text.toLowerCase().includes(globalSearch.toLowerCase()));

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {notification && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, padding: "10px 24px", borderRadius: 8, border: `1px solid ${C.border}`, zIndex: 1000 }}>{notification.msg}</div>}

      {/* LEFT COLUMN: CONTEXTUAL SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, fontStyle: "italic", cursor: "pointer", letterSpacing: "-0.02em" }} onClick={() => navGo("dashboard")}>signal</div>
            <div style={{ position: "relative", marginBottom: 20 }}>
                <input placeholder="Search Everything..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} 
                  style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px 10px 32px", color: "white", outline: "none", fontSize: 13 }} />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
                    <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{v.toUpperCase()}</button>
                ))}
            </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 20px" }}>
            <div style={{ fontSize: 10, color: C.textMuted, padding: "10px", fontWeight: 600, letterSpacing: "0.1em" }}>{view.toUpperCase()} LIST</div>
            {view === "library" ? filteredIdeas.map(i => (
                <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px 12px", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 2, borderLeft: `2px solid ${activeIdea?.id === i.id ? getCat(i.category).color : "transparent"}` }}>{i.text.slice(0, 45)}...</div>
            )) : view === "compose" ? composeDocs.map(d => (
                <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: "10px 12px", background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 2 }}>{d.title}</div>
            )) : canonDocs.map(d => (
                <div key={d.id} onClick={() => { setActiveDoc(d); setView("canon"); }} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 8, color: d.is_active ? "white" : C.textMuted }}>
                  <span>{d.is_active ? "✓" : "○"}</span><span style={{ fontSize: 13 }}>{d.title}</span>
                </div>
            ))}
        </div>
      </div>

      {/* CENTER COLUMN: MAIN WORKSPACE */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && (
          <div style={{ padding: 60 }}>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 40 }}>{user?.project_name} Dashboard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Ideas", val: ideas.length, color: C.gold },
                  { label: "Tasks", val: deliverables.filter(d => !d.is_complete).length, color: C.red },
                  { label: "Canon Docs", val: canonDocs.length, color: C.purple },
                  { label: "Drafts", val: composeDocs.length, color: C.green }
                ].map(s => (
                  <div key={s.label} style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 36, fontWeight: 300, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === "capture" && (
          <div style={{ padding: "60px 40px", maxWidth: 660, margin: "0 auto", width: "100%" }}>
            <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40 }}><div style={{ fontSize: 18, fontStyle: "italic", color: C.textSecondary, lineHeight: 1.6 }}>{todayInvitation}</div></div>
            <textarea ref={captureInputRef} placeholder="Enter creative signal..." rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6, resize: "none" }} />
            <div style={{ marginTop: 20 }}>
                <input ref={contextInputRef} placeholder="Context/Why this matters now? (Optional)" style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", color: "white", marginBottom: 12, outline: "none" }} />
                <button onClick={captureIdea} disabled={isAnalyzing} style={{ width: "100%", padding: 18, background: C.gold, borderRadius: 12, fontWeight: 700, color: C.bg }}>SEND SIGNAL →</button>
            </div>
          </div>
        )}

        {view === "library" && activeIdea && (
          <div style={{ padding: 60, maxWidth: 800, overflowY: "auto" }}>
             <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 600, marginBottom: 10 }}>{activeIdea.category.toUpperCase()}</div>
             <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
             <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.borderSubtle}` }}>
                <div style={{ fontSize: 10, color: C.gold, fontWeight: 600, marginBottom: 12 }}>AI ANALYSIS</div>
                <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7 }}>{activeIdea.ai_note}</div>
             </div>
          </div>
        )}

        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => {
                const val = e.target.value; setActiveCompose(p => ({...p, title: val})); saveCompose(activeCompose.id, { title: val });
            }} style={{ background: "transparent", border: "none", color: "white", fontSize: 28, fontWeight: 700, marginBottom: 24, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => {
                const val = e.target.value; setActiveCompose(p => ({...p, content: val})); saveCompose(activeCompose.id, { content: val });
            }} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, color: "white", padding: 30, fontSize: 16, lineHeight: 1.9, outline: "none", resize: "none" }} />
          </div>
        )}

        {view === "connections" && (
           <div ref={mapContainerRef} onMouseUp={() => setDragNode(null)} onMouseMove={(e) => {
             if (!dragNode) return;
             const rect = mapContainerRef.current.getBoundingClientRect();
             setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x: e.clientX - rect.left, y: e.clientY - rect.top } : n));
           }} style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg }}>
             <svg style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none" }}>
               {connections.map((c, i) => {
                 const a = mapNodes.find(n => n.id === c.idea_a); const b = mapNodes.find(n => n.id === c.idea_b);
                 if (a && b) return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.border} strokeWidth={1} opacity={0.4} />;
                 return null;
               })}
             </svg>
             {mapNodes.map(n => <div key={n.id} onMouseDown={() => setDragNode(n.id)} onClick={() => { setActiveIdea(ideas.find(i => i.id === n.id)); navGo("library"); }} style={{ position: "absolute", left: n.x-12, top: n.y-12, width: 24, height: 24, borderRadius: "50%", background: n.color, cursor: "grab", border: activeIdea?.id === n.id ? "3px solid white" : "none", boxShadow: "0 4px 15px rgba(0,0,0,0.4)" }} />)}
           </div>
        )}

        {view === "canon" && activeDoc && (
          <div style={{ flex: 1, padding: 60, overflowY: "auto" }}>
             <div style={{ maxWidth: 740 }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>{activeDoc.title}</h1>
                <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{activeDoc.content}</div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: STUDIO TOOLS */}
      <div style={{ width: 300, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: "0.15em", marginBottom: 20 }}>STUDIO</div>
            <div style={{ display: "grid", gap: 10 }}>
                <button onClick={() => runStudio(ideas, user)} style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: "white", cursor: "pointer", transition: "0.2s" }}>
                    <span style={{ fontSize: 18, marginRight: 12 }}>💡</span>
                    <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 500 }}>Synthesis</span>
                </button>
            </div>
        </div>
        {studio && (
          <div style={{ flex: 1, padding: 24, borderTop: `1px solid ${C.borderSubtle}`, overflowY: "auto" }}>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 600, marginBottom: 12, letterSpacing: "0.1em" }}>PROVOCATION</div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, borderLeft: `2px solid ${C.gold}`, paddingLeft: 14 }}>{studio.provocation}</div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Roboto+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
        input, textarea { font-family: inherit; }
      `}} />
    </div>
  );
}