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
  const [studioTab, setStudioTab] = useState("insight");
  const [globalSearch, setGlobalSearch] = useState("");
  const [notification, setNotification] = useState(null);
  const captureInputRef = useRef(null);
  const composeSaveTimer = useRef(null);

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
    } finally { setIsLoading(false); }
  };

  const runStudio = async () => {
    setStudioLoading(true);
    try {
      const res = await callAI("Dramaturg.", ideas.map(i => i.text).join("\n"));
      setStudio(res);
    } finally { setStudioLoading(false); }
  };

  const navGo = (v, item = null) => {
    setView(v);
    if (v === "library" && item) setActiveIdea(item);
    if (v === "canon" && item) setActiveDoc(item);
    if (v === "compose" && item) setActiveCompose(item);
  };

  const pending = deliverables.filter(d => !d.is_complete);
  const highSignal = ideas.filter(i => i.signal_strength >= 4);

  if (isLoading) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, fontFamily: "'Inter', sans-serif" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", marginBottom: 2 }}>signal</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Roboto Mono'", marginBottom: 18, letterSpacing: "0.1em" }}>{user?.project_name?.toUpperCase()}</div>
          
          <input placeholder="Search Everything..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} 
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", color: "white", outline: "none", fontSize: 12, marginBottom: 20 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 24 }}>
            {["Overview", "Capture", "Library", "Canon", "Actions", "Compose", "Map"].map(l => (
              <button key={l} onClick={() => navGo(l.toLowerCase() === "overview" ? "dashboard" : l.toLowerCase() === "actions" ? "deliverables" : l.toLowerCase() === "map" ? "connections" : l.toLowerCase())}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, padding: "6px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 12 }}>SOURCES • {activeCanonDocs.length} active</div>
          {canonDocs.map(d => (
            <div key={d.id} onClick={() => { setActiveDoc(d); setView("canon"); }} style={{ padding: "6px 0", fontSize: 13, cursor: "pointer", color: d.is_active ? "white" : C.textDisabled }}>
              <span style={{ color: d.is_active ? C.green : C.textDisabled, marginRight: 8 }}>{d.is_active ? "✓" : "○"}</span> {d.title}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {view === "dashboard" && (
          <div style={{ padding: "60px" }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>{user?.project_name}</div>
            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 48 }}>{new Date().toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 48 }}>
              {[
                { label: "Ideas", val: ideas.length, sub: "32 this week", color: C.gold },
                { label: "Invitations", val: pending.length, sub: "2 completed", color: C.red },
                { label: "High Signal", val: highSignal.length, sub: "worth pursuing", color: C.green },
                { label: "Canon", val: canonDocs.length, sub: "active documents", color: C.purple }
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, padding: "24px", borderRadius: 4, border: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ fontSize: 44, fontWeight: 300, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 12 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>RECENT CAPTURES →</span>
                <span style={{ fontSize: 11, color: C.gold, cursor: "pointer" }}>VIEW ALL →</span>
              </div>
              {ideas.slice(0, 6).map(i => (
                <div key={i.id} style={{ padding: "20px", borderBottom: `1px solid ${C.borderSubtle}`, display: "flex", gap: 16 }}>
                  <span style={{ color: getCat(i.category).color }}>⬥</span>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{i.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ width: 300, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 20 }}>STUDIO</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
            {["Insight", "Connections", "Patterns", "Audit", "Compose", "Stats"].map(t => (
              <div key={t} style={{ background: C.bg, border: `1px solid ${C.border}`, padding: "16px 8px", borderRadius: 4, textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.textSecondary }}>{t.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <button onClick={runStudio} style={{ width: "100%", padding: "12px", background: C.gold, border: "none", borderRadius: 4, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>GENERATE INSIGHT →</button>
        </div>
      </div>
    </div>
  );
}