import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Config & Database ---
const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  bg: "#1C1B1F", surface: "#2B2930", surfaceHigh: "#36333D", border: "#48454E",
  borderSubtle: "#3A3740", textPrimary: "#E6E1E5", textSecondary: "#CAC4D0",
  textMuted: "#938F99", gold: "#E8C547", green: "#6DD58C", red: "#FF8A80",
  blue: "#7ABCF6", purple: "#CF9FFF",
};

const CATEGORIES = [
  { id: "premise", label: "Premise", icon: "⬥", color: "#E8C547" },
  { id: "character", label: "Character", icon: "⬥", color: "#FFB27A" },
  { id: "scene", label: "Scene", icon: "⬥", color: "#7ABCF6" },
  { id: "dialogue", label: "Dialogue", icon: "⬥", color: "#CF9FFF" },
  { id: "arc", label: "Story Arc", icon: "⬥", color: "#6DD58C" },
  { id: "production", label: "Production", icon: "⬥", color: "#FF8A80" },
  { id: "research", label: "Research", icon: "⬥", color: "#A8D8A8" },
  { id: "business", label: "Business", icon: "⬥", color: "#FF8FB1" },
];

const DAILY_INVITATIONS = [
  "What are you afraid to write? That's probably the most important scene.",
  "Which character are you avoiding? Go there.",
  "What does your protagonist want that they can't admit?",
  "Name one thing that happens in this story that only this story could contain.",
  "What's the scene you keep circling without writing?",
];

const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

// --- Components ---
const Highlight = ({ text, term }) => {
  if (!term || term.length < 2 || !text) return <span>{text || ""}</span>;
  const parts = text.split(new RegExp(`(${term})`, 'gi'));
  return <span>{parts.map((p, i) => p.toLowerCase() === term.toLowerCase() ? <span key={i} style={{ background: "#E8C54740", color: "#E8C547" }}>{p}</span> : p)}</span>;
};

async function callAI(system, message, maxTokens = 1000) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message, maxTokens }),
  });
  return res.json();
}

export default function Signal() {
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [view, setView] = useState("dashboard");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeCompose, setActiveCompose] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notification, setNotification] = useState(null);
  const [mapNodes, setMapNodes] = useState([]);
  const [dragNode, setDragNode] = useState(null);

  const captureInputRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);
  const studioFired = useRef(false);

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
    setIsAnalyzing(true); notify("Analyzing...", "processing");
    try {
      const res = await callAI("Analyze signal. Return JSON.", text);
      const { data: saved } = await supabase.from("ideas").insert([{ user_id: user.id, text, category: res.category || "premise", ai_note: res.aiNote || "", signal_strength: res.signalStrength || 3 }]).select().single();
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

  const runStudio = async () => {
    setStudioLoading(true);
    try {
      const res = await callAI("Senior dramaturg analysis.", ideas.map(i => i.text).join("\n"));
      setStudio(res);
    } finally { setStudioLoading(false); }
  };

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library") setActiveIdea(item || ideas[0]);
    if (v === "canon") setActiveDoc(item || canonDocs[0]);
    if (v === "compose") setActiveCompose(item || composeDocs[0]);
  };

  const notify = (msg, type = "info") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const currentFiltered = ideas.filter(i => !globalSearch || i.text.toLowerCase().includes(globalSearch.toLowerCase()));
  const pending = deliverables.filter(d => !d.is_complete);

  if (isLoading) return <div style={{ background: C.bg, height: "100vh" }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif" }}>
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 2, fontStyle: "italic" }}>signal</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 20 }}>{user?.project_name?.toUpperCase()}</div>
          <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px 10px 32px", color: "white", outline: "none", marginBottom: 20 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
              <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold + "20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "5px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          <div style={{ fontSize: 10, color: C.textMuted, padding: "10px" }}>{view === "library" ? "IDEAS" : view === "compose" ? "DOCUMENTS" : "SOURCES"}</div>
          {view === "library" ? currentFiltered.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: 10, background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8, fontSize: 13, marginBottom: 2 }}>{i.text.slice(0, 40)}...</div>) :
           view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: 10, background: activeCompose?.id === d.id ? C.surfaceHigh : "transparent", cursor: "pointer", borderRadius: 8 }}>{d.title}</div>) :
           canonDocs.map(d => <div key={d.id} onClick={() => { setActiveDoc(d); setView("canon"); }} style={{ padding: 10, fontSize: 13, color: d.is_active ? "white" : C.textDisabled, cursor: "pointer" }}><span>{d.is_active ? "✓" : "○"}</span> {d.title}</div>)}
        </div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {view === "dashboard" && (
          <div style={{ padding: 60 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40 }}>{user?.project_name} Dashboard</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
              {[
                { label: "Ideas", val: ideas.length, c: C.gold },
                { label: "Tasks", val: pending.length, c: C.red },
                { label: "Sources", val: canonDocs.length, c: C.purple },
                { label: "Drafts", val: composeDocs.length, c: C.green }
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 32, fontWeight: 300, color: s.c }}>{s.val}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted }}>RECENT SIGNALS</div>
              {ideas.slice(0, 5).map(i => <div key={i.id} style={{ padding: 20, borderBottom: `1px solid ${C.borderSubtle}`, fontSize: 14 }}>{i.text}</div>)}
            </div>
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
            <input value={activeCompose.title} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, title: val})); saveCompose(activeCompose.id, { title: val }); }} style={{ background: "transparent", border: "none", color: "white", fontSize: 24, fontWeight: 700, marginBottom: 20, outline: "none" }} />
            <textarea value={activeCompose.content} onChange={e => { const val = e.target.value; setActiveCompose(p => ({...p, content: val})); saveCompose(activeCompose.id, { content: val }); }} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: "white", padding: 30, fontSize: 16, lineHeight: 1.8, outline: "none", resize: "none" }} />
          </div>
        )}
      </div>

      {/* RIGHT STUDIO */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 24 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 20 }}>STUDIO</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["Insight", "Map", "Audit", "Patterns", "Compose", "Stats"].map(t => (
              <button key={t} onClick={t === "Insight" ? runStudio : () => {}} style={{ background: C.bg, border: `1px solid ${C.border}`, padding: 12, borderRadius: 8, color: "white", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>{t.toUpperCase()}</button>
            ))}
          </div>
          {studio && <div style={{ marginTop: 30, fontSize: 13, lineHeight: 1.6, borderLeft: `2px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Roboto+Mono&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
        input, textarea { font-family: inherit; }
      `}} />
    </div>
  );
}