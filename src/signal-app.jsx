import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = [
  { id: "premise", label: "Premise", icon: "◈", color: "#C9920A" },
  { id: "character", label: "Character", icon: "◉", color: "#C45A1A" },
  { id: "scene", label: "Scene", icon: "◫", color: "#1A78C2" },
  { id: "dialogue", label: "Dialogue", icon: "◌", color: "#8B2CC4" },
  { id: "arc", label: "Story Arc", icon: "◎", color: "#1A9E5A" },
  { id: "production", label: "Production", icon: "◧", color: "#C41A1A" },
  { id: "research", label: "Research", icon: "◐", color: "#5A9E1A" },
  { id: "business", label: "Business", icon: "◑", color: "#C41A6E" },
];

const DOC_TYPES = [
  { id: "series_bible", label: "Series Bible" },
  { id: "character_bible", label: "Character Bible" },
  { id: "premise", label: "Premise" },
  { id: "tone_guide", label: "Tone Guide" },
  { id: "research", label: "Research" },
  { id: "reference", label: "Reference" },
];

const NAV = [
  { id: "capture", label: "Capture" },
  { id: "library", label: "Library" },
  { id: "canon", label: "Canon" },
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
          system: `You are a brilliant script editor and dramaturg. Analyze ideas across MULTIPLE dimensions simultaneously.${canonContext ? `\n\nCANON CONTEXT:\n${canonContext}` : ""}\n\nRespond ONLY with raw JSON:\n{"category":"premise|character|scene|dialogue|arc|production|research|business","dimensions":["2-4 strings"],"aiNote":"1-2 sentences of genuine insight","deliverables":["2-3 invitations not tasks"],"inspirationQuestion":"one question","signalStrength":1,"canonResonance":"how this connects to canon"}`,
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
    <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#BBB", fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic", letterSpacing: "-0.02em" }}>Signal</div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#999", fontFamily: "Georgia, serif", fontSize: 15 }}>Complete onboarding first.</div>
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "#F7F5F2", display: "flex", overflow: "hidden", fontFamily: "Georgia, 'Times New Roman', serif" }}>

      {/* Notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: notification.type === "success" ? "#1A9E5A" : notification.type === "processing" ? "#C9920A" : notification.type === "error" ? "#C41A1A" : "#555", color: "#FFF", padding: "10px 24px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.08em", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {notification.msg}
        </div>
      )}

      {/* ── LEFT COLUMN ── */}
      <div style={{ width: 260, background: "#FFFFFF", borderRight: "1px solid #ECEAE6", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "2px 0 8px rgba(0,0,0,0.03)" }}>

        <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid #F2F0EC" }}>
          <div style={{ fontSize: 24, color: "#1A1A1A", letterSpacing: "-0.04em", fontStyle: "italic", marginBottom: 4 }}>Signal</div>
          <div style={{ fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>{user.project_name?.toUpperCase()}</div>
        </div>

        <nav style={{ padding: "8px 0" }}>
          {NAV.map(item => (
            <div key={item.id} onClick={() => { setActiveView(item.id); setActiveIdea(null); }} style={{ padding: "12px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: activeView === item.id ? "#F7F5F2" : "transparent", borderLeft: activeView === item.id ? "3px solid #C9920A" : "3px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 15, color: activeView === item.id ? "#1A1A1A" : "#9A9590" }}>{item.label}</span>
              <span style={{ fontSize: 12, color: "#C9920A", fontFamily: "'Courier New', monospace" }}>
                {item.id === "library" && ideas.length > 0 ? ideas.length : ""}
                {item.id === "deliverables" && pendingCount > 0 ? pendingCount : ""}
                {item.id === "canon" && activeCanonCount > 0 ? activeCanonCount : ""}
              </span>
            </div>
          ))}
        </nav>

        <div style={{ height: 1, background: "#F2F0EC", margin: "4px 0" }} />

        <div style={{ padding: "12px 24px 6px", fontSize: 10, color: "#C8C4BC", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>RECENT</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {ideas.slice(0, 12).map(idea => {
            const cat = getCat(idea.category);
            const isActive = activeIdea?.id === idea.id;
            return (
              <div key={idea.id} onClick={() => { setActiveIdea(idea); setActiveView("library"); }}
                style={{ padding: "10px 24px", cursor: "pointer", background: isActive ? "#F7F5F2" : "transparent", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", transition: "background 0.1s" }}>
                <div style={{ fontSize: 10, color: cat.color, fontFamily: "'Courier New', monospace", marginBottom: 3 }}>{cat.icon} {cat.label}</div>
                <div style={{ fontSize: 13, color: isActive ? "#1A1A1A" : "#888", lineHeight: 1.5 }}>{idea.text.slice(0, 52)}{idea.text.length > 52 ? "..." : ""}</div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #F2F0EC" }}>
          <div style={{ fontSize: 10, color: "#C8C4BC", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 8 }}>CANON ACTIVE</div>
          {activeCanonCount === 0
            ? <div style={{ fontSize: 12, color: "#C8C4BC", fontStyle: "italic" }}>No documents yet</div>
            : canonDocs.filter(d => d.is_active).slice(0, 3).map(d => (
              <div key={d.id} style={{ fontSize: 12, color: "#1A9E5A", marginBottom: 5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span>◈</span><span>{d.title.slice(0, 24)}{d.title.length > 24 ? "..." : ""}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── CENTER COLUMN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Center top bar */}
        <div style={{ padding: "16px 40px", borderBottom: "1px solid #ECEAE6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>
            {activeView === "capture" && "CAPTURE"}
            {activeView === "library" && `LIBRARY — ${filteredIdeas.length} IDEAS`}
            {activeView === "canon" && "CANON MANAGER"}
            {activeView === "deliverables" && `DELIVERABLES — ${pendingCount} PENDING`}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {activeView === "library" && (
              <>
                <button onClick={() => setFilterCat(null)} style={{ background: !filterCat ? "#1A1A1A" : "transparent", color: !filterCat ? "#FFF" : "#C0BDB6", border: "1px solid #E0DBD4", padding: "4px 11px", fontSize: 10, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>ALL</button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)} title={cat.label}
                    style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? "#FFF" : "#C0BDB6", border: `1px solid ${filterCat === cat.id ? cat.color : "#E0DBD4"}`, padding: "4px 9px", fontSize: 11, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>
                    {cat.icon}
                  </button>
                ))}
              </>
            )}
            {activeView === "canon" && (
              <button onClick={() => setShowUploadForm(!showUploadForm)}
                style={{ background: showUploadForm ? "transparent" : "#C9920A", color: showUploadForm ? "#AAA" : "#FFF", border: showUploadForm ? "1px solid #DDD" : "none", padding: "7px 18px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                {showUploadForm ? "CANCEL" : "+ ADD DOCUMENT"}
              </button>
            )}
          </div>
        </div>

        {/* Center body */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* CAPTURE */}
          {activeView === "capture" && (
            <div style={{ padding: "52px 56px", maxWidth: 700 }}>
              <div style={{ borderLeft: "3px solid #C9920A", paddingLeft: 22, marginBottom: 52 }}>
                <div style={{ fontSize: 11, color: "#C9920A", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>TODAY'S INVITATION</div>
                <div style={{ fontSize: 19, lineHeight: 1.9, color: "#AAA", fontStyle: "italic" }}>What are you afraid to write? That's probably the most important scene.</div>
              </div>

              <div style={{ fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 10 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
                placeholder="Don't edit. Don't qualify. Just send the signal." rows={5}
                style={{ width: "100%", background: "#FFFFFF", border: "1px solid #E0DBD4", color: "#1A1A1A", padding: "20px 22px", fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.85, resize: "vertical", outline: "none", boxSizing: "border-box", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
                onFocus={e => e.target.style.borderColor = "#C9920A"} onBlur={e => e.target.style.borderColor = "#E0DBD4"} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <span style={{ fontSize: 11, color: "#D0CCC6", fontFamily: "'Courier New', monospace" }}>⌘ + ENTER</span>
                <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()}
                  style={{ background: isAnalyzing || !input.trim() ? "#E8E4DF" : "#C9920A", color: isAnalyzing || !input.trim() ? "#AAA" : "#FFF", border: "none", padding: "12px 28px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing || !input.trim() ? "default" : "pointer", transition: "all 0.2s" }}>
                  {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
                </button>
              </div>

              <div style={{ marginTop: 72, display: "flex", gap: 64, paddingTop: 36, borderTop: "1px solid #ECEAE6" }}>
                {[{ label: "IDEAS CAPTURED", value: ideas.length }, { label: "PENDING WORK", value: pendingCount }, { label: "CANON DOCS", value: activeCanonCount }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 44, color: "#1A1A1A", fontStyle: "italic", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIBRARY */}
          {activeView === "library" && (
            <div style={{ display: "flex", height: "100%" }}>
              {/* List */}
              <div style={{ width: 320, borderRight: "1px solid #ECEAE6", overflowY: "auto", background: "#FAFAF8", flexShrink: 0 }}>
                {filteredIdeas.length === 0 && <div style={{ padding: 48, color: "#C8C4BC", fontStyle: "italic", fontSize: 15 }}>Nothing here yet.</div>}
                {filteredIdeas.map(idea => {
                  const cat = getCat(idea.category);
                  const isActive = activeIdea?.id === idea.id;
                  const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
                  return (
                    <div key={idea.id} onClick={() => setActiveIdea(idea)}
                      style={{ padding: "18px 22px", borderBottom: "1px solid #F2F0EC", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? "#FFFFFF" : "transparent", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 11, color: cat.color, fontFamily: "'Courier New', monospace" }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontSize: 11, color: "#C8C4BC", fontFamily: "'Courier New', monospace" }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}</span>
                      </div>
                      <div style={{ fontSize: 14, color: isActive ? "#1A1A1A" : "#777", lineHeight: 1.65 }}>{idea.text.slice(0, 100)}{idea.text.length > 100 ? "..." : ""}</div>
                      {idea.signal_strength >= 4 && <div style={{ marginTop: 6, fontSize: 10, color: "#C9920A", fontFamily: "'Courier New', monospace" }}>HIGH SIGNAL</div>}
                    </div>
                  );
                })}
              </div>

              {/* Detail */}
              <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
                {activeIdea ? (
                  <div style={{ maxWidth: 580 }}>
                    <div style={{ fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em", marginBottom: 22 }}>
                      {new Date(activeIdea.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · via {activeIdea.source || "app"}
                    </div>

                    <div style={{ fontSize: 20, lineHeight: 1.85, color: "#1A1A1A", marginBottom: 40 }}>{activeIdea.text}</div>

                    {activeIdea.ai_note && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>DRAMATURGICAL ANALYSIS</div>
                        <div style={{ background: "#FFFFFF", borderLeft: `3px solid ${getCat(activeIdea.category).color}`, padding: "18px 22px", fontSize: 16, color: "#555", lineHeight: 1.9, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>{activeIdea.ai_note}</div>
                      </div>
                    )}

                    {activeIdea.canon_resonance && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>CANON RESONANCE</div>
                        <div style={{ background: "#FFFFFF", borderLeft: "3px solid #1A9E5A", padding: "18px 22px", fontSize: 15, color: "#666", lineHeight: 1.9, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>{activeIdea.canon_resonance}</div>
                      </div>
                    )}

                    {activeIdea.dimensions?.length > 0 && (
                      <div style={{ marginBottom: 36 }}>
                        <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>OPERATING ON</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {activeIdea.dimensions.map((d, i) => (
                            <span key={i} style={{ background: "#FFFFFF", border: `1px solid ${getCat(activeIdea.category).color}50`, color: getCat(activeIdea.category).color, padding: "6px 14px", fontSize: 12, fontFamily: "'Courier New', monospace", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>{d.label}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {deliverables.filter(d => d.idea_id === activeIdea.id).length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>INVITATIONS TO ACTION</div>
                        {deliverables.filter(d => d.idea_id === activeIdea.id).map(d => (
                          <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                            style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: "1px solid #F2F0EC", cursor: "pointer", alignItems: "flex-start" }}>
                            <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${d.is_complete ? getCat(activeIdea.category).color : "#DDD"}`, background: d.is_complete ? getCat(activeIdea.category).color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#FFF", marginTop: 3, transition: "all 0.2s" }}>
                              {d.is_complete ? "✓" : ""}
                            </div>
                            <span style={{ fontSize: 15, color: d.is_complete ? "#C0BDB6" : "#444", textDecoration: d.is_complete ? "line-through" : "none", lineHeight: 1.75 }}>{d.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#D8D4CE", fontStyle: "italic", fontSize: 17 }}>Select an idea to read it</div>
                )}
              </div>
            </div>
          )}

          {/* CANON */}
          {activeView === "canon" && (
            <div style={{ padding: "40px 48px", maxWidth: 760 }}>
              {showUploadForm && (
                <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DF", padding: 36, marginBottom: 36, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#C9920A", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 24 }}>NEW CANON DOCUMENT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 8 }}>TITLE</div>
                      <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))} placeholder="e.g. CRISPR Series Bible"
                        style={{ width: "100%", background: "#FAFAF8", border: "1px solid #E0DBD4", color: "#1A1A1A", padding: "11px 14px", fontFamily: "Georgia, serif", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = "#C9920A"} onBlur={e => e.target.style.borderColor = "#E0DBD4"} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginBottom: 8 }}>DOCUMENT TYPE</div>
                      <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
                        style={{ width: "100%", background: "#FAFAF8", border: "1px solid #E0DBD4", color: "#1A1A1A", padding: "11px 14px", fontFamily: "'Courier New', monospace", fontSize: 12, outline: "none", boxSizing: "border-box" }}>
                        {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em" }}>CONTENT</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button onClick={() => fileInputRef.current?.click()}
                          style={{ background: "transparent", border: "1px solid #E0DBD4", color: "#AAA", padding: "5px 14px", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer" }}>
                          UPLOAD FILE (.txt, .md)
                        </button>
                        <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFileUpload} style={{ display: "none" }} />
                        {canonUpload.content && <span style={{ fontSize: 11, color: "#1A9E5A", fontFamily: "'Courier New', monospace" }}>✓ {canonUpload.content.length.toLocaleString()} chars</span>}
                      </div>
                    </div>
                    <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
                      placeholder="Paste document content here, or upload a file above..." rows={8}
                      style={{ width: "100%", background: "#FAFAF8", border: "1px solid #E0DBD4", color: "#1A1A1A", padding: "14px 16px", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.75, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "#C9920A"} onBlur={e => e.target.style.borderColor = "#E0DBD4"} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content}
                      style={{ background: isUploading || !canonUpload.title || !canonUpload.content ? "#E8E4DF" : "#C9920A", color: isUploading || !canonUpload.title || !canonUpload.content ? "#AAA" : "#FFF", border: "none", padding: "12px 28px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>
                      {isUploading ? "SAVING..." : "SAVE TO CANON →"}
                    </button>
                  </div>
                </div>
              )}

              {canonDocs.length === 0 && !showUploadForm && (
                <div style={{ textAlign: "center", padding: "100px 0" }}>
                  <div style={{ fontSize: 56, color: "#E8E4DF", marginBottom: 24 }}>◈</div>
                  <div style={{ fontSize: 18, color: "#BBB", fontStyle: "italic", marginBottom: 12 }}>No Canon documents yet.</div>
                  <div style={{ fontSize: 14, color: "#C8C4BC", lineHeight: 1.9 }}>Upload your series bible, character documents, and premise statements.<br />The AI will push every new idea against them.</div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {canonDocs.map(doc => (
                  <div key={doc.id} onClick={() => setActiveDoc(activeDoc?.id === doc.id ? null : doc)}
                    style={{ background: "#FFFFFF", border: "1px solid #ECEAE6", padding: "20px 24px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ fontSize: 22, color: doc.is_active ? "#1A9E5A" : "#DDD" }}>◈</span>
                        <div>
                          <div style={{ fontSize: 16, color: "#1A1A1A", marginBottom: 4 }}>{doc.title}</div>
                          <div style={{ fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace" }}>
                            {DOC_TYPES.find(t => t.id === doc.doc_type)?.label} · {doc.content?.length?.toLocaleString()} characters
                          </div>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleCanonDoc(doc.id, doc.is_active); }}
                        style={{ background: doc.is_active ? "#EBF7F2" : "#F7F5F2", color: doc.is_active ? "#1A9E5A" : "#AAA", border: `1px solid ${doc.is_active ? "#B0DEC8" : "#E0DBD4"}`, padding: "6px 16px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}>
                        {doc.is_active ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </div>
                    {activeDoc?.id === doc.id && (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #F2F0EC", fontSize: 14, color: "#888", lineHeight: 1.85, maxHeight: 240, overflowY: "auto" }}>
                        {doc.content?.slice(0, 1200)}{doc.content?.length > 1200 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELIVERABLES */}
          {activeView === "deliverables" && (
            <div style={{ padding: "40px 56px", maxWidth: 720 }}>
              <div style={{ marginBottom: 44, display: "flex", gap: 64 }}>
                {[{ label: "PENDING", value: pendingCount }, { label: "COMPLETED", value: deliverables.filter(d => d.is_complete).length }, { label: "TOTAL", value: deliverables.length }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 48, color: "#1A1A1A", fontStyle: "italic", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.12em", marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ height: 3, background: "#ECEAE6", marginBottom: 48, borderRadius: 2 }}>
                <div style={{ height: "100%", background: "#1A9E5A", width: `${(deliverables.filter(d => d.is_complete).length / Math.max(deliverables.length, 1)) * 100}%`, transition: "width 0.5s ease", borderRadius: 2 }} />
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
                        style={{ display: "flex", gap: 18, padding: "15px 0", borderBottom: "1px solid #F2F0EC", cursor: "pointer", alignItems: "flex-start" }}>
                        <div style={{ width: 20, height: 20, flexShrink: 0, border: `2px solid ${task.is_complete ? cat.color : "#DDD"}`, background: task.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#FFF", marginTop: 4, transition: "all 0.2s" }}>
                          {task.is_complete ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, color: task.is_complete ? "#C0BDB6" : "#333", textDecoration: task.is_complete ? "line-through" : "none", lineHeight: 1.75, marginBottom: 4 }}>{task.text}</div>
                          <div style={{ fontSize: 12, color: "#C0BDB6", fontStyle: "italic" }}>from: {task.idea?.text?.slice(0, 65)}...</div>
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
      <div style={{ width: 260, background: "#FFFFFF", borderLeft: "1px solid #ECEAE6", display: "flex", flexDirection: "column", flexShrink: 0, boxShadow: "-2px 0 8px rgba(0,0,0,0.03)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F2F0EC", fontSize: 11, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em" }}>SIGNAL STATUS</div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            {[
              { label: "Total Ideas", value: ideas.length, color: "#C9920A" },
              { label: "This Week", value: ideas.filter(i => Date.now() - new Date(i.created_at).getTime() < 7 * 86400000).length, color: "#1A78C2" },
              { label: "High Signal", value: ideas.filter(i => i.signal_strength >= 4).length, color: "#1A9E5A" },
              { label: "Via WhatsApp", value: ideas.filter(i => i.source === "whatsapp").length, color: "#8B2CC4" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F5F2EE" }}>
                <span style={{ fontSize: 14, color: "#888" }}>{s.label}</span>
                <span style={{ fontSize: 22, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 16 }}>BY CATEGORY</div>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: "#888" }}>{cat.label}</span>
                    <span style={{ fontSize: 13, color: cat.color, fontFamily: "'Courier New', monospace" }}>{count}</span>
                  </div>
                  <div style={{ height: 3, background: "#F2F0EC", borderRadius: 2 }}>
                    <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, borderRadius: 2, opacity: 0.6 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#C0BDB6", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 12 }}>CANON LAYER</div>
            {activeCanonCount === 0
              ? <div style={{ fontSize: 13, color: "#C8C4BC", lineHeight: 1.75, fontStyle: "italic" }}>No documents active. AI working without Canon context.</div>
              : <div style={{ fontSize: 13, color: "#777", lineHeight: 1.75 }}>{activeCanonCount} document{activeCanonCount !== 1 ? "s" : ""} conditioning all analysis.</div>
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#E0DBD4; border-radius:2px; }
        textarea::placeholder, input::placeholder { color:#C8C4BC; }
        select option { background:#FFF; color:#1A1A1A; }
      `}</style>
    </div>
  );
}
