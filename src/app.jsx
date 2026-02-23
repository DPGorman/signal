import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Configuration & Design Tokens ---
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
 * AI Proxy Helper
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
 * MASTER COMPONENT: SIGNAL
 */
export default function Signal() {
  // --- Core State ---
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [mapNodes, setMapNodes] = useState([]);

  // --- View State ---
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeCompose, setActiveCompose] = useState(null);
  const [studioTab, setStudioTab] = useState("insight");
  
  // --- Process State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notification, setNotification] = useState(null);
  const [dragNode, setDragNode] = useState(null);

  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);
  const studioFired = useRef(false);

  // --- Initial Load ---
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

  // --- Studio Auto-Fire ---
  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio();
    }
  }, [ideas.length, user]);

  // --- Data Loader Engine ---
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
    } catch (e) { console.error("Loader Error:", e); }
    finally { setIsLoading(false); }
  };

  // --- Action Functions (Guaranteed Defined) ---
  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    const ctx = (contextInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    notify("Processing Signal...", "processing");
    try {
      const analysis = await callAI("Senior Dramaturg. Return JSON: {category, aiNote, signalStrength}", text);
      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || "", inspiration_question: ctx, signal_strength: analysis.signalStrength || 3
      }]).select().single();
      if (error) throw error;
      await loadAll(user.id);
      setActiveIdea(saved); setView("library");
      notify("Signal Captured.", "success");
    } catch (e) { notify("Error during capture.", "error"); }
    finally { setIsAnalyzing(false); }
  };

  const saveCompose = async (id, updates) => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(async () => {
      await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }, 1000);
  };

  const runStudio = async () => {
    if (!ideas.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const prompt = ideas.map(i => `[${i.category}] ${i.text}`).join("\n");
      const result = await callAI("Identify provocations and patterns. JSON.", prompt);
      setStudio(result);
    } finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (window.location.hostname === "localhost") return notify("Vercel Required", "error");
    setIsAuditing(true); notify("Auditing vault...");
    try {
      const res = await callAI("Find test/duplicate IDs. JSON: {toDelete:[]}", ideas.map(i => `${i.id}: ${i.text}`).join("\n"));
      if (res.toDelete?.length) {
        for (const id of res.toDelete) { await supabase.from("ideas").delete().eq("id", id); }
        await loadAll(user.id); notify(`Cleaned ${res.toDelete.length} entries.`);
      } else notify("Library is high signal.");
    } finally { setIsAuditing(false); }
  };

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library") setActiveIdea(item || ideas[0]);
    if (v === "canon") setActiveDoc(item || canonDocs[0]);
    if (v === "compose") setActiveCompose(item || composeDocs[0]);
  };

  const notify = (msg, type = "info") => {
    setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000);
  };

  // --- Helpers ---
  const pending = deliverables.filter(d => !d.is_complete);
  const highSignal = ideas.filter(i => i.signal_strength >= 4);
  const filteredIdeas = globalSearch.length < 2 ? ideas : ideas.filter(i => i.text.toLowerCase().includes(globalSearch.toLowerCase()));
  const mono = "'Roboto Mono', monospace";

  // --- Sub-Components ---
  const DashboardView = () => (
    <div style={{ flex: 1, padding: "40px 60px", overflowY: "auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 32, fontWeight: 700, fontStyle: "italic" }}>{user?.project_name}</div>
        <div style={{ fontSize: 14, color: C.textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { label: "Ideas", val: ideas.length, sub: "vault total", color: C.gold, dest: "library" },
          { label: "Invitations", val: pending.length, sub: "actions open", color: C.red, dest: "deliverables" },
          { label: "High Signal", val: highSignal.length, sub: "worth pursuing", color: C.green, dest: "library" },
          { label: "Canon Docs", val: canonDocs.length, sub: "source files", color: C.purple, dest: "canon" },
        ].map(s => (
          <div key={s.label} onClick={() => navGo(s.dest)} style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
            <div style={{ fontSize: 36, fontWeight: 300, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, letterSpacing: "0.05em", marginTop: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.1em" }}>RECENT SIGNALS</span>
          <span onClick={() => navGo("library")} style={{ fontSize: 11, color: C.gold, cursor: "pointer" }}>VIEW ALL →</span>
        </div>
        {ideas.slice(0, 6).map(i => (
          <div key={i.id} onClick={() => navGo("library", i)} style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", fontSize: 14 }} onMouseEnter={e => e.currentTarget.style.background = C.bg} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
             <span style={{ color: getCat(i.category).color, marginRight: 12 }}>⬥</span> {i.text.slice(0, 110)}...
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", marginBottom: 20, cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} 
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px 10px 32px", color: "white", outline: "none", fontSize: 13 }} />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
              <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "6px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 24px" }}>
            <div style={{ fontSize: 10, color: C.textMuted, padding: "10px", fontFamily: mono, letterSpacing: "0.1em" }}>CONTEXTUAL LIST</div>
            {view === "library" ? filteredIdeas.map(i => (
                <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px 12px", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", borderLeft: `2px solid ${activeIdea?.id === i.id ? getCat(i.category).color : "transparent"}`, cursor: "pointer", borderRadius: 8, fontSize: 13, marginBottom: 2 }}>{i.text.slice(0, 45)}...</div>
            )) : view === "compose" ? composeDocs.map(d => (
                <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: "10px 12px", background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8, fontSize: 13, marginBottom: 2 }}>{d.title}</div>
            )) : canonDocs.map(doc => (
                <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }} style={{ padding: "10px 12px", cursor: "pointer", fontSize: 13, color: doc.is_active ? "white" : C.textMuted, display: "flex", gap: 10 }}>
                  <span style={{ color: doc.is_active ? C.green : C.textDisabled }}>{doc.is_active ? "✓" : "○"}</span> {doc.title}
                </div>
            ))}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <DashboardView />}
        {view === "capture" && (
          <div style={{ flex: 1, padding: "60px 40px", display: "flex", justifyContent: "center" }}>
            <div style={{ maxWidth: 640, width: "100%" }}>
              <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 40 }}><div style={{ fontSize: 18, fontStyle: "italic", color: C.textSecondary, lineHeight: 1.6 }}>{todayInvitation}</div></div>
              <textarea ref={captureInputRef} placeholder="Enter signal..." rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6, resize: "none" }} />
              <button onClick={captureIdea} disabled={isAnalyzing} style={{ width: "100%", marginTop: 20, padding: 18, background: C.gold, borderRadius: 12, fontWeight: 700, color: C.bg }}>SEND SIGNAL →</button>
            </div>
          </div>
        )}
        {view === "library" && activeIdea && (
          <div style={{ padding: "60px", maxWidth: 800, overflowY: "auto" }}>
             <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 700, marginBottom: 12 }}>{activeIdea.category.toUpperCase()}</div>
             <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
             {activeIdea.ai_note && <div style={{ background: C.surface, padding: 30, borderRadius: 12, border: `1px solid ${C.borderSubtle}`, lineHeight: 1.7, color: C.textSecondary }}>{activeIdea.ai_note}</div>}
          </div>
        )}
        {view === "compose" && activeCompose && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 40 }}>
            <input value={activeCompose.title} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, title: val})); saveCompose(activeCompose.id, { title: val }); }} style={{ background: "transparent", border: "none", color: "white", fontSize: 28, fontWeight: 700, marginBottom: 24, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, content: val})); saveCompose(activeCompose.id, { content: val }); }} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: "white", padding: 30, fontSize: 16, lineHeight: 1.8, outline: "none", resize: "none" }} />
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ width: 290, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 20, letterSpacing: "0.15em" }}>STUDIO TOOLS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { l: "Insight", i: "💡", a: runStudio },
                  { l: "Audit", i: "🧹", a: auditLibrary },
                  { l: "Connections", i: "🕸", a: () => setView("connections") },
                  { l: "Patterns", i: "⌬", a: () => setStudioTab("patterns") }
                ].map(tool => (
                    <button key={tool.l} onClick={tool.a} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px", color: "white", cursor: "pointer", textAlign: "center" }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{tool.i}</div>
                        <div style={{ fontSize: 9, fontWeight: 700 }}>{tool.l.toUpperCase()}</div>
                    </button>
                ))}
            </div>
        </div>
        {studio && <div style={{ flex: 1, padding: 24, borderTop: `1px solid ${C.border}`, fontSize: 14, lineHeight: 1.7, color: C.textSecondary }}>{studio.provocation}</div>}
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