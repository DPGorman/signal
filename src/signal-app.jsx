import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = [
  { id: "premise", label: "Premise", icon: "◈", color: "#E8C547" },
  { id: "character", label: "Character", icon: "◉", color: "#E87B47" },
  { id: "scene", label: "Scene", icon: "◫", color: "#47B5E8" },
  { id: "dialogue", label: "Dialogue", icon: "◌", color: "#C447E8" },
  { id: "arc", label: "Story Arc", icon: "◎", color: "#47E8A0" },
  { id: "production", label: "Production", icon: "◧", color: "#E84747" },
  { id: "research", label: "Research", icon: "◐", color: "#8BE847" },
  { id: "business", label: "Business", icon: "◑", color: "#E8479A" },
];

const DOC_TYPES = [
  { id: "premise", label: "Premise" },
  { id: "character_bible", label: "Character Bible" },
  { id: "series_bible", label: "Series Bible" },
  { id: "tone_guide", label: "Tone Guide" },
  { id: "research", label: "Research" },
  { id: "reference", label: "Reference" },
];

const NAV_ITEMS = [
  { id: "capture", label: "Capture", icon: "⊕" },
  { id: "library", label: "Library", icon: "◫" },
  { id: "canon", label: "Canon", icon: "◈" },
  { id: "deliverables", label: "Deliverables", icon: "◎" },
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
  const [canonUpload, setCanonUpload] = useState({ title: "", type: "reference", content: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
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
      const canonContext = canonDocs.slice(0, 3).map(d => `[${d.title}]: ${d.content.slice(0, 400)}`).join("\n\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are a brilliant script editor and dramaturg working on a specific project. Analyze ideas across MULTIPLE dimensions simultaneously — never flatten a rich idea into a single category.

${canonContext ? `CANON CONTEXT (push against this):\n${canonContext}\n\n` : ""}

Respond ONLY with raw JSON (no markdown, no backticks):
{"category":"one of [premise,character,scene,dialogue,arc,production,research,business]","dimensions":["2-4 strings"],"aiNote":"1-2 sentences of genuine dramaturgical insight specific to this project","deliverables":["2-3 next steps as invitations"],"inspirationQuestion":"one question","signalStrength":1-5,"canonResonance":"how this connects to or pushes against the canon"}`,
          messages: [{ role: "user", content: `Project: ${user?.project_name || "Film Series"}\n\nIdea: "${text}"` }],
        }),
      });
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
    } catch (e) {
      return { category: "premise", dimensions: ["story", "character"], aiNote: "This idea has layers worth exploring.", deliverables: ["Expand in 3 sentences"], inspirationQuestion: "What made this feel important?", signalStrength: 3, canonResonance: "" };
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
        user_id: user.id,
        title: canonUpload.title,
        doc_type: canonUpload.type,
        content: canonUpload.content,
        is_active: true,
      }]).select().single();
      if (error) throw error;
      setCanonDocs(prev => [data, ...prev]);
      setCanonUpload({ title: "", type: "reference", content: "" });
      setShowUploadForm(false);
      showNotif("Canon document saved.", "success");
    } catch { showNotif("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCanonUpload(prev => ({
        ...prev,
        content: ev.target.result,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
    };
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
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#222", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.3em" }}>SIGNAL</div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#555", fontFamily: "'Georgia', serif", fontSize: 14 }}>
        Complete onboarding at <a href="https://signal-navy-five.vercel.app" style={{ color: "#E8C547" }}>signal-navy-five.vercel.app</a> first.
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "#080808", color: "#F0EDE6", fontFamily: "'Georgia', serif", display: "flex", overflow: "hidden" }}>

      {/* Notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: notification.type === "success" ? "#47E8A0" : notification.type === "processing" ? "#E8C547" : notification.type === "error" ? "#E84747" : "#333", color: "#080808", padding: "8px 20px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", animation: "fadeIn 0.2s ease" }}>
          {notification.msg}
        </div>
      )}

      {/* LEFT COLUMN — Navigation + Canon */}
      <div style={{ width: 220, borderRight: "1px solid #111", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #111" }}>
          <div style={{ fontSize: 20, letterSpacing: "-0.04em", fontStyle: "italic", marginBottom: 2 }}>Signal</div>
          <div style={{ fontSize: 9, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>{user.project_name?.toUpperCase()}</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 0" }}>
          {NAV_ITEMS.map(item => (
            <div key={item.id} onClick={() => { setActiveView(item.id); setActiveIdea(null); setActiveDoc(null); }} style={{ padding: "9px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: activeView === item.id ? "#111" : "transparent", borderLeft: activeView === item.id ? "2px solid #E8C547" : "2px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 11, color: activeView === item.id ? "#E8C547" : "#333" }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: activeView === item.id ? "#F0EDE6" : "#555", fontFamily: "'Courier New', monospace", letterSpacing: "0.05em" }}>{item.label}</span>
              {item.id === "deliverables" && pendingCount > 0 && <span style={{ marginLeft: "auto", fontSize: 9, color: "#E8C547", fontFamily: "'Courier New', monospace" }}>{pendingCount}</span>}
              {item.id === "canon" && activeCanonCount > 0 && <span style={{ marginLeft: "auto", fontSize: 9, color: "#47E8A0", fontFamily: "'Courier New', monospace" }}>{activeCanonCount}</span>}
              {item.id === "library" && <span style={{ marginLeft: "auto", fontSize: 9, color: "#333", fontFamily: "'Courier New', monospace" }}>{ideas.length}</span>}
            </div>
          ))}
        </nav>

        <div style={{ height: 1, background: "#111", margin: "4px 0" }} />

        {/* Recent captures */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          <div style={{ padding: "0 20px 8px", fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>RECENT</div>
          {ideas.slice(0, 8).map(idea => {
            const cat = getCat(idea.category);
            return (
              <div key={idea.id} onClick={() => { setActiveIdea(idea); setActiveView("library"); }} style={{ padding: "7px 20px", cursor: "pointer", borderLeft: activeIdea?.id === idea.id ? `2px solid ${cat.color}` : "2px solid transparent", transition: "all 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0D0D0D"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ fontSize: 9, color: cat.color, fontFamily: "'Courier New', monospace", marginBottom: 2 }}>{cat.icon}</div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>{idea.text.slice(0, 45)}{idea.text.length > 45 ? "..." : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Canon status */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 6 }}>CANON ACTIVE</div>
          {activeCanonCount === 0
            ? <div style={{ fontSize: 10, color: "#2A2A2A", fontStyle: "italic" }}>No documents yet</div>
            : canonDocs.filter(d => d.is_active).slice(0, 3).map(d => (
              <div key={d.id} style={{ fontSize: 10, color: "#47E8A0", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 7 }}>◈</span> {d.title.slice(0, 22)}{d.title.length > 22 ? "..." : ""}
              </div>
            ))
          }
        </div>
      </div>

      {/* CENTER COLUMN — Main work surface */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Center header */}
        <div style={{ padding: "18px 32px", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>
            {activeView === "capture" && "CAPTURE"}
            {activeView === "library" && `LIBRARY — ${filteredIdeas.length} IDEAS`}
            {activeView === "canon" && "CANON MANAGER"}
            {activeView === "deliverables" && `DELIVERABLES — ${pendingCount} PENDING`}
          </div>
          {activeView === "library" && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setFilterCat(null)} style={{ background: !filterCat ? "#F0EDE6" : "transparent", color: !filterCat ? "#080808" : "#333", border: `1px solid ${!filterCat ? "#F0EDE6" : "#1A1A1A"}`, padding: "2px 8px", fontSize: 8, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>ALL</button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)} style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? "#080808" : "#333", border: `1px solid ${filterCat === cat.id ? cat.color : "#1A1A1A"}`, padding: "2px 8px", fontSize: 8, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>
                  {cat.icon}
                </button>
              ))}
            </div>
          )}
          {activeView === "canon" && (
            <button onClick={() => setShowUploadForm(!showUploadForm)} style={{ background: showUploadForm ? "#E8C547" : "transparent", color: showUploadForm ? "#080808" : "#E8C547", border: "1px solid #E8C547", padding: "4px 14px", fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em", cursor: "pointer" }}>
              {showUploadForm ? "CANCEL" : "+ ADD DOCUMENT"}
            </button>
          )}
        </div>

        {/* Center content */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* CAPTURE */}
          {activeView === "capture" && (
            <div style={{ padding: "48px 32px", maxWidth: 680 }}>
              <div style={{ borderLeft: "2px solid #E8C547", paddingLeft: 20, marginBottom: 48 }}>
                <div style={{ fontSize: 9, color: "#E8C547", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 8 }}>TODAY'S INVITATION</div>
                <div style={{ fontSize: 17, lineHeight: 1.8, color: "#666", fontStyle: "italic" }}>What are you afraid to write? That's probably the most important scene.</div>
              </div>

              <div style={{ marginBottom: 8, fontSize: 9, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }} placeholder="Don't edit. Don't qualify. Just send the signal."
                style={{ width: "100%", minHeight: 140, background: "#0D0D0D", border: "1px solid #1A1A1A", color: "#F0EDE6", padding: 20, fontFamily: "'Georgia', serif", fontSize: 15, lineHeight: 1.8, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#1A1A1A"} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontSize: 9, color: "#1A1A1A", fontFamily: "'Courier New', monospace" }}>⌘ + ENTER</span>
                <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()} style={{ background: isAnalyzing ? "#0D0D0D" : "#E8C547", color: "#080808", border: "none", padding: "10px 24px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
                  {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
                </button>
              </div>

              <div style={{ marginTop: 56, display: "flex", gap: 48 }}>
                {[{ label: "CAPTURED", value: ideas.length }, { label: "PENDING", value: pendingCount }, { label: "CANON DOCS", value: activeCanonCount }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 32, fontStyle: "italic", color: "#F0EDE6" }}>{s.value}</div>
                    <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIBRARY */}
          {activeView === "library" && (
            <div style={{ display: "flex", height: "100%" }}>
              {/* Idea list */}
              <div style={{ width: 300, borderRight: "1px solid #0D0D0D", overflowY: "auto" }}>
                {filteredIdeas.length === 0 && <div style={{ padding: 32, color: "#1A1A1A", fontStyle: "italic", fontSize: 13 }}>Nothing here yet.</div>}
                {filteredIdeas.map(idea => {
                  const cat = getCat(idea.category);
                  const isActive = activeIdea?.id === idea.id;
                  const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
                  return (
                    <div key={idea.id} onClick={() => setActiveIdea(idea)} style={{ padding: "14px 20px", borderLeft: isActive ? `2px solid ${cat.color}` : "2px solid transparent", background: isActive ? "#0D0D0D" : "transparent", cursor: "pointer", borderBottom: "1px solid #0A0A0A" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 8, color: cat.color, fontFamily: "'Courier New', monospace" }}>{cat.icon} {cat.label.toUpperCase()}</span>
                        <span style={{ fontSize: 8, color: "#1A1A1A", fontFamily: "'Courier New', monospace" }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}</span>
                      </div>
                      <div style={{ fontSize: 12, color: isActive ? "#F0EDE6" : "#666", lineHeight: 1.5 }}>{idea.text.slice(0, 75)}{idea.text.length > 75 ? "..." : ""}</div>
                      {idea.signal_strength >= 4 && <div style={{ marginTop: 4, fontSize: 8, color: "#E8C547", fontFamily: "'Courier New', monospace" }}>HIGH SIGNAL</div>}
                    </div>
                  );
                })}
              </div>

              {/* Idea detail */}
              <div style={{ flex: 1, overflowY: "auto", padding: "32px 36px" }}>
                {activeIdea ? (
                  <div style={{ maxWidth: 560 }}>
                    <div style={{ fontSize: 9, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 16 }}>
                      {new Date(activeIdea.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · via {activeIdea.source || "app"}
                    </div>
                    <div style={{ fontSize: 18, lineHeight: 1.8, color: "#F0EDE6", marginBottom: 28 }}>{activeIdea.text}</div>

                    {activeIdea.ai_note && (
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
                        <div style={{ background: "#0A0A0A", borderLeft: `2px solid ${getCat(activeIdea.category).color}`, padding: "14px 18px", fontSize: 13, color: "#888", lineHeight: 1.8 }}>{activeIdea.ai_note}</div>
                      </div>
                    )}

                    {activeIdea.canon_resonance && (
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>CANON RESONANCE</div>
                        <div style={{ background: "#0A0A0A", borderLeft: "2px solid #47E8A0", padding: "14px 18px", fontSize: 12, color: "#666", lineHeight: 1.8 }}>{activeIdea.canon_resonance}</div>
                      </div>
                    )}

                    {activeIdea.dimensions?.length > 0 && (
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>OPERATING ON</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {activeIdea.dimensions.map((d, i) => <span key={i} style={{ border: `1px solid ${getCat(activeIdea.category).color}26`, color: getCat(activeIdea.category).color, padding: "4px 10px", fontSize: 10, fontFamily: "'Courier New', monospace" }}>{d.label}</span>)}
                        </div>
                      </div>
                    )}

                    {deliverables.filter(d => d.idea_id === activeIdea.id).length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>INVITATIONS TO ACTION</div>
                        {deliverables.filter(d => d.idea_id === activeIdea.id).map(d => (
                          <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #0A0A0A", cursor: "pointer", alignItems: "flex-start" }}>
                            <div style={{ width: 14, height: 14, flexShrink: 0, border: `1px solid ${d.is_complete ? getCat(activeIdea.category).color : "#1A1A1A"}`, background: d.is_complete ? getCat(activeIdea.category).color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#080808", marginTop: 3 }}>
                              {d.is_complete ? "✓" : ""}
                            </div>
                            <span style={{ fontSize: 13, color: d.is_complete ? "#2A2A2A" : "#C0BDB6", textDecoration: d.is_complete ? "line-through" : "none", lineHeight: 1.6 }}>{d.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#1A1A1A", fontStyle: "italic", fontSize: 14 }}>Select an idea</div>
                )}
              </div>
            </div>
          )}

          {/* CANON MANAGER */}
          {activeView === "canon" && (
            <div style={{ padding: "32px", maxWidth: 800 }}>

              {showUploadForm && (
                <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 28, marginBottom: 32 }}>
                  <div style={{ fontSize: 10, color: "#E8C547", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 20 }}>NEW CANON DOCUMENT</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 6 }}>TITLE</div>
                      <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))} placeholder="Series Bible, Character Doc..."
                        style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#F0EDE6", padding: "10px 14px", fontFamily: "'Georgia', serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#222"} />
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 6 }}>TYPE</div>
                      <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
                        style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#F0EDE6", padding: "10px 14px", fontFamily: "'Courier New', monospace", fontSize: 11, outline: "none", boxSizing: "border-box" }}>
                        {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 6 }}>CONTENT</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", border: "1px solid #222", color: "#555", padding: "6px 14px", fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                        UPLOAD FILE (.txt, .md)
                      </button>
                      <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileUpload} style={{ display: "none" }} />
                      {canonUpload.content && <span style={{ fontSize: 9, color: "#47E8A0", fontFamily: "'Courier New', monospace", alignSelf: "center" }}>✓ {canonUpload.content.length.toLocaleString()} characters loaded</span>}
                    </div>
                    <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))} placeholder="Paste your document content here, or upload a file above..."
                      rows={8} style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#F0EDE6", padding: "12px 14px", fontFamily: "'Georgia', serif", fontSize: 12, lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#222"} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content} style={{ background: isUploading ? "#0D0D0D" : "#E8C547", color: "#080808", border: "none", padding: "10px 24px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                      {isUploading ? "SAVING..." : "SAVE TO CANON →"}
                    </button>
                  </div>
                </div>
              )}

              {canonDocs.length === 0 && !showUploadForm && (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <div style={{ fontSize: 32, color: "#111", marginBottom: 16 }}>◈</div>
                  <div style={{ fontSize: 14, color: "#333", fontStyle: "italic", marginBottom: 8 }}>No Canon documents yet.</div>
                  <div style={{ fontSize: 12, color: "#222", lineHeight: 1.7 }}>Upload your series bible, character docs, premise statements.<br />The AI will push every new idea against them.</div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {canonDocs.map(doc => (
                  <div key={doc.id} onClick={() => setActiveDoc(activeDoc?.id === doc.id ? null : doc)} style={{ background: activeDoc?.id === doc.id ? "#0D0D0D" : "transparent", border: "1px solid #111", padding: "16px 20px", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#1A1A1A"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#111"}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, color: doc.is_active ? "#47E8A0" : "#333" }}>◈</span>
                        <div>
                          <div style={{ fontSize: 13, color: doc.is_active ? "#F0EDE6" : "#444" }}>{doc.title}</div>
                          <div style={{ fontSize: 9, color: "#333", fontFamily: "'Courier New', monospace", marginTop: 2 }}>{DOC_TYPES.find(t => t.id === doc.doc_type)?.label || doc.doc_type} · {doc.content?.length?.toLocaleString()} chars</div>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCanonDoc(doc.id, doc.is_active); }} style={{ background: "transparent", border: `1px solid ${doc.is_active ? "#47E8A0" : "#222"}`, color: doc.is_active ? "#47E8A0" : "#333", padding: "3px 10px", fontFamily: "'Courier New', monospace", fontSize: 8, letterSpacing: "0.1em", cursor: "pointer" }}>
                        {doc.is_active ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </div>
                    {activeDoc?.id === doc.id && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #111", fontSize: 12, color: "#555", lineHeight: 1.7, maxHeight: 200, overflowY: "auto" }}>
                        {doc.content?.slice(0, 800)}{doc.content?.length > 800 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELIVERABLES */}
          {activeView === "deliverables" && (
            <div style={{ padding: "32px", maxWidth: 680 }}>
              <div style={{ height: 2, background: "#0D0D0D", marginBottom: 40 }}>
                <div style={{ height: "100%", background: "#47E8A0", width: `${(deliverables.filter(d => d.is_complete).length / Math.max(deliverables.length, 1)) * 100}%`, transition: "width 0.5s ease" }} />
              </div>

              <div style={{ marginBottom: 32, display: "flex", gap: 40 }}>
                <div><div style={{ fontSize: 28, fontStyle: "italic" }}>{pendingCount}</div><div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginTop: 4 }}>PENDING</div></div>
                <div><div style={{ fontSize: 28, fontStyle: "italic" }}>{deliverables.filter(d => d.is_complete).length}</div><div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginTop: 4 }}>COMPLETED</div></div>
              </div>

              {CATEGORIES.map(cat => {
                const catTasks = deliverables.filter(d => d.idea?.category === cat.id);
                if (!catTasks.length) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 8, color: cat.color, fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>
                      {cat.icon} {cat.label.toUpperCase()} — {catTasks.filter(t => !t.is_complete).length} remaining
                    </div>
                    {catTasks.map(task => (
                      <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #0A0A0A", cursor: "pointer", alignItems: "flex-start" }}>
                        <div style={{ width: 15, height: 15, flexShrink: 0, border: `1px solid ${task.is_complete ? cat.color : "#1A1A1A"}`, background: task.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#080808", marginTop: 3 }}>
                          {task.is_complete ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: task.is_complete ? "#2A2A2A" : "#C0BDB6", textDecoration: task.is_complete ? "line-through" : "none", lineHeight: 1.6, marginBottom: 2 }}>{task.text}</div>
                          <div style={{ fontSize: 9, color: "#1A1A1A", fontStyle: "italic" }}>from: {task.idea?.text?.slice(0, 50)}...</div>
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

      {/* RIGHT COLUMN — Context panel */}
      <div style={{ width: 240, borderLeft: "1px solid #111", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>SIGNAL STATUS</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Stats */}
          <div style={{ marginBottom: 28 }}>
            {[
              { label: "IDEAS", value: ideas.length, color: "#E8C547" },
              { label: "THIS WEEK", value: ideas.filter(i => Date.now() - new Date(i.created_at).getTime() < 7 * 86400000).length, color: "#47B5E8" },
              { label: "HIGH SIGNAL", value: ideas.filter(i => i.signal_strength >= 4).length, color: "#47E8A0" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #0D0D0D" }}>
                <span style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>{s.label}</span>
                <span style={{ fontSize: 16, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>BY CATEGORY</div>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: "#333", fontFamily: "'Courier New', monospace" }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize: 9, color: cat.color, fontFamily: "'Courier New', monospace" }}>{count}</span>
                  </div>
                  <div style={{ height: 1, background: "#0D0D0D" }}>
                    <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, opacity: 0.6 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>WHATSAPP CAPTURE</div>
            <div style={{ fontSize: 9, color: "#333", lineHeight: 1.7 }}>
              {ideas.filter(i => i.source === "whatsapp").length} ideas via WhatsApp
            </div>
          </div>

          {/* Active Canon */}
          <div>
            <div style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>CANON LAYER</div>
            {activeCanonCount === 0
              ? <div style={{ fontSize: 10, color: "#1A1A1A", fontStyle: "italic", lineHeight: 1.6 }}>No documents active. AI analyzing without Canon context.</div>
              : <div style={{ fontSize: 10, color: "#555", lineHeight: 1.7 }}>{activeCanonCount} document{activeCanonCount !== 1 ? "s" : ""} conditioning analysis.</div>
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:2px; } ::-webkit-scrollbar-track { background:#080808; } ::-webkit-scrollbar-thumb { background:#1A1A1A; }
        textarea::placeholder, input::placeholder { color:#1A1A1A; }
        select option { background:#111; }
      `}</style>
    </div>
  );
}
