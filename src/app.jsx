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

const DOC_TYPES = [
  { id: "series_bible",    label: "Series Bible" },
  { id: "character_bible", label: "Character Bible" },
  { id: "premise",         label: "Premise Statement" },
  { id: "tone_guide",      label: "Tone Guide" },
  { id: "research",        label: "Research" },
  { id: "reference",       label: "Reference" },
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
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [canonUpload, setCanonUpload] = useState({ title: "", type: "reference", content: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [studio, setStudio] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioTab, setStudioTab] = useState("insight");
  const [auditing, setAuditing] = useState(false);
  const [replies, setReplies] = useState([]);
  const [composeDocs, setComposeDocs] = useState([]);
  const [activeCompose, setActiveCompose] = useState(null);
  const [connections, setConnections] = useState([]);
  const [mapNodes, setMapNodes] = useState([]);
  const [dragNode, setDragNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [focusedNode, setFocusedNode] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [searchHighlight, setSearchHighlight] = useState("");
  const [scrollToId, setScrollToId] = useState(null);

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
    } catch (e) { console.error("loadAll:", e); }
    finally { setIsLoading(false); }
    try {
      const { data: r } = await supabase.from("replies").select("*").eq("user_id", uid).order("created_at", { ascending: true });
      if (r) setReplies(r);
    } catch (e) { console.warn("Replies:", e); }
    try {
      const { data: cd } = await supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
      if (cd) setComposeDocs(cd);
    } catch (e) { console.warn("Compose:", e); }
    try {
      const { data: cn } = await supabase.from("connections").select("*").eq("user_id", uid);
      if (cn) setConnections(cn);
    } catch (e) { console.warn("Connections:", e); }
  };

  const runStudio = async (ideasList, userObj) => {
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map((i, n) => `#${n + 1} [${i.category}, signal ${i.signal_strength || "?"}] "${i.text}"`).join("\n");
      const result = await callAI(
        `You are a senior creative collaborator. Respond ONLY in raw JSON:
{
  "provocation": "one sentence drama provocation",
  "pattern": "hidden story theme",
  "urgentIdea": "what to write now"
}`,
        `Project: ${userObj?.project_name}\nTotal: ${ideasList.length}\n\nIDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } catch (e) { console.error("Studio:", e); }
    finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (!ideas.length || auditing) return;
    setAuditing(true);
    notify("Auditing...");
    try {
        const result = await callAI("Identify test IDs to delete. JSON: {toDelete:[]}", ideas.map(i => `${i.id}: ${i.text}`).join("\n"));
        if (result.toDelete?.length) {
            for (const id of result.toDelete) { await supabase.from("ideas").delete().eq("id", id); }
            await loadAll(user.id);
            notify("Deleted items.");
        }
    } finally { setAuditing(false); }
  };

  const saveCompose = async (id, updates) => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(async () => {
      await supabase.from("compose_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    }, 1000);
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true); notify("Analyzing...");
    try {
      const analysis = await callAI("Analyze signal.", text);
      const { data: saved } = await supabase.from("ideas").insert([{
        user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || ""
      }]).select().single();
      await loadAll(user.id); setActiveIdea(saved); navGo("library");
      notify("Captured.", "success");
    } finally { setIsAnalyzing(false); }
  };

  const navGo = (v, idea = null) => {
    setView(v);
    if (idea) setActiveIdea(idea);
  };

  const notify = (msg, type = "info") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const results = globalSearch.length < 2 ? [] : ideas.filter(i => i.text.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 8);
  const pending = deliverables.filter(d => !d.is_complete);

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: sans, overflow: "hidden" }}>
      {/* Side Pane */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
            <div style={{ position: "relative", marginBottom: 20 }}>
                <input placeholder="Search..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px 8px 30px", outline: "none", color: "white" }} />
                {results.length > 0 && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surfaceHigh, zIndex: 10 }}>{results.map(r => <div key={r.id} onClick={() => navGo("library", r)} style={{ padding: 10 }}>{r.text.slice(0, 30)}</div>)}</div>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["dashboard", "capture", "library", "canon", "compose", "connections"].map(v => (
                    <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold+"20" : "transparent", border: `1px solid ${view===v?C.gold:C.border}`, color: view===v?C.gold:C.textMuted, padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>{v.toUpperCase()}</button>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {view === "library" ? ideas.map(i => <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: 10, background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", cursor: "pointer", fontSize: 13, marginBottom: 2 }}>{i.text.slice(0, 40)}...</div>) :
             view === "compose" ? composeDocs.map(d => <div key={d.id} onClick={() => setActiveCompose(d)} style={{ padding: 10, cursor: "pointer" }}>{d.title}</div>) :
             canonDocs.map(d => <div key={d.id} onClick={() => {setActiveDoc(d); setView("canon");}} style={{ padding: 10, fontSize: 13 }}>{d.title}</div>)}
        </div>
      </div>

      {/* Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <div style={{ padding: 60 }}><h1 style={{ fontSize: 24 }}>{user?.project_name} Dashboard</h1></div>}
        {view === "capture" && (
            <div style={{ padding: 80, maxWidth: 700, margin: "0 auto", width: "100%" }}>
                <div style={{ fontStyle: "italic", marginBottom: 30, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20 }}>{todayInvitation}</div>
                <textarea ref={captureInputRef} rows={10} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, fontSize: 16, color: "white", outline: "none", lineHeight: 1.6 }} />
                <button onClick={captureIdea} style={{ marginTop: 20, background: C.gold, color: C.bg, width: "100%", padding: 14, fontWeight: 700, border: "none", borderRadius: 12 }}>SEND SIGNAL</button>
            </div>
        )}
        {view === "library" && activeIdea && (
            <div style={{ padding: 60, maxWidth: 800 }}>
                <div style={{ fontSize: 11, color: C.gold, marginBottom: 12 }}>{activeIdea.category.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.6, marginBottom: 40 }}>{activeIdea.text}</div>
                {activeIdea.ai_note && <div style={{ padding: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, lineHeight: 1.7, fontSize: 15 }}>{activeIdea.ai_note}</div>}
            </div>
        )}
        {view === "compose" && activeCompose && (
            <div style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column" }}>
                <input value={activeCompose.title} onChange={e => saveCompose(activeCompose.id, { title: e.target.value })} style={{ background: "transparent", border: "none", fontSize: 24, fontWeight: 700, color: "white", outline: "none", marginBottom: 20 }} />
                <textarea value={activeCompose.content} onChange={e => saveCompose(activeCompose.id, { content: e.target.value })} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, padding: 30, borderRadius: 12, fontSize: 16, lineHeight: 1.8, color: "white", outline: "none", resize: "none" }} />
            </div>
        )}
      </div>

      {/* Side Tray */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 20 }}>STUDIO</div>
            <button onClick={() => runStudio(ideas, user)} style={{ display: "block", width: "100%", padding: 10, background: C.bg, border: `1px solid ${C.border}`, color: "white", cursor: "pointer", borderRadius: 8 }}>💡 Insight</button>
          </div>
          {studio && <div style={{ flex: 1, padding: 20, borderTop: `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.6 }}>{studio.provocation}</div>}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Roboto+Mono&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
      `}} />
    </div>
  );
}