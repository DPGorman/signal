import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exact NotebookLM dark palette
const C = {
  bg:            "#1C1B1F",
  surface:       "#2B2930",
  surfaceHigh:   "#36333D",
  border:        "#48454E",
  borderSubtle:  "#3A3740",
  textPrimary:   "#E6E1E5",
  textSecondary: "#CAC4D0",
  textMuted:     "#938F99",
  textDisabled:  "#49454F",
  gold:          "#E8C547",
  green:         "#6DD58C",
  red:           "#FF8A80",
  blue:          "#7ABCFF",
  purple:        "#CF9FFF",
};

const CATEGORIES = [
  { id: "premise",    label: "Premise",    icon: "◈", color: "#E8C547" },
  { id: "character",  label: "Character",  icon: "◉", color: "#FFB27A" },
  { id: "scene",      label: "Scene",      icon: "◫", color: "#7ABCFF" },
  { id: "dialogue",   label: "Dialogue",   icon: "◌", color: "#CF9FFF" },
  { id: "arc",        label: "Story Arc",  icon: "◎", color: "#6DD58C" },
  { id: "production", label: "Production", icon: "◧", color: "#FF8A80" },
  { id: "research",   label: "Research",   icon: "◐", color: "#A8D8A8" },
  { id: "business",   label: "Business",   icon: "◑", color: "#FF8FB1" },
];

const DOC_TYPES = [
  { id: "series_bible",    label: "Series Bible" },
  { id: "character_bible", label: "Character Bible" },
  { id: "premise",         label: "Premise Statement" },
  { id: "tone_guide",      label: "Tone Guide" },
  { id: "research",        label: "Research" },
  { id: "reference",       label: "Reference" },
];

// Daily invitations — rotate so the app feels alive
const INVITATIONS = [
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
const dayInvitation = INVITATIONS[new Date().getDay() % INVITATIONS.length];

export default function SignalDashboard() {
  const [user,         setUser]         = useState(null);
  const [ideas,        setIdeas]        = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs,    setCanonDocs]    = useState([]);
  const [activeView,   setActiveView]   = useState("dashboard");
  const [activeIdea,   setActiveIdea]   = useState(null);
  const [activeDoc,    setActiveDoc]    = useState(null);
  const [input,        setInput]        = useState("");
  const [context,      setContext]      = useState("");  // "what made this feel important"
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [notification, setNotification] = useState(null);
  const [filterCat,    setFilterCat]    = useState(null);
  const [showUpload,   setShowUpload]   = useState(false);
  const [canonUpload,  setCanonUpload]  = useState({ title: "", type: "reference", content: "" });
  const [isUploading,  setIsUploading]  = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) loadAll(uid);
    else setIsLoading(false);
  }, []);

  const loadAll = async (uid) => {
    try {
      const [{ data: u }, { data: i }, { data: d }, { data: c }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).eq("is_archived", false).order("created_at", { ascending: false }),
        supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);
      if (u) setUser(u);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const analyzeWithAI = async (text, ctx) => {
    setIsAnalyzing(true);
    try {
      const activeDocs = canonDocs.filter(d => d.is_active);
      const canonContext = activeDocs.slice(0, 3).map(d => `[${d.title}]: ${d.content.slice(0, 600)}`).join("\n\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `You are a world-class script editor and dramaturg working on a specific creative project. Your job is not to categorize — it is to INTERROGATE. Every idea operates on multiple levels simultaneously: immediate plot, character revelation, thematic resonance, premise encapsulation. See all of them.

${canonContext ? `CANON — push every idea against this:\n${canonContext}\n\n` : ""}${ctx ? `CONTEXT FROM CREATOR — why this felt important in the moment:\n"${ctx}"\n\n` : ""}

Rules:
- aiNote must be specific to THIS idea and THIS project, not generic dramaturgical advice
- dimensions are the levels this idea operates on simultaneously (2-4, specific not generic)
- invitations are phrased as creative pulls not tasks — "explore X" not "write X"  
- canonResonance must name a SPECIFIC tension with or echo of the canon documents
- signalStrength: 1=noise, 2=interesting, 3=strong, 4=urgent, 5=essential

Respond ONLY with raw JSON, no markdown:
{
  "category": "premise|character|scene|dialogue|arc|production|research|business",
  "dimensions": ["specific level 1", "specific level 2"],
  "aiNote": "1-2 sentences of specific dramaturgical insight",
  "invitations": ["invitation 1", "invitation 2", "invitation 3"],
  "signalStrength": 3,
  "canonResonance": "specific connection to or tension with the canon"
}`,
          messages: [{ role: "user", content: `Project: ${user?.project_name || "Film Series"}\n\nIdea: "${text}"` }],
        }),
      });
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error(e);
      return {
        category: "premise", dimensions: ["story mechanics", "thematic weight"],
        aiNote: "This idea has layers worth excavating — come back to it.",
        invitations: ["Expand this in 3 sentences", "Connect it to your protagonist's central wound"],
        signalStrength: 3, canonResonance: ""
      };
    } finally { setIsAnalyzing(false); }
  };

  const captureIdea = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    const ctx  = context.trim();
    setInput("");
    setContext("");
    notify("Analyzing...", "processing");
    const analysis = await analyzeWithAI(text, ctx);
    const { data: saved, error } = await supabase.from("ideas").insert([{
      user_id: user.id, text, source: "app",
      category:            analysis.category || "premise",
      ai_note:             analysis.aiNote || "",
      inspiration_question: ctx || null,
      signal_strength:     analysis.signalStrength || 3,
      canon_resonance:     analysis.canonResonance || "",
    }]).select().single();
    if (error) { notify("Failed to save.", "error"); return; }
    if (analysis.dimensions?.length)
      await supabase.from("dimensions").insert(analysis.dimensions.map(l => ({ idea_id: saved.id, label: l })));
    if (analysis.invitations?.length)
      await supabase.from("deliverables").insert(analysis.invitations.map(t => ({ idea_id: saved.id, user_id: user.id, text: t })));
    await loadAll(user.id);
    setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(l => ({ label: l })) });
    setActiveView("library");
    notify("Signal captured.", "success");
  };

  const uploadCanon = async () => {
    if (!canonUpload.title || !canonUpload.content || !user) return;
    setIsUploading(true);
    try {
      const { data, error } = await supabase.from("canon_documents").insert([{
        user_id: user.id, title: canonUpload.title,
        doc_type: canonUpload.type, content: canonUpload.content, is_active: true,
      }]).select().single();
      if (error) throw error;
      setCanonDocs(prev => [data, ...prev]);
      setCanonUpload({ title: "", type: "reference", content: "" });
      setShowUpload(false);
      notify("Document added to Canon.", "success");
    } catch { notify("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCanonUpload(p => ({ ...p, content: ev.target.result, title: p.title || file.name.replace(/\.[^/.]+$/, "") }));
    reader.readAsText(file);
  };

  const toggleDeliverable = async (id, current) => {
    await supabase.from("deliverables").update({ is_complete: !current, completed_at: !current ? new Date().toISOString() : null }).eq("id", id);
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, is_complete: !current } : d));
  };

  const toggleCanon = async (id, current) => {
    await supabase.from("canon_documents").update({ is_active: !current }).eq("id", id);
    setCanonDocs(prev => prev.map(d => d.id === id ? { ...d, is_active: !current } : d));
  };

  const deleteCanon = async (id) => {
    await supabase.from("canon_documents").delete().eq("id", id);
    setCanonDocs(prev => prev.filter(d => d.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);
    notify("Document removed.", "info");
  };

  const filtered    = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
  const pending     = deliverables.filter(d => !d.is_complete);
  const activeCanon = canonDocs.filter(d => d.is_active);

  // ─────────────────────────────────────────────────────────────────────────
  // Shared style primitives
  // ─────────────────────────────────────────────────────────────────────────
  const mono  = "'Courier New', 'Courier', monospace";
  const serif = "Georgia, 'Times New Roman', serif";

  const inputBase = {
    width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
    color: C.textPrimary, padding: "11px 14px", fontFamily: serif,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle = {
    fontSize: 10, color: C.textMuted, fontFamily: mono,
    letterSpacing: "0.15em", marginBottom: 7, display: "block",
  };

  const navGo = (view) => { setActiveView(view); setActiveIdea(null); setActiveDoc(null); };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading / no-user guards
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: serif, fontSize: 22, fontStyle: "italic" }}>Signal</div>
    </div>
  );
  if (!user) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textSecondary, fontFamily: serif, fontSize: 15 }}>Complete onboarding first.</div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  const DashboardView = () => (
    <div style={{ padding: "44px 52px", maxWidth: 960, overflowY: "auto", flex: 1 }}>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 30, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em", marginBottom: 6 }}>
          {user.project_name}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, fontFamily: mono }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* 4 stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 44 }}>
        {[
          { label: "Ideas Captured",  value: ideas.length,   color: C.gold,   sub: `${ideas.filter(i => Date.now() - new Date(i.created_at).getTime() < 7*86400000).length} this week` },
          { label: "Open Invitations",value: pending.length, color: C.red,    sub: `${deliverables.filter(d => d.is_complete).length} completed` },
          { label: "High Signal",     value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, sub: "ideas worth pursuing now" },
          { label: "Canon Active",    value: activeCanon.length, color: C.purple, sub: "documents conditioning AI" },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "22px 20px" }}>
            <div style={{ fontSize: 42, color: s.color, fontStyle: "italic", lineHeight: 1, marginBottom: 10 }}>{s.value}</div>
            <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36 }}>

        {/* Recent ideas */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={labelStyle}>RECENT CAPTURES</span>
            <span onClick={() => navGo("library")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {ideas.length === 0
              ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>No ideas yet.</div>
              : ideas.slice(0, 7).map((idea, idx) => {
                const cat = getCat(idea.category);
                const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
                return (
                  <div key={idea.id} onClick={() => { setActiveIdea(idea); navGo("library"); }}
                    style={{ padding: "14px 18px", borderBottom: idx < 6 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 12, color: cat.color, marginTop: 2, flexShrink: 0 }}>{cat.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.55, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{idea.text}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 4 }}>
                        {cat.label} · {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                        {idea.signal_strength >= 4 && <span style={{ color: C.gold, marginLeft: 8 }}>◈ high signal</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Open invitations */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={labelStyle}>OPEN INVITATIONS</span>
            <span onClick={() => navGo("deliverables")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {pending.length === 0
              ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>All caught up.</div>
              : pending.slice(0, 7).map((task, idx, arr) => {
                const cat = getCat(task.idea?.category);
                return (
                  <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)}
                    style={{ padding: "14px 18px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 17, height: 17, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.55 }}>{task.text}</div>
                      <div style={{ fontSize: 11, color: cat.color, fontFamily: mono, marginTop: 4 }}>{cat.icon} {cat.label}</div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>

      {/* Signal distribution bar */}
      {ideas.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <span style={labelStyle}>SIGNAL DISTRIBUTION</span>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return <div key={cat.id} title={`${cat.label}: ${count}`} style={{ flex: count, background: cat.color, opacity: 0.85 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                <span style={{ fontSize: 12, color: C.textMuted }}>{cat.label} <span style={{ color: cat.color }}>{ideas.filter(i => i.category === cat.id).length}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canon layer summary */}
      {canonDocs.length > 0 && (
        <div style={{ paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={labelStyle}>CANON LAYER</span>
            <span onClick={() => navGo("canon")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>MANAGE →</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canonDocs.map(doc => (
              <div key={doc.id} style={{ background: C.surface, border: `1px solid ${doc.is_active ? C.green + "60" : C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: doc.is_active ? C.green : C.textDisabled, fontSize: 13 }}>◈</span>
                <div>
                  <div style={{ fontSize: 13, color: doc.is_active ? C.textPrimary : C.textDisabled, marginBottom: 2 }}>{doc.title}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>{doc.content?.length?.toLocaleString()} chars · {doc.is_active ? "active" : "inactive"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const CaptureView = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: "52px 56px" }}>
      <div style={{ maxWidth: 680 }}>

        {/* Invitation */}
        <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 22, marginBottom: 52 }}>
          <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
          <div style={{ fontSize: 20, lineHeight: 1.85, color: C.textMuted, fontStyle: "italic" }}>{dayInvitation}</div>
        </div>

        {/* Main capture */}
        <label style={labelStyle}>WHAT'S IN YOUR HEAD RIGHT NOW</label>
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
          placeholder="Don't edit. Don't qualify. Just send the signal." rows={5}
          style={{ ...inputBase, fontSize: 16, lineHeight: 1.85, resize: "vertical", marginBottom: 16 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        {/* Context question — always visible, optional */}
        <label style={labelStyle}>WHY DOES THIS FEEL IMPORTANT RIGHT NOW? <span style={{ color: C.textDisabled }}>(optional — but helps the AI)</span></label>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. it reframes Moses's entire moral logic..."
          style={{ ...inputBase, fontSize: 14, marginBottom: 20 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER to capture</span>
          <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()}
            style={{ background: isAnalyzing || !input.trim() ? C.surfaceHigh : C.gold, color: isAnalyzing || !input.trim() ? C.textMuted : C.bg, border: "none", padding: "13px 32px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing || !input.trim() ? "default" : "pointer", transition: "all 0.2s" }}>
            {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 64, display: "flex", gap: 56, paddingTop: 36, borderTop: `1px solid ${C.border}` }}>
          {[{ l: "IDEAS CAPTURED", v: ideas.length }, { l: "OPEN INVITATIONS", v: pending.length }, { l: "CANON DOCS", v: activeCanon.length }].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 46, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const LibraryView = () => (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Idea list */}
      <div style={{ width: 340, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
        {/* Filter bar */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button onClick={() => setFilterCat(null)}
            style={{ background: !filterCat ? C.gold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.gold : C.border}`, padding: "3px 10px", fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
            ALL
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)} title={cat.label}
              style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "3px 9px", fontSize: 12, cursor: "pointer" }}>
              {cat.icon}
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ padding: 40, color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>Nothing here yet.</div>}
        {filtered.map(idea => {
          const cat = getCat(idea.category);
          const isActive = activeIdea?.id === idea.id;
          const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
          return (
            <div key={idea.id} onClick={() => setActiveIdea(idea)}
              style={{ padding: "16px 18px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}</span>
              </div>
              <div style={{ fontSize: 14, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
              {idea.signal_strength >= 4 && <div style={{ marginTop: 6, fontSize: 10, color: C.gold, fontFamily: mono }}>◈ HIGH SIGNAL</div>}
            </div>
          );
        })}
      </div>

      {/* Idea detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        {activeIdea ? (() => {
          const cat = getCat(activeIdea.category);
          const ideaDeliverables = deliverables.filter(d => d.idea_id === activeIdea.id);
          return (
            <div style={{ maxWidth: 620 }}>
              {/* Meta */}
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
                <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>
                  {new Date(activeIdea.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>via {activeIdea.source || "app"}</span>
                {activeIdea.signal_strength >= 4 && <span style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>◈ HIGH SIGNAL</span>}
              </div>

              {/* The idea itself — large and readable */}
              <div style={{ fontSize: 20, lineHeight: 1.9, color: C.textPrimary, marginBottom: 36 }}>
                {activeIdea.text}
              </div>

              {/* Why it felt important — the context metadata */}
              {activeIdea.inspiration_question && (
                <div style={{ marginBottom: 32 }}>
                  <div style={labelStyle}>WHY IT FELT IMPORTANT</div>
                  <div style={{ fontSize: 15, color: C.textSecondary, fontStyle: "italic", lineHeight: 1.8, borderLeft: `2px solid ${C.border}`, paddingLeft: 16 }}>
                    "{activeIdea.inspiration_question}"
                  </div>
                </div>
              )}

              {/* AI analysis */}
              {activeIdea.ai_note && (
                <div style={{ marginBottom: 32 }}>
                  <div style={labelStyle}>DRAMATURGICAL ANALYSIS</div>
                  <div style={{ background: C.surface, borderLeft: `3px solid ${cat.color}`, padding: "18px 22px", fontSize: 16, color: C.textSecondary, lineHeight: 1.9 }}>
                    {activeIdea.ai_note}
                  </div>
                </div>
              )}

              {/* Canon resonance */}
              {activeIdea.canon_resonance && (
                <div style={{ marginBottom: 32 }}>
                  <div style={labelStyle}>CANON RESONANCE</div>
                  <div style={{ background: C.surface, borderLeft: `3px solid ${C.green}`, padding: "18px 22px", fontSize: 15, color: C.textSecondary, lineHeight: 1.9 }}>
                    {activeIdea.canon_resonance}
                  </div>
                </div>
              )}

              {/* Dimensions */}
              {activeIdea.dimensions?.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={labelStyle}>OPERATING ON</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {activeIdea.dimensions.map((d, i) => (
                      <span key={i} style={{ background: C.surface, border: `1px solid ${cat.color}50`, color: cat.color, padding: "6px 14px", fontSize: 12, fontFamily: mono }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Invitations */}
              {ideaDeliverables.length > 0 && (
                <div>
                  <div style={labelStyle}>INVITATIONS TO ACTION</div>
                  {ideaDeliverables.map(d => (
                    <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                      style={{ display: "flex", gap: 16, padding: "15px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", alignItems: "flex-start" }}>
                      <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${d.is_complete ? cat.color : C.border}`, background: d.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.bg, marginTop: 2, transition: "all 0.2s" }}>
                        {d.is_complete ? "✓" : ""}
                      </div>
                      <span style={{ fontSize: 16, color: d.is_complete ? C.textDisabled : C.textSecondary, textDecoration: d.is_complete ? "line-through" : "none", lineHeight: 1.75 }}>
                        {d.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })() : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDisabled, fontStyle: "italic", fontSize: 17 }}>
            Select an idea to read it
          </div>
        )}
      </div>
    </div>
  );

  const CanonView = () => (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Left — doc list + upload form */}
      <div style={{ width: 320, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>

        {showUpload && (
          <div style={{ padding: 22, borderBottom: `1px solid ${C.border}`, background: C.surfaceHigh }}>
            <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 18 }}>NEW CANON DOCUMENT</div>
            <label style={labelStyle}>TITLE</label>
            <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))} placeholder="e.g. CRISPR Series Bible"
              style={{ ...inputBase, marginBottom: 14 }}
              onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
            <label style={labelStyle}>TYPE</label>
            <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
              style={{ ...inputBase, fontFamily: mono, fontSize: 12, marginBottom: 14 }}>
              {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>CONTENT</label>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, padding: "3px 10px", fontFamily: mono, fontSize: 9, cursor: "pointer" }}>
                UPLOAD FILE
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: "none" }} />
            </div>
            {canonUpload.content && <div style={{ fontSize: 11, color: C.green, fontFamily: mono, marginBottom: 6 }}>✓ {canonUpload.content.length.toLocaleString()} chars</div>}
            <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
              placeholder="Paste content or upload file..." rows={5}
              style={{ ...inputBase, fontSize: 13, lineHeight: 1.6, resize: "vertical", marginBottom: 14 }}
              onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
            <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content}
              style={{ width: "100%", background: isUploading || !canonUpload.title || !canonUpload.content ? C.surface : C.gold, color: isUploading || !canonUpload.title || !canonUpload.content ? C.textMuted : C.bg, border: "none", padding: "12px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
              {isUploading ? "SAVING..." : "SAVE TO CANON →"}
            </button>
          </div>
        )}

        {canonDocs.length === 0 && !showUpload && (
          <div style={{ padding: "36px 24px", color: C.textDisabled, fontStyle: "italic", fontSize: 14, lineHeight: 1.8 }}>
            No documents yet.<br />Add your series bible, character docs, premise statements.
          </div>
        )}

        {canonDocs.map(doc => (
          <div key={doc.id} onClick={() => setActiveDoc(activeDoc?.id === doc.id ? null : doc)}
            style={{ padding: "16px 18px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: activeDoc?.id === doc.id ? `3px solid ${C.green}` : "3px solid transparent", background: activeDoc?.id === doc.id ? C.surfaceHigh : "transparent", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: activeDoc?.id === doc.id ? C.textPrimary : C.textSecondary, marginBottom: 5, lineHeight: 1.4 }}>{doc.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>
                  {DOC_TYPES.find(t => t.id === doc.doc_type)?.label} · {doc.content?.length?.toLocaleString()} chars
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); toggleCanon(doc.id, doc.is_active); }}
                  style={{ background: "transparent", color: doc.is_active ? C.green : C.textMuted, border: `1px solid ${doc.is_active ? C.green : C.border}`, padding: "3px 9px", fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", cursor: "pointer" }}>
                  {doc.is_active ? "ACTIVE" : "OFF"}
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${doc.title}"?`)) deleteCanon(doc.id); }}
                  style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}40`, padding: "3px 9px", fontFamily: mono, fontSize: 9, cursor: "pointer" }}>
                  DELETE
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right — full reader */}
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        {activeDoc ? (
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 24, color: C.textPrimary, marginBottom: 10, lineHeight: 1.3 }}>{activeDoc.title}</div>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>{DOC_TYPES.find(t => t.id === activeDoc.doc_type)?.label}</span>
                <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>{activeDoc.content?.length?.toLocaleString()} characters</span>
                <span style={{ fontSize: 12, color: activeDoc.is_active ? C.green : C.textDisabled, fontFamily: mono }}>
                  {activeDoc.is_active ? "◈ Active in Canon" : "○ Inactive"}
                </span>
              </div>
            </div>
            <div style={{ height: 1, background: C.border, marginBottom: 32 }} />
            <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.95, whiteSpace: "pre-wrap", fontFamily: serif }}>
              {activeDoc.content}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDisabled, fontStyle: "italic", fontSize: 17 }}>
            Select a document to read it
          </div>
        )}
      </div>
    </div>
  );

  const DeliverablesView = () => {
    const completed = deliverables.filter(d => d.is_complete);
    const pct = deliverables.length ? Math.round((completed.length / deliverables.length) * 100) : 0;
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        <div style={{ maxWidth: 720 }}>
          {/* Summary */}
          <div style={{ display: "flex", gap: 52, marginBottom: 36 }}>
            {[{ l: "OPEN", v: pending.length }, { l: "COMPLETED", v: completed.length }, { l: "TOTAL", v: deliverables.length }].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 46, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 48 }}>
            <div style={{ height: "100%", background: C.green, width: `${pct}%`, borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>

          {/* By category */}
          {CATEGORIES.map(cat => {
            const catTasks = deliverables.filter(d => d.idea?.category === cat.id);
            if (!catTasks.length) return null;
            const openCount = catTasks.filter(t => !t.is_complete).length;
            return (
              <div key={cat.id} style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 11, color: cat.color, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 16 }}>
                  {cat.icon} {cat.label.toUpperCase()} — {openCount} open
                </div>
                {catTasks.map(task => (
                  <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)}
                    style={{ display: "flex", gap: 18, padding: "15px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", alignItems: "flex-start" }}>
                    <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${task.is_complete ? cat.color : C.border}`, background: task.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.bg, marginTop: 3, transition: "all 0.2s" }}>
                      {task.is_complete ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, color: task.is_complete ? C.textDisabled : C.textSecondary, textDecoration: task.is_complete ? "line-through" : "none", lineHeight: 1.75, marginBottom: 4 }}>
                        {task.text}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
                        from: {task.idea?.text?.slice(0, 70)}{task.idea?.text?.length > 70 ? "..." : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SHELL
  // ─────────────────────────────────────────────────────────────────────────
  const centerLabel = {
    dashboard: "OVERVIEW",
    capture: "CAPTURE",
    library: `LIBRARY — ${filtered.length} IDEAS`,
    canon: "CANON MANAGER",
    deliverables: `DELIVERABLES — ${pending.length} OPEN`,
  }[activeView];

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", overflow: "hidden", fontFamily: serif, color: C.textPrimary }}>

      {/* Toast */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: notification.type === "success" ? C.green : notification.type === "processing" ? C.gold : notification.type === "error" ? C.red : C.surface, color: notification.type === "info" ? C.textPrimary : C.bg, padding: "10px 24px", fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", borderRadius: 2 }}>
          {notification.msg}
        </div>
      )}

      {/* ── LEFT COLUMN ── */}
      <div style={{ width: 252, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 26, color: C.textPrimary, letterSpacing: "-0.04em", fontStyle: "italic", marginBottom: 3 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>{user.project_name?.toUpperCase()}</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          {[
            { id: "dashboard",    label: "Dashboard" },
            { id: "capture",      label: "Capture" },
            { id: "library",      label: "Library",      badge: ideas.length || "" },
            { id: "canon",        label: "Canon",        badge: activeCanon.length || "" },
            { id: "deliverables", label: "Deliverables", badge: pending.length || "" },
          ].map(item => (
            <div key={item.id} onClick={() => navGo(item.id)}
              style={{ padding: "12px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: activeView === item.id ? C.surfaceHigh : "transparent", borderLeft: activeView === item.id ? `3px solid ${C.gold}` : "3px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 15, color: activeView === item.id ? C.textPrimary : C.textSecondary }}>{item.label}</span>
              {item.badge ? <span style={{ fontSize: 12, color: C.gold, fontFamily: mono }}>{item.badge}</span> : null}
            </div>
          ))}
        </nav>

        {/* Recent ideas */}
        <div style={{ padding: "14px 20px 6px", fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>RECENT</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {ideas.slice(0, 14).map(idea => {
            const cat = getCat(idea.category);
            const isActive = activeIdea?.id === idea.id;
            return (
              <div key={idea.id} onClick={() => { setActiveIdea(idea); navGo("library"); }}
                style={{ padding: "10px 20px", cursor: "pointer", background: isActive ? C.surfaceHigh : "transparent", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent" }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = "#2E2C34")}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, marginBottom: 3 }}>{cat.icon} {cat.label}</div>
                <div style={{ fontSize: 13, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
              </div>
            );
          })}
        </div>

        {/* Canon status */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>CANON ACTIVE</div>
          {activeCanon.length === 0
            ? <div style={{ fontSize: 12, color: C.textDisabled, fontStyle: "italic" }}>No documents yet</div>
            : activeCanon.slice(0, 3).map(d => (
              <div key={d.id} style={{ fontSize: 12, color: C.green, marginBottom: 4, display: "flex", gap: 6 }}>
                <span>◈</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── CENTER COLUMN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ padding: "14px 36px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, flexShrink: 0, minHeight: 50 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>{centerLabel}</span>
          {activeView === "canon" && (
            <button onClick={() => setShowUpload(!showUpload)}
              style={{ background: showUpload ? "transparent" : C.gold, color: showUpload ? C.textMuted : C.bg, border: showUpload ? `1px solid ${C.border}` : "none", padding: "7px 18px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
              {showUpload ? "CANCEL" : "+ ADD DOCUMENT"}
            </button>
          )}
        </div>

        {/* View router */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeView === "dashboard"    && <DashboardView />}
          {activeView === "capture"      && <CaptureView />}
          {activeView === "library"      && <LibraryView />}
          {activeView === "canon"        && <CanonView />}
          {activeView === "deliverables" && <DeliverablesView />}
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div style={{ width: 252, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>SIGNAL STATUS</div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* Stats */}
          <div style={{ marginBottom: 30 }}>
            {[
              { label: "Total Ideas",  value: ideas.length,   color: C.gold   },
              { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at).getTime() < 7*86400000).length, color: C.blue   },
              { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green  },
              { label: "Via WhatsApp", value: ideas.filter(i => i.source === "whatsapp").length, color: C.purple },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.borderSubtle}` }}>
                <span style={{ fontSize: 14, color: C.textSecondary }}>{s.label}</span>
                <span style={{ fontSize: 24, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Category bars */}
          {ideas.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 14 }}>BY CATEGORY</div>
              {CATEGORIES.map(cat => {
                const count = ideas.filter(i => i.category === cat.id).length;
                if (!count) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.textSecondary }}>{cat.label}</span>
                      <span style={{ fontSize: 13, color: cat.color, fontFamily: mono }}>{count}</span>
                    </div>
                    <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                      <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, borderRadius: 2, opacity: 0.75 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Canon status */}
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>CANON LAYER</div>
            {activeCanon.length === 0
              ? <div style={{ fontSize: 13, color: C.textDisabled, lineHeight: 1.75, fontStyle: "italic" }}>No documents active. AI analyzing without Canon context.</div>
              : <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.75 }}>{activeCanon.length} document{activeCanon.length !== 1 ? "s" : ""} conditioning all analysis.</div>
            }
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        textarea::placeholder, input::placeholder { color: ${C.textDisabled}; }
        select option { background: ${C.surface}; color: ${C.textPrimary}; }
      `}</style>
    </div>
  );
}
