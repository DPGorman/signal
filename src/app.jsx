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
  const [studioTab, setStudioTab] = useState("insight");
  const [auditing, setAuditing] = useState(false);
  const [replies, setReplies] = useState([]);
  const [connections, setConnections] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");

  const studioFired = useRef(false);
  const captureInputRef = useRef(null);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) { loadAll(uid); }
    else {
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => {
          if (data?.id) { localStorage.setItem("signal_user_id", data.id); loadAll(data.id); }
          else setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]);

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
      const { data: cn } = await supabase.from("connections").select("*").eq("user_id", uid);
      if (cn) setConnections(cn);
    } catch (e) { console.warn("Connections:", e); }
  };

  const runStudio = async (ideasList, userObj) => {
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map((i, n) => `#${n + 1} [${i.category}] "${i.text}"`).join("\n");
      const result = await callAI(
        `You are a script editor. Provide JSON with provocation, pattern, urgentIdea, blind_spot, duplicates.`,
        `Project: ${userObj?.project_name}\n\nIDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } catch (e) { console.error("Studio:", e); }
    finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (window.location.hostname === "localhost") {
      notify("Audit only works on the deployed Vercel site.", "error");
      return;
    }
    setAuditing(true);
    notify("Auditing library...", "processing");
    try {
        const validIds = new Set(ideas.map(i => i.id));
        const allIdeas = ideas.map(i => `ID:${i.id} [${i.category}] "${i.text}"`).join("\n");
        const result = await callAI(
          `Identify ideas to DELETE. Return JSON with toDelete (ids) and reasons.`,
          `LIBRARY:\n${allIdeas}`
        );
        const toDelete = (result.toDelete || []).filter(id => validIds.has(id));
        if (toDelete.length > 0) {
            for (const id of toDelete) {
                await supabase.from("ideas").delete().eq("id", id);
            }
            await loadAll(user.id);
            notify(`Deleted ${toDelete.length} items.`, "success");
        } else { notify("Library is clean.", "info"); }
    } catch (e) { notify("Audit failed.", "error"); }
    finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    notify("Capturing signal...", "processing");
    try {
        const analysis = await callAI(
            `Analyze this idea. Return JSON with category, aiNote, signalStrength.`,
            `New idea: "${text}"`
        );
        const { data: saved } = await supabase.from("ideas").insert([{
            user_id: user.id, text, category: analysis.category || "premise", ai_note: analysis.aiNote || "", signal_strength: analysis.signalStrength || 3
        }]).select().single();
        await loadAll(user.id);
        setActiveIdea(saved);
        setView("library");
        notify("Signal captured.", "success");
    } catch (e) { notify("Capture failed.", "error"); }
    finally { setIsAnalyzing(false); }
  };

  const navGo = (v, idea = null) => {
    setView(v);
    if (idea) setActiveIdea(idea);
  };

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const pending = deliverables.filter(d => !d.is_complete);
  const activeCanon = canonDocs.filter(d => d.is_active);

  const DashboardView = () => (
    <div style={{ flex: 1, padding: "40px 60px", overflowY: "auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>{user?.project_name || "Signal"}</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Roboto Mono', monospace" }}>{new Date().toLocaleDateString()}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { label: "Ideas", value: ideas.length, color: C.gold },
          { label: "Tasks", value: pending.length, color: C.red },
          { label: "Source Docs", value: canonDocs.length, color: C.purple },
          { label: "High Signal", value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, padding: "20px", borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 32, fontWeight: 300, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, letterSpacing: "0.05em" }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, zIndex: 1000, fontSize: 12 }}>
          {notification.msg}
        </div>
      )}

      {/* LEFT COLUMN: Sidebar & Search */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontStyle: "italic", marginBottom: 20, cursor: "pointer" }} onClick={() => navGo("dashboard")}>signal</div>
          
          {/* SEARCH BOX: Fixed at top of sidebar */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input 
              placeholder="Search project..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "8px 12px 8px 32px", borderRadius: 6, fontSize: 12, outline: "none" }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>⌕</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["dashboard", "capture", "library", "canon", "deliverables"].map(v => (
              <button key={v} onClick={() => navGo(v)} style={{ background: view === v ? C.gold + "20" : "transparent", border: `1px solid ${view === v ? C.gold : C.border}`, color: view === v ? C.gold : C.textMuted, padding: "4px 10px", borderRadius: 4, fontSize: 10, fontFamily: "'Roboto Mono', monospace", cursor: "pointer" }}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          {view === "library" ? (
             <div>
               <div style={{ fontSize: 10, color: C.textMuted, padding: "10px", fontFamily: "'Roboto Mono', monospace" }}>IDEAS</div>
               {ideas.filter(i => !globalSearch || i.text.toLowerCase().includes(globalSearch.toLowerCase())).map(i => (
                 <div key={i.id} onClick={() => setActiveIdea(i)} style={{ padding: "10px", borderRadius: 6, cursor: "pointer", background: activeIdea?.id === i.id ? C.surfaceHigh : "transparent", marginBottom: 2 }}>
                   <div style={{ fontSize: 13, color: activeIdea?.id === i.id ? C.textPrimary : C.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.text}</div>
                 </div>
               ))}
             </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, padding: "10px", fontFamily: "'Roboto Mono', monospace" }}>SOURCES</div>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }} style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, color: doc.is_active ? C.textPrimary : C.textMuted, display: "flex", gap: 8 }}>
                  <span>{doc.is_active ? "✓" : "○"}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER COLUMN: Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "dashboard" && <DashboardView />}
        {view === "capture" && (
          <div style={{ padding: "60px 100px" }}>
            <div style={{ fontSize: 10, color: C.gold, fontFamily: "'Roboto Mono', monospace", marginBottom: 12 }}>CAPTURE SIGNAL</div>
            <textarea ref={captureInputRef} placeholder="What's the idea?" rows={8} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px", color: C.textPrimary, fontSize: 16, outline: "none", lineHeight: 1.6 }} />
            <button onClick={captureIdea} disabled={isAnalyzing} style={{ marginTop: 20, width: "100%", background: C.gold, color: C.bg, border: "none", padding: "14px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>{isAnalyzing ? "ANALYZING..." : "SEND SIGNAL →"}</button>
          </div>
        )}
        {view === "library" && (
          <div style={{ flex: 1, padding: "40px 60px", overflowY: "auto" }}>
            {activeIdea ? (
              <div style={{ maxWidth: 700 }}>
                <div style={{ fontSize: 11, color: getCat(activeIdea.category).color, fontWeight: 600, marginBottom: 8 }}>{activeIdea.category.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.6, marginBottom: 24 }}>{activeIdea.text}</div>
                <div style={{ fontSize: 10, color: C.gold, fontFamily: "'Roboto Mono', monospace", marginBottom: 8 }}>AI ANALYSIS</div>
                <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, background: C.surface, padding: "20px", borderRadius: 12 }}>{activeIdea.ai_note}</div>
              </div>
            ) : <div style={{ color: C.textMuted }}>Select an idea from the list</div>}
          </div>
        )}
        {view === "canon" && (
          <div style={{ flex: 1, padding: "40px 60px", overflowY: "auto" }}>
             {activeDoc ? (
               <div style={{ maxWidth: 700 }}>
                 <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{activeDoc.title}</div>
                 <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{activeDoc.content}</div>
               </div>
             ) : <div style={{ color: C.textMuted }}>Select a document</div>}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Studio Tools */}
      <div style={{ width: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px" }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Roboto Mono', monospace", marginBottom: 16 }}>STUDIO</div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { label: "Insight", icon: "💡", action: () => runStudio(ideas, user) },
              { label: "Audit Library", icon: "🧹", action: auditLibrary },
            ].map(tool => (
              <button key={tool.label} onClick={tool.action} style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, padding: "12px 14px", borderRadius: 8, cursor: "pointer", color: C.textPrimary }}>
                <span style={{ fontSize: 16, marginRight: 12 }}>{tool.icon}</span>
                <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 500 }}>{tool.label}</span>
                <span style={{ color: C.textDisabled, fontSize: 10 }}>→</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, padding: "20px", overflowY: "auto", borderTop: `1px solid ${C.borderSubtle}` }}>
          {studioLoading ? <div style={{ fontSize: 12, color: C.textMuted }}>Thinking...</div> : 
            studio && (
              <div>
                <div style={{ fontSize: 10, color: C.gold, fontFamily: "'Roboto Mono', monospace", marginBottom: 8 }}>PROVOCATION</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: C.textSecondary, borderLeft: `2px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>
              </div>
            )
          }
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
      `}} />
    </div>
  );
}

function SectionHead({ label, onClick }) {
  return (
    <div onClick={onClick} style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Roboto Mono', monospace", letterSpacing: "0.15em", cursor: onClick ? "pointer" : "default" }}>
      {label} {onClick && "→"}
    </div>
  );
}