import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exact NotebookLM color palette
const C = {
  bg: "#1C1B1F",
  surface: "#2B2930",
  surfaceHigh: "#35323B",
  border: "#3C3A40",
  borderLight: "#48454E",
  textPrimary: "#E6E1E5",
  textSecondary: "#CAC4D0",
  textMuted: "#938F99",
  textDisabled: "#49454F",
  accent: "#D0BCFF",       // Google's purple accent in dark mode
  accentGold: "#E8C547",   // Signal's gold
  success: "#6DD58C",
  error: "#F2B8B5",
  warning: "#F9DEDC",
};

const CATEGORIES = [
  { id: "premise",    label: "Premise",     icon: "◈", color: "#E8C547" },
  { id: "character",  label: "Character",   icon: "◉", color: "#FFB27A" },
  { id: "scene",      label: "Scene",       icon: "◫", color: "#7ABCFF" },
  { id: "dialogue",   label: "Dialogue",    icon: "◌", color: "#CF9FFF" },
  { id: "arc",        label: "Story Arc",   icon: "◎", color: "#6DD58C" },
  { id: "production", label: "Production",  icon: "◧", color: "#FF8A80" },
  { id: "research",   label: "Research",    icon: "◐", color: "#A8D8A8" },
  { id: "business",   label: "Business",    icon: "◑", color: "#FF8FB1" },
];

const DOC_TYPES = [
  { id: "series_bible",    label: "Series Bible" },
  { id: "character_bible", label: "Character Bible" },
  { id: "premise",         label: "Premise" },
  { id: "tone_guide",      label: "Tone Guide" },
  { id: "research",        label: "Research" },
  { id: "reference",       label: "Reference" },
];

const NAV = [
  { id: "capture",      label: "Capture" },
  { id: "library",      label: "Library" },
  { id: "canon",        label: "Canon" },
  { id: "deliverables", label: "Deliverables" },
];

export default function SignalDashboard() {
  const [user, setUser] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs, setCanonDocs] = useState([]);
  const [activeView, setActiveView] = useState("capture");
  const [activeIdea, setActiveIdea] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [canonUpload, setCanonUpload] = useState({ title: "", type: "reference", content: "" });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

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
        supabase.from("deliverables").select("*, idea:ideas(text, category)").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("canon_documents").select("*").eq("user_id", uid).eq("is_active", true).order("created_at", { ascending: false }),
      ]);
      if (u) setUser(u);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const showNotif = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const analyzeWithAI = async (text) => {
    setIsAnalyzing(true);
    try {
      const canonContext = canonDocs.filter(d => d.is_active).slice(0, 3).map(d => `[${d.title}]: ${d.content.slice(0, 500)}`).join("\n\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are a brilliant script editor and dramaturg. Analyze ideas across MULTIPLE dimensions simultaneously.${canonContext ? `\n\nCANON CONTEXT:\n${canonContext}` : ""}\n\nRespond ONLY with raw JSON:\n{"category":"premise|character|scene|dialogue|arc|production|research|business","dimensions":["2-4 strings"],"aiNote":"1-2 sentences of genuine insight","deliverables":["2-3 invitations not tasks"],"inspirationQuestion":"one question","signalStrength":3,"canonResonance":"how this connects to canon"}`,
          messages: [{ role: "user", content: `Project: ${user?.project_name || "Film Series"}\n\nIdea: "${text}"` }],
        }),
      });
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
    } catch {
      return { category: "premise", dimensions: ["story", "character"], aiNote: "This idea has layers worth exploring.", deliverables: ["Expand in 3 sentences", "Connect to protagonist's arc"], inspirationQuestion: "What made this feel important?", signalStrength: 3, canonResonance: "" };
    } finally { setIsAnalyzing(false); }
  };

  const captureIdea = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput("");
    showNotif("Analyzing...", "processing");
    const analysis = await analyzeWithAI(text);
    const { data: saved, error } = await supabase.from("ideas").insert([{
      user_id: user.id, text, source: "app",
      category: analysis.category || "premise",
      ai_note: analysis.aiNote || "",
      inspiration_question: analysis.inspirationQuestion,
      signal_strength: analysis.signalStrength || 3,
      canon_resonance: analysis.canonResonance || "",
    }]).select().single();
    if (error) { showNotif("Failed to save.", "error"); return; }
    if (analysis.dimensions?.length) await supabase.from("dimensions").insert(analysis.dimensions.map(l => ({ idea_id: saved.id, label: l })));
    if (analysis.deliverables?.length) await supabase.from("deliverables").insert(analysis.deliverables.map(t => ({ idea_id: saved.id, user_id: user.id, text: t })));
    await loadAll(user.id);
    setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(l => ({ label: l })) });
    setActiveView("library");
    showNotif("Signal captured.", "success");
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
      setShowUploadForm(false);
      showNotif("Document added to Canon.", "success");
    } catch { showNotif("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const handleFileUpload = (e) => {
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

  const toggleCanonDoc = async (id, current) => {
    await supabase.from("canon_documents").update({ is_active: !current }).eq("id", id);
    setCanonDocs(prev => prev.map(d => d.id === id ? { ...d, is_active: !current } : d));
  };

  const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
  const filteredIdeas = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
  const pendingCount = deliverables.filter(d => !d.is_complete).length;
  const activeCanonCount = canonDocs.filter(d => d.is_active).length;

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: "Georgia, serif", fontSize: 22, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textSecondary, fontFamily: "Georgia, serif", fontSize: 15 }}>Complete onboarding first.</div>
    </div>
  );

  // Shared input style
  const inputStyle = {
    width: "100%", background: C.surface, border: `1px solid ${C.border}`,
    color: C.textPrimary, padding: "11px 14px", fontFamily: "Georgia, serif",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", overflow: "hidden", fontFamily: "Georgia, 'Times New Roman', serif", color: C.textPrimary }}>

      {/* Notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: notification.type === "success" ? C.success : notification.type === "processing" ? C.accentGold : notification.type === "error" ? C.error : C.surface, color: C.bg, padding: "10px 24px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.08em", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", borderRadius: 2 }}>
          {notification.msg}
        </div>
      )}

      {/* ── LEFT COLUMN ── */}
      <div style={{ width: 256, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 24, color: C.textPrimary, letterSpacing: "-0.04em", fontStyle: "italic", marginBottom: 3 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>{user.project_name?.toUpperCase()}</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          {NAV.map(item => (
            <div key={item.id} onClick={() => { setActiveView(item.id); setActiveIdea(null); }}
              style={{ padding: "11px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: activeView === item.id ? C.surfaceHigh : "transparent", borderLeft: activeView === item.id ? `3px solid ${C.accentGold}` : "3px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 15, color: activeView === item.id ? C.textPrimary : C.textSecondary }}>{item.label}</span>
              <span style={{ fontSize: 12, color: C.accentGold, fontFamily: "'Courier New', monospace" }}>
                {item.id === "library" && ideas.length > 0 ? ideas.length : ""}
                {item.id === "deliverables" && pendingCount > 0 ? pendingCount : ""}
                {item.id === "canon" && activeCanonCount > 0 ? activeCanonCount : ""}
              </span>
            </div>
          ))}
        </nav>

        {/* Recent */}
        <div style={{ padding: "14px 20px 8px", fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>RECENT</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {ideas.slice(0, 14).map(idea => {
            const cat = getCat(idea.category);
            const isActive = activeIdea?.id === idea.id;
            return (
              <div key={idea.id} onClick={() => { setActiveIdea(idea); setActiveView("library"); }}
                style={{ padding: "10px 20px", cursor: "pointer", background: isActive ? C.surfaceHigh : "transparent", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", transition: "background 0.1s" }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontSize: 10, color: cat.color, fontFamily: "'Courier New', monospace", marginBottom: 3 }}>{cat.icon} {cat.label}</div>
                <div style={{ fontSize: 13, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5 }}>{idea.text.slice(0, 52)}{idea.text.length > 52 ? "..." : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Canon status */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 8 }}>CANON ACTIVE</div>
          {activeCanonCount === 0
            ? <div style={{ fontSize: 12, color: C.textDisabled, fontStyle: "italic" }}>No documents yet</div>
            : canonDocs.filter(d => d.is_active).slice(0, 3).map(d => (
              <div key={d.id} style={{ fontSize: 12, color: C.success, marginBottom: 4, display: "flex", gap: 6 }}>
                <span>◈</span><span>{d.title.slice(0, 24)}{d.title.length > 24 ? "..." : ""}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── CENTER COLUMN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ padding: "14px 36px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, flexShrink: 0, minHeight: 52 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>
            {activeView === "capture" && "CAPTURE"}
            {activeView === "library" && `LIBRARY — ${filteredIdeas.length} IDEAS`}
            {activeView === "canon" && "CANON MANAGER"}
            {activeView === "deliverables" && `DELIVERABLES — ${pendingCount} PENDING`}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {activeView === "library" && (
              <>
                <button onClick={() => setFilterCat(null)} style={{ background: !filterCat ? C.accentGold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.accentGold : C.border}`, padding: "4px 11px", fontSize: 10, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>ALL</button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)} title={cat.label}
                    style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>
                    {cat.icon}
                  </button>
                ))}
              </>
            )}
            {activeView === "canon" && (
              <button onClick={() => setShowUploadForm(!showUploadForm)}
                style={{ background: showUploadForm ? "transparent" : C.accentGold, color: showUploadForm ? C.textMuted : C.bg, border: showUploadForm ? `1px solid ${C.border}` : "none", padding: "7px 18px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                {showUploadForm ? "CANCEL" : "+ ADD DOCUMENT"}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* CAPTURE */}
          {activeView === "capture" && (
            <div style={{ padding: "52px 56px", maxWidth: 700 }}>
              <div style={{ borderLeft: `3px solid ${C.accentGold}`, paddingLeft: 22, marginBottom: 52 }}>
                <div style={{ fontSize: 11, color: C.accentGold, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>TODAY'S INVITATION</div>
                <div style={{ fontSize: 19, lineHeight: 1.9, color: C.textMuted, fontStyle: "italic" }}>What are you afraid to write? That's probably the most important scene.</div>
              </div>

              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
                placeholder="Don't edit. Don't qualify. Just send the signal." rows={5}
                style={{ ...inputStyle, fontSize: 16, lineHeight: 1.85, resize: "vertical", border: `1px solid ${C.border}` }}
                onFocus={e => e.target.style.borderColor = C.accentGold}
                onBlur={e => e.target.style.borderColor = C.border} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: "'Courier New', monospace" }}>⌘ + ENTER</span>
                <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()}
                  style={{ background: isAnalyzing || !input.trim() ? C.surfaceHigh : C.accentGold, color: isAnalyzing || !input.trim() ? C.textMuted : C.bg, border: "none", padding: "12px 28px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing || !input.trim() ? "default" : "pointer", transition: "all 0.2s" }}>
                  {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
                </button>
              </div>

              <div style={{ marginTop: 72, display: "flex", gap: 64, paddingTop: 36, borderTop: `1px solid ${C.border}` }}>
                {[{ label: "IDEAS CAPTURED", value: ideas.length }, { label: "PENDING WORK", value: pendingCount }, { label: "CANON DOCS", value: activeCanonCount }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 44, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIBRARY */}
          {activeView === "library" && (
            <div style={{ display: "flex", height: "100%" }}>
              {/* List */}
              <div style={{ width: 320, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
                {filteredIdeas.length === 0 && <div style={{ padding: 48, color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>Nothing here yet.</div>}
                {filteredIdeas.map(idea => {
                  const cat = getCat(idea.category);
                  const isActive = activeIdea?.id === idea.id;
                  const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
                  return (
                    <div key={idea.id} onClick={() => setActiveIdea(idea)}
                      style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: cat.color, fontFamily: "'Courier New', monospace" }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace" }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}</span>
                      </div>
                      <div style={{ fontSize: 14, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.6 }}>{idea.text.slice(0, 95)}{idea.text.length > 95 ? "..." : ""}</div>
                      {idea.signal_strength >= 4 && <div style={{ marginTop: 5, fontSize: 10, color: C.accentGold, fontFamily: "'Courier New', monospace" }}>HIGH SIGNAL</div>}
                    </div>
                  );
                })}
              </div>

              {/* Detail */}
              <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
                {activeIdea ? (
                  <div style={{ maxWidth: 600 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", marginBottom: 22 }}>
                      {new Date(activeIdea.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · via {activeIdea.source || "app"}
                    </div>

                    <div style={{ fontSize: 20, lineHeight: 1.85, color: C.textPrimary, marginBottom: 40 }}>{activeIdea.text}</div>

                    {activeIdea.ai_note && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>DRAMATURGICAL ANALYSIS</div>
                        <div style={{ background: C.surface, borderLeft: `3px solid ${getCat(activeIdea.category).color}`, padding: "18px 22px", fontSize: 16, color: C.textSecondary, lineHeight: 1.9 }}>{activeIdea.ai_note}</div>
                      </div>
                    )}

                    {activeIdea.canon_resonance && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>CANON RESONANCE</div>
                        <div style={{ background: C.surface, borderLeft: `3px solid ${C.success}`, padding: "18px 22px", fontSize: 15, color: C.textSecondary, lineHeight: 1.9 }}>{activeIdea.canon_resonance}</div>
                      </div>
                    )}

                    {activeIdea.dimensions?.length > 0 && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>OPERATING ON</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {activeIdea.dimensions.map((d, i) => (
                            <span key={i} style={{ background: C.surface, border: `1px solid ${getCat(activeIdea.category).color}50`, color: getCat(activeIdea.category).color, padding: "6px 14px", fontSize: 12, fontFamily: "'Courier New', monospace" }}>{d.label}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {deliverables.filter(d => d.idea_id === activeIdea.id).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>INVITATIONS TO ACTION</div>
                        {deliverables.filter(d => d.idea_id === activeIdea.id).map(d => (
                          <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                            style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer", alignItems: "flex-start" }}>
                            <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${d.is_complete ? getCat(activeIdea.category).color : C.borderLight}`, background: d.is_complete ? getCat(activeIdea.category).color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.bg, marginTop: 3, transition: "all 0.2s" }}>
                              {d.is_complete ? "✓" : ""}
                            </div>
                            <span style={{ fontSize: 15, color: d.is_complete ? C.textDisabled : C.textSecondary, textDecoration: d.is_complete ? "line-through" : "none", lineHeight: 1.75 }}>{d.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDisabled, fontStyle: "italic", fontSize: 17 }}>Select an idea to read it</div>
                )}
              </div>
            </div>
          )}

          {/* CANON */}
          {activeView === "canon" && (
            <div style={{ display: "flex", height: "100%" }}>

              {/* Left — document list */}
              <div style={{ width: 320, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
                {showUploadForm && (
                  <div style={{ padding: 24, borderBottom: `1px solid ${C.border}`, background: C.surfaceHigh }}>
                    <div style={{ fontSize: 11, color: C.accentGold, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 18 }}>NEW CANON DOCUMENT</div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>TITLE</div>
                      <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))} placeholder="e.g. CRISPR Series Bible"
                        style={inputStyle} onFocus={e => e.target.style.borderColor = C.accentGold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 6 }}>TYPE</div>
                      <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
                        style={{ ...inputStyle, fontFamily: "'Courier New', monospace", fontSize: 12 }}>
                        {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em" }}>CONTENT</div>
                        <button onClick={() => fileInputRef.current?.click()}
                          style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, padding: "3px 10px", fontFamily: "'Courier New', monospace", fontSize: 9, cursor: "pointer" }}>
                          UPLOAD FILE
                        </button>
                        <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileUpload} style={{ display: "none" }} />
                      </div>
                      {canonUpload.content && <div style={{ fontSize: 11, color: C.success, fontFamily: "'Courier New', monospace", marginBottom: 6 }}>✓ {canonUpload.content.length.toLocaleString()} chars loaded</div>}
                      <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
                        placeholder="Paste content or upload file..." rows={5}
                        style={{ ...inputStyle, fontSize: 12, lineHeight: 1.6, resize: "vertical" }}
                        onFocus={e => e.target.style.borderColor = C.accentGold} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                    <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content}
                      style={{ width: "100%", background: isUploading || !canonUpload.title || !canonUpload.content ? C.surfaceHigh : C.accentGold, color: isUploading || !canonUpload.title || !canonUpload.content ? C.textMuted : C.bg, border: "none", padding: "11px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                      {isUploading ? "SAVING..." : "SAVE TO CANON →"}
                    </button>
                  </div>
                )}

                {canonDocs.length === 0 && !showUploadForm && (
                  <div style={{ padding: 32, color: C.textDisabled, fontStyle: "italic", fontSize: 14, lineHeight: 1.8 }}>
                    No documents yet.<br />Add your series bible, character docs, premise statements.
                  </div>
                )}

                {canonDocs.map(doc => (
                  <div key={doc.id} onClick={() => setActiveDoc(activeDoc?.id === doc.id ? null : doc)}
                    style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, borderLeft: activeDoc?.id === doc.id ? `3px solid ${C.success}` : "3px solid transparent", background: activeDoc?.id === doc.id ? C.surfaceHigh : "transparent", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 4, lineHeight: 1.4 }}>{doc.title}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace" }}>
                          {DOC_TYPES.find(t => t.id === doc.doc_type)?.label} · {doc.content?.length?.toLocaleString()} chars
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCanonDoc(doc.id, doc.is_active); }}
                        style={{ background: "transparent", color: doc.is_active ? C.success : C.textMuted, border: `1px solid ${doc.is_active ? C.success : C.border}`, padding: "3px 10px", fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", flexShrink: 0 }}>
                        {doc.is_active ? "ACTIVE" : "OFF"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right — full document reader */}
              <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
                {activeDoc ? (
                  <div style={{ maxWidth: 680 }}>
                    <div style={{ marginBottom: 32 }}>
                      <div style={{ fontSize: 22, color: C.textPrimary, marginBottom: 8 }}>{activeDoc.title}</div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace" }}>{DOC_TYPES.find(t => t.id === activeDoc.doc_type)?.label}</span>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace" }}>{activeDoc.content?.length?.toLocaleString()} characters</span>
                        <span style={{ fontSize: 11, color: activeDoc.is_active ? C.success : C.textDisabled, fontFamily: "'Courier New', monospace" }}>
                          {activeDoc.is_active ? "◈ Active in Canon" : "○ Inactive"}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 1, background: C.border, marginBottom: 32 }} />
                    <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.9, whiteSpace: "pre-wrap", fontFamily: "Georgia, serif" }}>
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
          )}

          {/* DELIVERABLES */}
          {activeView === "deliverables" && (
            <div style={{ padding: "40px 56px", maxWidth: 720 }}>
              <div style={{ marginBottom: 44, display: "flex", gap: 64 }}>
                {[{ label: "PENDING", value: pendingCount }, { label: "COMPLETED", value: deliverables.filter(d => d.is_complete).length }, { label: "TOTAL", value: deliverables.length }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 48, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ height: 3, background: C.border, marginBottom: 48, borderRadius: 2 }}>
                <div style={{ height: "100%", background: C.success, width: `${(deliverables.filter(d => d.is_complete).length / Math.max(deliverables.length, 1)) * 100}%`, transition: "width 0.5s ease", borderRadius: 2 }} />
              </div>

              {CATEGORIES.map(cat => {
                const catTasks = deliverables.filter(d => d.idea?.category === cat.id);
                if (!catTasks.length) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 40 }}>
                    <div style={{ fontSize: 11, color: cat.color, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em", marginBottom: 16 }}>
                      {cat.icon} {cat.label.toUpperCase()} — {catTasks.filter(t => !t.is_complete).length} remaining
                    </div>
                    {catTasks.map(task => (
                      <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)}
                        style={{ display: "flex", gap: 18, padding: "15px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer", alignItems: "flex-start" }}>
                        <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${task.is_complete ? cat.color : C.borderLight}`, background: task.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.bg, marginTop: 4, transition: "all 0.2s" }}>
                          {task.is_complete ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, color: task.is_complete ? C.textDisabled : C.textSecondary, textDecoration: task.is_complete ? "line-through" : "none", lineHeight: 1.75, marginBottom: 4 }}>{task.text}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>from: {task.idea?.text?.slice(0, 65)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div style={{ width: 256, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>SIGNAL STATUS</div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ marginBottom: 32 }}>
            {[
              { label: "Total Ideas",  value: ideas.length,                                                                      color: C.accentGold },
              { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at).getTime() < 7*86400000).length, color: "#7ABCFF" },
              { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length,                                 color: C.success },
              { label: "Via WhatsApp", value: ideas.filter(i => i.source === "whatsapp").length,                                color: "#CF9FFF" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14, color: C.textSecondary }}>{s.label}</span>
                <span style={{ fontSize: 24, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 16 }}>BY CATEGORY</div>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>{cat.label}</span>
                    <span style={{ fontSize: 13, color: cat.color, fontFamily: "'Courier New', monospace" }}>{count}</span>
                  </div>
                  <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, borderRadius: 2, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>CANON LAYER</div>
            {activeCanonCount === 0
              ? <div style={{ fontSize: 13, color: C.textDisabled, lineHeight: 1.75, fontStyle: "italic" }}>No documents active. AI working without Canon context.</div>
              : <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.75 }}>{activeCanonCount} document{activeCanonCount !== 1 ? "s" : ""} conditioning all analysis.</div>
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#48454E; border-radius:2px; }
        textarea::placeholder, input::placeholder { color:#49454F; }
        select option { background:#2B2930; color:#E6E1E5; }
      `}</style>
    </div>
  );
}
