import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ============================================
// CONFIGURATION
// Paste your new anon key below
// ============================================
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

const CREATIVE_PROMPTS = [
  "What would your protagonist do if they had 48 hours left?",
  "Name the one scene that makes everything else make sense.",
  "What does your antagonist want that they'd never admit?",
  "There's a piece of dialogue somewhere in your notes that holds the whole premise. Find it.",
  "What's the moment of no return in episode one?",
  "Which character is lying to themselves right now?",
  "What's the texture of the world — what does it smell like, sound like?",
  "What are you afraid to write? That's probably the most important scene.",
  "What does your series say about being human that nothing else says?",
  "Describe your protagonist in one contradiction.",
];

const PROJECT_TYPES = [
  { id: "film_series", label: "Film Series", icon: "◈" },
  { id: "feature", label: "Feature Film", icon: "◉" },
  { id: "album", label: "Album / Music", icon: "◎" },
  { id: "startup", label: "Startup / Product", icon: "◫" },
  { id: "other", label: "Other Project", icon: "◐" },
];

export default function SignalApp() {
  const [user, setUser] = useState(null);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    display_name: "", project_name: "", project_type: "film_series",
    premise_draft: "", protagonist_desc: "", central_tension: "",
  });
  const [ideas, setIdeas] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [input, setInput] = useState("");
  const [activeIdea, setActiveIdea] = useState(null);
  const [view, setView] = useState("capture");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCat, setFilterCat] = useState(null);
  const [notification, setNotification] = useState(null);
  const [dailyPrompt] = useState(CREATIVE_PROMPTS[Math.floor(Math.random() * CREATIVE_PROMPTS.length)]);
  const textareaRef = useRef(null);

  useEffect(() => {
    const savedUserId = localStorage.getItem("signal_user_id");
    if (savedUserId) loadUser(savedUserId);
    else { setOnboarding(true); setIsLoading(false); }
  }, []);

  const loadUser = async (userId) => {
    try {
      const { data } = await supabase.from("users").select("*").eq("id", userId).single();
      if (data) { setUser(data); await loadIdeas(userId); await loadDeliverables(userId); }
      else { setOnboarding(true); }
    } catch { setOnboarding(true); }
    finally { setIsLoading(false); }
  };

  const loadIdeas = async (userId) => {
    const { data } = await supabase
      .from("ideas")
      .select("*, dimensions(*), connections_a:connections!connections_idea_id_a_fkey(reason, idea_b:ideas!connections_idea_id_b_fkey(id, text, category)), connections_b:connections!connections_idea_id_b_fkey(reason, idea_a:ideas!connections_idea_id_a_fkey(id, text, category))")
      .eq("user_id", userId).eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (data) setIdeas(data.map(idea => ({
      ...idea,
      connections: [
        ...(idea.connections_a || []).map(c => ({ ...c, related: c.idea_b })),
        ...(idea.connections_b || []).map(c => ({ ...c, related: c.idea_a })),
      ]
    })));
  };

  const loadDeliverables = async (userId) => {
    const { data } = await supabase.from("deliverables").select("*, idea:ideas(text, category)").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setDeliverables(data);
  };

  const showNotification = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const completeOnboarding = async () => {
    try {
      const { data: newUser, error } = await supabase.from("users").insert([{
        display_name: onboardingData.display_name, project_name: onboardingData.project_name,
        project_type: onboardingData.project_type, onboarding_complete: true, onboarding_step: 4,
      }]).select().single();
      if (error) throw error;

      const canonParts = [
        onboardingData.premise_draft && `PREMISE: ${onboardingData.premise_draft}`,
        onboardingData.protagonist_desc && `PROTAGONIST: ${onboardingData.protagonist_desc}`,
        onboardingData.central_tension && `CENTRAL TENSION: ${onboardingData.central_tension}`,
      ].filter(Boolean).join("\n\n");

      if (canonParts) {
        await supabase.from("canon_documents").insert([{
          user_id: newUser.id, title: "Project Seed — Onboarding", doc_type: "premise", content: canonParts,
        }]);
      }

      localStorage.setItem("signal_user_id", newUser.id);
      setUser(newUser); setOnboarding(false);
      showNotification("Signal is live. Welcome.", "success");
    } catch { showNotification("Something went wrong. Try again.", "error"); }
  };

  const analyzeWithAI = async (text) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are a brilliant script editor and dramaturg. Analyze ideas across MULTIPLE dimensions simultaneously.
Respond ONLY with JSON (no markdown):
- category: one of [premise,character,scene,dialogue,arc,production,research,business]
- dimensions: array of 2-4 strings (multiple levels this idea operates on)
- aiNote: 1-2 sentences of genuine dramaturgical insight
- deliverables: array of 2-3 next steps as invitations not tasks
- inspirationQuestion: one question to capture why this felt important
- signalStrength: integer 1-5`,
          messages: [{ role: "user", content: `Project: ${user?.project_name || "Film Series"}\n\nIdea: "${text}"` }],
        }),
      });
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
    } catch {
      return { category: "premise", dimensions: ["story", "character"], aiNote: "This idea has layers worth exploring.", deliverables: ["Expand in 3 sentences", "Connect to your protagonist's arc"], inspirationQuestion: "What made this feel important?", signalStrength: 3 };
    } finally { setIsAnalyzing(false); }
  };

  const captureIdea = async () => {
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput("");
    showNotification("Analyzing your idea...", "processing");
    const analysis = await analyzeWithAI(text);

    const { data: saved, error } = await supabase.from("ideas").insert([{
      user_id: user.id, text, source: "app",
      category: analysis.category || "premise",
      ai_note: analysis.aiNote || "",
      inspiration_question: analysis.inspirationQuestion,
      signal_strength: analysis.signalStrength || 3,
    }]).select().single();

    if (error) { showNotification("Failed to save.", "error"); return; }

    if (analysis.dimensions?.length) {
      await supabase.from("dimensions").insert(analysis.dimensions.map(label => ({ idea_id: saved.id, label })));
    }
    if (analysis.deliverables?.length) {
      await supabase.from("deliverables").insert(analysis.deliverables.map(t => ({ idea_id: saved.id, user_id: user.id, text: t })));
    }

    await loadIdeas(user.id);
    await loadDeliverables(user.id);
    setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(l => ({ label: l })), connections: [] });
    setView("library");
    showNotification("Signal captured. The AI found something interesting.", "success");
  };

  const toggleDeliverable = async (id, current) => {
    await supabase.from("deliverables").update({ is_complete: !current, completed_at: !current ? new Date().toISOString() : null }).eq("id", id);
    await loadDeliverables(user.id);
  };

  const getCat = (catId) => CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
  const filteredIdeas = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
  const pendingCount = deliverables.filter(d => !d.is_complete).length;

  // ── LOADING ──
  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#333", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.2em" }}>LOADING SIGNAL...</div>
    </div>
  );

  // ── ONBOARDING ──
  if (onboarding) {
    const stepTitles = ["What do we call you?", "What are you building?", "Tell the AI about your project.", "You're ready."];
    const stepSubs = [
      "This is your workspace. Let's make it yours.",
      "Signal organizes itself around your project type.",
      "Three questions. Two minutes. This becomes your Canon seed.",
      "Every idea you capture will be permanent, analyzed, and connected by meaning.",
    ];
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F0EDE6", fontFamily: "'Georgia', serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 540, width: "100%" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 30, letterSpacing: "-0.04em", fontStyle: "italic", marginBottom: 8 }}>Signal</div>
            <div style={{ fontSize: 9, color: "#444", fontFamily: "'Courier New', monospace", letterSpacing: "0.2em", marginBottom: 10 }}>STEP {onboardingStep} OF 4</div>
            <div style={{ height: 1, background: "#1A1A1A" }}>
              <div style={{ height: "100%", background: "#E8C547", width: `${(onboardingStep / 4) * 100}%`, transition: "width 0.4s ease" }} />
            </div>
          </div>

          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{stepTitles[onboardingStep - 1]}</div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{stepSubs[onboardingStep - 1]}</div>
          </div>

          {onboardingStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[{ key: "display_name", label: "YOUR NAME", placeholder: "What do people call you?" }, { key: "project_name", label: "PROJECT NAME", placeholder: "What are you working on?" }].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 9, color: "#444", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 8 }}>{f.label}</div>
                  <input value={onboardingData[f.key]} onChange={e => setOnboardingData(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: "100%", background: "#111", border: "1px solid #2A2A2A", color: "#F0EDE6", padding: "13px 16px", fontFamily: "'Georgia', serif", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#2A2A2A"} />
                </div>
              ))}
            </div>
          )}

          {onboardingStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PROJECT_TYPES.map(pt => (
                <div key={pt.id} onClick={() => setOnboardingData(p => ({ ...p, project_type: pt.id }))} style={{ padding: "15px 20px", border: `1px solid ${onboardingData.project_type === pt.id ? "#E8C547" : "#222"}`, background: onboardingData.project_type === pt.id ? "#111" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                  <span style={{ color: onboardingData.project_type === pt.id ? "#E8C547" : "#333" }}>{pt.icon}</span>
                  <span style={{ fontSize: 14, color: onboardingData.project_type === pt.id ? "#F0EDE6" : "#555" }}>{pt.label}</span>
                </div>
              ))}
            </div>
          )}

          {onboardingStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                { key: "premise_draft", label: "WHAT IS YOUR PROJECT ABOUT?", placeholder: "One or two sentences. Don't overthink it." },
                { key: "protagonist_desc", label: "WHO IS YOUR PROTAGONIST?", placeholder: "Describe them in one contradiction." },
                { key: "central_tension", label: "WHAT IS THE CENTRAL TENSION?", placeholder: "What does your protagonist want vs. what do they need?" },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 9, color: "#444", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 8 }}>{f.label}</div>
                  <textarea value={onboardingData[f.key]} onChange={e => setOnboardingData(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={2}
                    style={{ width: "100%", background: "#111", border: "1px solid #2A2A2A", color: "#F0EDE6", padding: "13px 16px", fontFamily: "'Georgia', serif", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#2A2A2A"} />
                </div>
              ))}
            </div>
          )}

          {onboardingStep === 4 && (
            <div style={{ borderLeft: "2px solid #E8C547", paddingLeft: 24 }}>
              {["Your database is live.", "Your Canon seed is saved.", "Ideas captured here are permanent.", "The AI will connect them by meaning — not by folder."].map((line, i) => (
                <div key={i} style={{ fontSize: 15, color: "#777", lineHeight: 1.9 }}>{line}</div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 44 }}>
            {onboardingStep > 1
              ? <button onClick={() => setOnboardingStep(s => s - 1)} style={{ background: "transparent", border: "1px solid #222", color: "#444", padding: "10px 20px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>← BACK</button>
              : <div />}
            <button onClick={() => onboardingStep < 4 ? setOnboardingStep(s => s + 1) : completeOnboarding()}
              style={{ background: "#E8C547", color: "#0A0A0A", border: "none", padding: "12px 32px", fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.1em", cursor: "pointer" }}>
              {onboardingStep === 4 ? "ENTER SIGNAL →" : "CONTINUE →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN APP ──
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#F0EDE6", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" }}>

      {notification && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 100, background: notification.type === "success" ? "#47E8A0" : notification.type === "processing" ? "#E8C547" : notification.type === "error" ? "#E84747" : "#47B5E8", color: "#0A0A0A", padding: "10px 20px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.05em", animation: "fadeIn 0.3s ease" }}>
          {notification.msg}
        </div>
      )}

      <header style={{ borderBottom: "1px solid #1A1A1A", padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 24, letterSpacing: "-0.04em", fontStyle: "italic" }}>Signal</span>
          {user?.project_name && <span style={{ fontSize: 10, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>{user.project_name.toUpperCase()}</span>}
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[{ id: "capture", label: "Capture" }, { id: "library", label: `Library (${ideas.length})` }, { id: "deliverables", label: `Deliverables (${pendingCount})` }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} style={{ background: view === tab.id ? "#F0EDE6" : "transparent", color: view === tab.id ? "#0A0A0A" : "#555", border: `1px solid ${view === tab.id ? "#F0EDE6" : "#222"}`, padding: "6px 16px", fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.2s" }}>{tab.label}</button>
          ))}
        </nav>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {view === "capture" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <div style={{ maxWidth: 600, width: "100%", marginBottom: 52, borderLeft: "2px solid #E8C547", paddingLeft: 24 }}>
              <div style={{ fontSize: 9, color: "#E8C547", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
              <div style={{ fontSize: 18, lineHeight: 1.7, color: "#999", fontStyle: "italic" }}>{dailyPrompt}</div>
            </div>
            <div style={{ maxWidth: 600, width: "100%" }}>
              <div style={{ fontSize: 9, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }} placeholder="Don't edit. Don't qualify. Just send the signal."
                style={{ width: "100%", minHeight: 120, background: "#111", border: "1px solid #222", color: "#F0EDE6", padding: 18, fontFamily: "'Georgia', serif", fontSize: 16, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#E8C547"} onBlur={e => e.target.style.borderColor = "#222"} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontSize: 9, color: "#2A2A2A", fontFamily: "'Courier New', monospace" }}>⌘ + ENTER to capture</span>
                <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()} style={{ background: isAnalyzing ? "#111" : "#E8C547", color: "#0A0A0A", border: "none", padding: "11px 26px", fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
                  {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
                </button>
              </div>
            </div>
            <div style={{ maxWidth: 600, width: "100%", marginTop: 52, display: "flex", gap: 40 }}>
              {[{ label: "CAPTURED", value: ideas.length }, { label: "DELIVERABLES", value: deliverables.length }, { label: "COMPLETED", value: deliverables.filter(d => d.is_complete).length }].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 26, fontStyle: "italic" }}>{s.value}</div>
                  <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "library" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ width: 340, borderRight: "1px solid #1A1A1A", overflowY: "auto", padding: "18px 0" }}>
              <div style={{ padding: "0 18px 14px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                <button onClick={() => setFilterCat(null)} style={{ background: !filterCat ? "#F0EDE6" : "transparent", color: !filterCat ? "#0A0A0A" : "#444", border: `1px solid ${!filterCat ? "#F0EDE6" : "#222"}`, padding: "3px 10px", fontSize: 8, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em", cursor: "pointer" }}>ALL</button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)} style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? "#0A0A0A" : "#444", border: `1px solid ${filterCat === cat.id ? cat.color : "#222"}`, padding: "3px 10px", fontSize: 8, fontFamily: "'Courier New', monospace", cursor: "pointer" }}>{cat.icon} {cat.label.toUpperCase()}</button>
                ))}
              </div>

              {filteredIdeas.length === 0 && <div style={{ padding: "40px 18px", color: "#2A2A2A", fontStyle: "italic", fontSize: 13 }}>No ideas yet. Go capture something.</div>}

              {filteredIdeas.map(idea => {
                const cat = getCat(idea.category);
                const isActive = activeIdea?.id === idea.id;
                const daysAgo = Math.floor((Date.now() - new Date(idea.created_at).getTime()) / 86400000);
                return (
                  <div key={idea.id} onClick={() => setActiveIdea(idea)} style={{ padding: "13px 18px", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? "#0F0F0F" : "transparent", cursor: "pointer", borderBottom: "1px solid #0D0D0D", transition: "all 0.1s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 8, color: cat.color, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>{cat.icon} {cat.label.toUpperCase()}</span>
                      <span style={{ fontSize: 8, color: "#2A2A2A", fontFamily: "'Courier New', monospace" }}>{daysAgo === 0 ? "today" : `${daysAgo}d ago`}</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: isActive ? "#F0EDE6" : "#777" }}>{idea.text.length > 80 ? idea.text.slice(0, 80) + "..." : idea.text}</div>
                    {idea.dimensions?.length > 0 && (
                      <div style={{ marginTop: 5, display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {idea.dimensions.slice(0, 2).map((d, i) => <span key={i} style={{ fontSize: 7, color: "#333", border: "1px solid #1A1A1A", padding: "1px 5px", fontFamily: "'Courier New', monospace" }}>{d.label}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 36 }}>
              {activeIdea ? (
                <div style={{ maxWidth: 580 }}>
                  <div style={{ background: "#0D0D0D", borderLeft: `3px solid ${getCat(activeIdea.category).color}`, padding: "12px 16px", marginBottom: 24, fontStyle: "italic", fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                    {activeIdea.signal_strength >= 4 ? "High signal. This might be more important than it appears." : `Your subconscious filed this under ${getCat(activeIdea.category).label}. It might belong somewhere else too.`}
                  </div>

                  <div style={{ fontSize: 18, lineHeight: 1.7, color: "#F0EDE6", marginBottom: 26 }}>{activeIdea.text}</div>

                  {activeIdea.ai_note && (
                    <div style={{ marginBottom: 26 }}>
                      <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
                      <div style={{ background: "#0A0A0A", border: "1px solid #1A1A1A", padding: "13px 16px", fontSize: 12, color: "#777", lineHeight: 1.7 }}>{activeIdea.ai_note}</div>
                    </div>
                  )}

                  {activeIdea.dimensions?.length > 0 && (
                    <div style={{ marginBottom: 26 }}>
                      <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>THIS IDEA OPERATES ON</div>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {activeIdea.dimensions.map((d, i) => <span key={i} style={{ border: `1px solid ${getCat(activeIdea.category).color}`, color: getCat(activeIdea.category).color, padding: "4px 11px", fontSize: 10, fontFamily: "'Courier New', monospace" }}>{d.label}</span>)}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const ideaDels = deliverables.filter(d => d.idea_id === activeIdea.id);
                    return ideaDels.length > 0 ? (
                      <div style={{ marginBottom: 26 }}>
                        <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>INVITATIONS TO ACTION</div>
                        {ideaDels.map(d => (
                          <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 0", borderBottom: "1px solid #0D0D0D", cursor: "pointer" }}>
                            <div style={{ width: 15, height: 15, flexShrink: 0, border: `1px solid ${d.is_complete ? getCat(activeIdea.category).color : "#222"}`, background: d.is_complete ? getCat(activeIdea.category).color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#0A0A0A", marginTop: 3, transition: "all 0.2s" }}>
                              {d.is_complete ? "✓" : ""}
                            </div>
                            <span style={{ fontSize: 13, color: d.is_complete ? "#333" : "#C0BDB6", textDecoration: d.is_complete ? "line-through" : "none", lineHeight: 1.5 }}>{d.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {activeIdea.connections?.filter(c => c.related).length > 0 && (
                    <div>
                      <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 10 }}>CONNECTED SIGNALS</div>
                      {activeIdea.connections.filter(c => c.related).map((c, i) => (
                        <div key={i} onClick={() => { const r = ideas.find(id => id.id === c.related.id); if (r) setActiveIdea(r); }} style={{ padding: "9px 13px", background: "#0A0A0A", border: "1px solid #1A1A1A", marginBottom: 5, cursor: "pointer", fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                          <span style={{ color: getCat(c.related.category).color, marginRight: 7 }}>{getCat(c.related.category).icon}</span>
                          {c.related.text?.slice(0, 65)}...
                          {c.reason && <div style={{ fontSize: 9, color: "#333", marginTop: 3, fontStyle: "italic" }}>↳ {c.reason}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#1E1E1E", fontStyle: "italic" }}>Select an idea to examine it</div>
              )}
            </div>
          </div>
        )}

        {view === "deliverables" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 40 }}>
            <div style={{ maxWidth: 660 }}>
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 8, color: "#333", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", marginBottom: 8 }}>THE WORK AHEAD</div>
                <div style={{ fontSize: 26, fontStyle: "italic", marginBottom: 4 }}>{pendingCount} invitations waiting</div>
                <div style={{ fontSize: 11, color: "#333" }}>{deliverables.filter(d => d.is_complete).length} completed · {deliverables.length} total</div>
              </div>
              <div style={{ height: 1, background: "#1A1A1A", marginBottom: 40 }}>
                <div style={{ height: "100%", background: "#47E8A0", width: `${(deliverables.filter(d => d.is_complete).length / Math.max(deliverables.length, 1)) * 100}%`, transition: "width 0.5s ease" }} />
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
                      <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 0", borderBottom: "1px solid #0D0D0D", cursor: "pointer" }}>
                        <div style={{ width: 16, height: 16, flexShrink: 0, border: `1px solid ${task.is_complete ? cat.color : "#222"}`, background: task.is_complete ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#0A0A0A", marginTop: 2, transition: "all 0.2s" }}>
                          {task.is_complete ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: task.is_complete ? "#333" : "#C0BDB6", textDecoration: task.is_complete ? "line-through" : "none", lineHeight: 1.5, marginBottom: 2 }}>{task.text}</div>
                          <div style={{ fontSize: 9, color: "#2A2A2A", fontStyle: "italic" }}>from: {task.idea?.text?.slice(0, 50)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:2px; } ::-webkit-scrollbar-track { background:#0A0A0A; } ::-webkit-scrollbar-thumb { background:#1A1A1A; }
        textarea::placeholder, input::placeholder { color:#1E1E1E; }
      `}</style>
    </div>
  );
}
