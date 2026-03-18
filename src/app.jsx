import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://krhidwibweznwakaoxjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__QsWm6OyTnnGcBMxfMBX-Q_sX-asbi6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  bg:           "#1B1B1F",
  surface:      "#232328",
  surfaceHigh:  "#2C2C32",
  border:       "#3A3A42",
  borderSubtle: "#2F2F36",
  textPrimary:  "#E3E3E8",
  textSecondary:"#C4C4CC",
  textMuted:    "#8E8E96",
  textDisabled: "#4A4A52",
  gold:         "#E8C547",
  green:        "#6DD58C",
  red:          "#FF8A80",
  blue:         "#7ABCFF",
  purple:       "#CF9FFF",
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
  if (!term || term.length < 2 || !text || typeof text !== "string") return <>{text || ""}</>;
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
    return parts.length ? <>{parts}</> : <>{text}</>;
  } catch (e) { return <>{text}</>; }
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
  const [user,          setUser]          = useState(null);
  const [ideas,         setIdeas]         = useState([]);
  const [deliverables,  setDeliverables]  = useState([]);
  const [canonDocs,     setCanonDocs]     = useState([]);
  const [view,          setView]          = useState("dashboard");
  const [activeIdea,    setActiveIdea]    = useState(null);
  const [activeDoc,     setActiveDoc]     = useState(null);
  const [input,         setInput]         = useState("");
  const [context,       setContext]       = useState("");
  const [isAnalyzing,   setIsAnalyzing]   = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);
  const [notification,  setNotification]  = useState(null);
  const [filterCat,     setFilterCat]     = useState(null);
  const [showUpload,    setShowUpload]    = useState(false);
  const [canonUpload,   setCanonUpload]   = useState({ title: "", type: "reference", content: "" });
  const [isUploading,   setIsUploading]   = useState(false);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [uploadedName,  setUploadedName]  = useState("");
  const [studio,        setStudio]        = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioTab,     setStudioTab]     = useState("insight");
  const [auditing,      setAuditing]      = useState(false);
  const [replies,       setReplies]       = useState([]);
  const [composeDocs,   setComposeDocs]   = useState([]);
  const [activeCompose,  setActiveCompose] = useState(null);
  const [connections,   setConnections]   = useState([]);
  const [mapNodes,      setMapNodes]      = useState([]);
  const [hoveredNode,   setHoveredNode]   = useState(null);
  const [dragNode,      setDragNode]      = useState(null);
  const [dragOffset,    setDragOffset]    = useState({ x: 0, y: 0 });
  const [focusedNode,   setFocusedNode]   = useState(null);
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [localSearch,   setLocalSearch]   = useState("");
  const [searchHighlight, setSearchHighlight] = useState("");
  const [scrollToId,    setScrollToId]    = useState(null);
  const [mapFilter,     setMapFilter]     = useState("all");
  const [actionsView,   setActionsView]   = useState("focus");
  const [leftW,         setLeftW]         = useState(260);
  const [rightW,        setRightW]        = useState(290);
  const dragRef = useRef(null);
  const [centerView,    setCenterView]    = useState("capture");
  const [leftTab,       setLeftTab]       = useState("ideas");
  const [projects,      setProjects]      = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [newTaskText,   setNewTaskText]   = useState("");
  const [newTaskDue,    setNewTaskDue]    = useState("");
  const [taskAdding,    setTaskAdding]    = useState(false);

  const studioFired = useRef(false);
  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const composeContentRef = useRef(null);
  const composeTitleRef = useRef(null);
  const composeSaveTimer = useRef(null);
  const mapContainerRef = useRef(null);
  const globalSearchRef = useRef(null);
  const localSearchRef = useRef(null);
  const searchTimer = useRef(null);

  const [authUser, setAuthUser] = useState(null);
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardName, setOnboardName] = useState("");

  useEffect(() => {
    document.documentElement.lang = "en";
    const meta = document.createElement("meta");
    meta.name = "google";
    meta.content = "notranslate";
    document.head.appendChild(meta);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        initFromAuth(session.user);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
      } else {
        setAuthUser(null);
        setUser(null);
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── FIX: was using .single() which 406s when multiple user rows exist ──
  const initFromAuth = async (au) => {
    try {
      const { data: userRecords, error } = await supabase
        .from("users").select("id, display_name, project_name")
        .eq("auth_id", au.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (userRecords && userRecords.length > 0) {
        // Load the first (oldest) workspace
        await loadAll(userRecords[0].id);
      } else {
        // No workspaces — new user, show onboarding
        setOnboarding(true);
        setIsLoading(false);
      }
    } catch {
      setOnboarding(true);
      setIsLoading(false);
    }
  };

  const handleAuth = async (mode) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      let result;
      if (mode === "signup") {
        result = await supabase.auth.signUp({ email: authEmail, password: authPass });
        // If email confirmation is enabled in Supabase, handle it
        if (result.data?.user && !result.data.session) {
          setAuthError("Check your email to confirm your account, then log in.");
          setAuthLoading(false);
          return;
        }
      } else {
        result = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass });
      }
      if (result.error) throw result.error;
      if (result.data?.user) {
        setAuthUser(result.data.user);
        await initFromAuth(result.data.user);
      }
    } catch (e) {
      setAuthError(e.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!onboardName.trim() || !authUser) return;
    setAuthLoading(true);
    try {
      // Create user record
      const { data: newUser, error: ue } = await supabase.from("users").insert([{
        display_name: onboardName.trim(),
        project_name: onboardName.trim(),
        auth_id: authUser.id,
      }]).select().single();
      if (ue) throw ue;

      // Create first project
      const { error: pe } = await supabase.from("projects").insert([{
        user_id: newUser.id,
        name: onboardName.trim(),
      }]);
      if (pe) throw pe;

      setOnboarding(false);
      await loadAll(newUser.id);
    } catch (e) {
      setAuthError(e.message || "Failed to create account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthUser(null);
    setIdeas([]);
    setDeliverables([]);
    setCanonDocs([]);
    setProjects([]);
    setCurrentProject(null);
    setOnboarding(false);
    localStorage.removeItem("signal_user_id");
  };

  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]); // eslint-disable-line

  useEffect(() => {
    if (!ideas.length) return;
    const cx = 500, cy = 400;
    const nodes = ideas.map((idea, i) => {
      const angle = (i / ideas.length) * Math.PI * 2;
      const cat = getCat(idea.category);
      const connCount = connections.filter(c => c.idea_id_a === idea.id || c.idea_id_b === idea.id).length;
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
  }, [ideas.length, connections.length]); // eslint-disable-line

  const loadAll = async (uid, projId = null) => {
    try {
      // Load user + projects first
      const [{ data: u }, { data: projs }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("projects").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      ]);
      if (u) setUser(u);
      const projList = projs || [];
      setProjects(projList);

      // Determine active project
      let activeProj = projId ? projList.find(p => p.id === projId) : null;
      if (!activeProj && projList.length > 0) activeProj = projList[0];
      if (activeProj) setCurrentProject(activeProj);

      // Load data scoped to project
      const pid = activeProj?.id;
      let ideasQ = supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false });
      let delsQ = supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false });
      let canonQ = supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      if (pid) {
        ideasQ = ideasQ.eq("project_id", pid);
        delsQ = delsQ.eq("project_id", pid);
        canonQ = canonQ.eq("project_id", pid);
      }
      const [{ data: i }, { data: d }, { data: c }] = await Promise.all([ideasQ, delsQ, canonQ]);
      if (i) setIdeas(i);
      if (d) setDeliverables(d);
      if (c) setCanonDocs(c);
    } catch (e) { console.error("loadAll:", e); }
    finally { setIsLoading(false); }
    // Load replies separately — failure here won't break anything
    try {
      const { data: r } = await supabase.from("replies").select("*").eq("user_id", uid).order("created_at", { ascending: true });
      if (r) setReplies(r);
    } catch (e) { console.warn("Replies:", e); }
    try {
      const { data: cd } = await supabase.from("compose_documents").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
      if (cd) setComposeDocs(cd);
    } catch (e) { console.warn("Compose:", e); }
    try {
      const { data: cn } = await supabase.from("connections").select("*");
      if (cn) setConnections(cn);
    } catch (e) { console.warn("Connections:", e); }
  };

  const runStudio = async (ideasList, userObj) => {
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map((i, n) =>
        `#${n + 1} [${i.category}, signal ${i.signal_strength || "?"}] "${i.text}"`
      ).join("\n");
      const result = await callAI(
        `You are a senior creative collaborator — script editor, dramaturg, producer. Read every idea this creator has captured. Think, don't categorize. Notice what's there, what's missing, what keeps surfacing. Be direct and specific.

Respond ONLY in raw JSON:
{
  "provocation": "sharpest unresolved question this work raises. 2-3 sentences. Specific.",
  "pattern": "what the creator is actually working on beneath the surface.",
  "urgentIdea": "single idea most deserving development now, and one sentence why.",
  "blind_spot": "what this work isn't yet grappling with that it must.",
  "duplicates": "name ideas that are clearly the same thought and which articulation is strongest. null if none."
}`,
        `Project: ${userObj?.project_name || "Film Series"}\nTotal: ${ideasList.length}\n\nALL IDEAS:\n${allIdeas}`
      );
      setStudio(result);
    } catch (e) { console.error("Studio:", e); }
    finally { setStudioLoading(false); }
  };

  const auditLibrary = async () => {
    if (!ideas.length || !user || auditing) return;
    setAuditing(true);
    notify("Scanning library...", "processing");
    try {
      const validIds = new Set(ideas.map(i => i.id));
      const allIdeas = ideas.map(i => `ID:${i.id} [${i.category}] "${i.text}"`).join("\n");
      const result = await callAI(
        `You are auditing a creative idea library. This is a live database — every ID below is real and current right now.

Your job: identify ideas to DELETE. Be specific. Criteria:
1. TEST ENTRIES: anything clearly written to test the system, not a real creative idea
2. EXACT DUPLICATES: if two ideas say the same thing, delete the weaker version
3. FRAGMENTS: a short fragment fully contained within a longer, better idea

CRITICAL RULES:
- Only return IDs that appear EXACTLY in the list below. Do not invent IDs.
- If the library is already clean, return an empty toDelete array. Do NOT fabricate deletions.

Timestamp: ${Date.now()}

Return ONLY raw JSON:
{
  "toDelete": ["actual-uuid-from-list"],
  "reasons": ["short reason for each deletion in same order"]
}`,
        `CURRENT LIBRARY (${ideas.length} ideas):\n${allIdeas}`,
        1000
      );

      const toDelete = (result.toDelete || []).filter(id => validIds.has(id));

      if (toDelete.length > 0) {
        for (const id of toDelete) {
          await supabase.from("deliverables").delete().eq("idea_id", id);
          await supabase.from("dimensions").delete().eq("idea_id", id);
          await supabase.from("ideas").delete().eq("id", id);
        }
        studioFired.current = false;
        await loadAll(user.id);
        const reasons = result.reasons || [];
        const testCount = reasons.filter(r => /test|not a (real|actual)|for the platform/i.test(r)).length;
        const dupeCount = toDelete.length - testCount;
        const parts = [];
        if (testCount) parts.push(`${testCount} test ${testCount === 1 ? "entry" : "entries"}`);
        if (dupeCount) parts.push(`${dupeCount} ${dupeCount === 1 ? "duplicate" : "duplicates"}`);
        notify(`Cleaned: ${parts.join(" + ") || toDelete.length + " entries"}. ${ideas.length - toDelete.length} ideas remain.`, "success");
      } else {
        notify("Library is clean — nothing to remove.", "info");
      }
    } catch (e) { console.error("Audit:", e); notify("Audit failed.", "error"); }
    finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    const ctx  = (contextInputRef.current?.value || "").trim();
    if (!text || !user || isAnalyzing) return;
    if (captureInputRef.current) captureInputRef.current.value = "";
    if (contextInputRef.current) contextInputRef.current.value = "";
    setIsAnalyzing(true);
    notify("Analyzing...", "processing");
    try {
      const activeDocs   = canonDocs.filter(d => d.is_active);
      const canonContext = activeDocs.slice(0, 3).map(d => `[${d.title}]:\n${d.content.slice(0, 800)}`).join("\n\n");
      const existing     = ideas.slice(0, 20).map(i => `"${i.text.slice(0, 100)}"`).join("\n");
      const openInvites  = deliverables.filter(d => !d.is_complete).slice(0, 15).map(d => `"${d.text}"`).join("\n");

      const analysis = await callAI(
        `You are a world-class script editor on a specific creative project.

${canonContext ? `CANON:\n${canonContext}\n\n` : ""}EXISTING IDEAS — don't duplicate:
${existing || "None yet."}

OPEN INVITATIONS — don't overlap:
${openInvites || "None yet."}

${ctx ? `WHY THIS FELT IMPORTANT:\n"${ctx}"\n\n` : ""}Rules: if substantially same as existing idea, say so in aiNote and set signalStrength to 1. Max 2 invitations, only if genuinely new. signalStrength: 1=noise, 2=interesting, 3=strong, 4=urgent, 5=essential.

Raw JSON only:
{
  "category": "premise|character|scene|dialogue|arc|production|research|business",
  "dimensions": ["level 1","level 2"],
  "aiNote": "specific insight in context of everything captured",
  "invitations": [],
  "signalStrength": 3,
  "canonResonance": ""
}`,
        `Project: ${user.project_name}\n\nNew idea: "${text}"`,
        1200
      );

      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id: user.id, text, source: "app",
        category:             analysis.category      || "premise",
        ai_note:              analysis.aiNote         || "",
        inspiration_question: ctx                     || null,
        signal_strength:      analysis.signalStrength || 3,
        canon_resonance:      analysis.canonResonance || "",
        project_id:           currentProject?.id      || null,
      }]).select().single();

      if (error) { notify("Failed to save.", "error"); return; }

      if (analysis.dimensions?.length)
        await supabase.from("dimensions").insert(
          analysis.dimensions.map(label => ({ idea_id: saved.id, label }))
        );
      if (analysis.invitations?.length)
        await supabase.from("deliverables").insert(
          analysis.invitations.map(t => ({ idea_id: saved.id, user_id: user.id, text: t, project_id: currentProject?.id || null }))
        );

      await loadAll(user.id);
      setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(label => ({ label })) });
      setView("library");
      notify("Signal captured.", "success");
      studioFired.current = false;
      // Generate connections in background
      generateConnections(saved.id, text, user.id);
    } catch (e) { console.error("Capture:", e); notify("Analysis failed.", "error"); }
    finally { setIsAnalyzing(false); }
  };

  const generateConnections = async (newIdeaId, newIdeaText, userId) => {
    if (ideas.length < 1) return;
    try {
      const otherIdeas = ideas.filter(i => i.id !== newIdeaId).slice(0, 30);
      if (!otherIdeas.length) return;
      const ideaList = otherIdeas.map((i, n) => `${n}|${i.id}|${i.category}|${i.text.slice(0, 120)}`).join("\n");
      const result = await callAI(
        `You find meaningful connections between creative ideas in a project. Given a NEW idea and a list of EXISTING ideas, identify which existing ideas are meaningfully connected to the new one.

Connections can be: thematic resonance, character overlap, plot causality, tonal echo, contradiction worth exploring, shared imagery, one idea completes or challenges another.

Do NOT connect ideas just because they're in the same category. Only connect ideas that have a real creative relationship.

Return ONLY raw JSON:
{
  "connections": [
    { "index": 0, "relationship": "one sentence describing the creative connection", "strength": 3 }
  ]
}

strength: 1=faint echo, 2=interesting parallel, 3=strong connection, 4=these ideas need each other, 5=same nerve

If no meaningful connections exist, return {"connections": []}`,
        `NEW IDEA: "${newIdeaText}"\n\nEXISTING IDEAS (index|id|category|text):\n${ideaList}`,
        800
      );
      const newConns = (result.connections || [])
        .filter(c => c.index >= 0 && c.index < otherIdeas.length && c.strength >= 2)
        .map(c => ({
          idea_id_a: newIdeaId,
          idea_id_b: otherIdeas[c.index].id,
          reason: c.relationship,
          strength: c.strength,
        }));
      if (newConns.length > 0) {
        await supabase.from("connections").insert(newConns);
        setConnections(prev => [...prev, ...newConns]);
      }
    } catch (e) { console.warn("Connection generation:", e); }
  };

  const addReply = async (ideaId, section, text) => {
    if (!text.trim() || !user) return false;
    try {
      const { data, error } = await supabase.from("replies").insert([{
        user_id: user.id, idea_id: ideaId || null,
        target_section: ideaId ? section : `studio_${section}`,
        content: text.trim(),
      }]).select().single();
      if (error) throw error;
      setReplies(prev => [...prev, data]);
      notify("Response saved.", "success");
      return true;
    } catch (e) { console.error("Reply:", e); notify("Failed to save.", "error"); return false; }
  };

  const ReplyBox = ({ ideaId, section, compact }) => {
    const [draft, setDraft] = useState("");
    const existing = replies.filter(r =>
      ideaId ? (r.idea_id === ideaId && r.target_section === section)
             : (!r.idea_id && r.target_section === `studio_${section}`)
    );
    const send = async () => {
      if (await addReply(ideaId, section, draft)) setDraft("");
    };
    return (
      <div style={{ marginTop: 10 }}>
        {existing.map(r => (
          <div key={r.id} style={{ padding: "10px 14px", background: C.bg, borderLeft: `3px solid ${C.blue}`, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: C.blue, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 4 }}>
              YOU · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <div style={{ fontSize: compact ? 12 : 14, color: C.textPrimary, lineHeight: 1.65 }}>{r.content}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && draft.trim()) send(); }}
            placeholder="Respond..."
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: compact ? "7px 10px" : "9px 12px", fontFamily: sans, fontSize: compact ? 12 : 13, outline: "none" }}
          />
          {draft.trim() && (
            <button onClick={send}
              style={{ background: C.blue, border: "none", color: C.bg, padding: "7px 12px", fontFamily: mono, fontSize: 10, cursor: "pointer", flexShrink: 0 }}>
              ↵
            </button>
          )}
        </div>
      </div>
    );
  };

  const processFile = async (file) => {
    if (!file || isProcessing) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    setIsProcessing(true);
    setUploadedName("");
    setCanonUpload(p => ({ ...p, content: "" }));
    notify("Reading file...", "processing");
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let extractedText = "";

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let data = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch("/api/parse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: base64, filename: file.name }),
          });
          data = await res.json();
          if (res.ok && data.text) break;
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
        } catch (fetchErr) {
          if (attempt === 3) throw fetchErr;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (!data?.text) throw new Error(data?.error || "Failed to parse file.");
      extractedText = data.text;

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error("File appears empty or could not be read.");
      }

      setCanonUpload(p => ({ ...p, content: extractedText.trim(), title: p.title || name }));
      setUploadedName(file.name);
      notify("File loaded — check the preview below before saving.", "success");
    } catch (err) {
      console.error("File read error:", err);
      notify("Could not read file. Try pasting the text instead.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadCanon = async () => {
    if (!canonUpload.title || !canonUpload.content || !user) return;
    setIsUploading(true);
    try {
      const { data, error } = await supabase.from("canon_documents").insert([{
        user_id: user.id, title: canonUpload.title,
        doc_type: canonUpload.type, content: canonUpload.content, is_active: true,
        project_id: currentProject?.id || null,
      }]).select().single();
      if (error) throw error;
      setCanonDocs(prev => [data, ...prev]);
      setCanonUpload({ title: "", type: "reference", content: "" });
      setUploadedName("");
      setShowUpload(false);
      notify("Added to Canon.", "success");
    } catch { notify("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const deleteIdea = async (id) => {
    if (!confirm("Delete this idea? This also removes its deliverables and connections.")) return;
    try {
      await supabase.from("connections").delete().or(`idea_id_a.eq.${id},idea_id_b.eq.${id}`);
      await supabase.from("deliverables").delete().eq("idea_id", id);
      await supabase.from("dimensions").delete().eq("idea_id", id);
      await supabase.from("replies").delete().eq("idea_id", id);
      await supabase.from("whatsapp_messages").delete().eq("idea_id", id);
      const { error } = await supabase.from("ideas").delete().eq("id", id);
      if (error) throw error;
      setIdeas(prev => prev.filter(i => i.id !== id));
      setDeliverables(prev => prev.filter(d => d.idea_id !== id));
      setConnections(prev => prev.filter(c => c.idea_id_a !== id && c.idea_id_b !== id));
      if (activeIdea?.id === id) setActiveIdea(null);
      notify("Idea deleted.", "success");
    } catch (e) { console.error("Delete idea:", e); notify("Delete failed.", "error"); }
  };

  const toggleDeliverable = async (id, current) => {
    await supabase.from("deliverables")
      .update({ is_complete: !current, completed_at: !current ? new Date().toISOString() : null })
      .eq("id", id);
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
    notify("Removed from Canon.", "info");
  };

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const navGo = (v, idea = null) => {
    setView(v);
    setLocalSearch("");
    if (localSearchRef.current) localSearchRef.current.value = "";
    if (idea) { setActiveIdea(idea); }
    else if (v !== "library" && v !== "canon" && v !== "compose" && v !== "tasks") { setActiveIdea(null); setActiveDoc(null); }
  };

  // Drag-to-resize gutters
  const startDrag = (side) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === "left" ? leftW : rightW;
    const onMove = (ev) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const newW = Math.max(180, Math.min(450, startW + delta));
      if (side === "left") setLeftW(newW); else setRightW(newW);
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Auto-select first item when entering list views with nothing selected
  useEffect(() => {
    if (view === "library" && !activeIdea && ideas.length) setActiveIdea(ideas[0]);
    if (view === "canon" && !activeDoc && canonDocs.length) setActiveDoc(canonDocs[0]);
    if (view === "compose" && !activeCompose && composeDocs.length) setActiveCompose(composeDocs[0]);
  }, [view, ideas.length, canonDocs.length, composeDocs.length]);

  const searchAll = (q) => {
    if (!q || q.length < 2) return [];
    try {
      const term = q.toLowerCase();
      const results = [];
      const inTab = view;
      const searchIdeas = (inTab === "dashboard" || inTab === "capture" || inTab === "connections" || inTab === "library");
      const searchCanon = (inTab === "dashboard" || inTab === "capture" || inTab === "connections" || inTab === "canon");
      const searchCompose = (inTab === "dashboard" || inTab === "capture" || inTab === "connections" || inTab === "compose");
      const searchDeliverables = (inTab === "dashboard" || inTab === "capture" || inTab === "connections" || inTab === "deliverables");
      if (searchIdeas) ideas.forEach(i => {
        if (i.text.toLowerCase().includes(term) || (i.ai_note || "").toLowerCase().includes(term))
          results.push({ type: "idea", item: i, label: i.text.slice(0, 80), sub: getCat(i.category).label, color: getCat(i.category).color });
      });
      if (searchCanon) canonDocs.forEach(d => {
        if (d.title.toLowerCase().includes(term) || (d.content || "").slice(0, 5000).toLowerCase().includes(term))
          results.push({ type: "canon", item: d, label: d.title, sub: "Canon", color: C.green });
      });
      if (searchCompose) composeDocs.forEach(d => {
        if ((d.title || "").toLowerCase().includes(term) || (d.content || "").slice(0, 5000).toLowerCase().includes(term))
          results.push({ type: "compose", item: d, label: d.title || "Untitled", sub: "Compose", color: C.blue });
      });
      if (searchDeliverables) deliverables.forEach(d => {
        if (d.text.toLowerCase().includes(term))
          results.push({ type: "deliverable", item: d, label: d.text.slice(0, 80), sub: d.is_complete ? "Complete" : "Open", color: C.red });
      });
      return results.slice(0, 15);
    } catch (e) { console.warn("Search error:", e); return []; }
  };

  const globalResults = searchAll(globalSearch);

  const switchProject = async (projId) => {
    const proj = projects.find(p => p.id === projId);
    if (proj && user) {
      setCurrentProject(proj);
      setIsLoading(true);
      await loadAll(user.id, proj.id);
    }
  };

  const addTask = async () => {
    const text = newTaskText.trim();
    if (!text || !user || taskAdding) return;
    setTaskAdding(true);
    const insertData = { user_id: user.id, text, type: "task", priority: 2, project_id: currentProject?.id || null };
    if (newTaskDue && /^\d{4}-\d{2}-\d{2}$/.test(newTaskDue)) insertData.due_date = newTaskDue;
    await supabase.from("deliverables").insert([insertData]);
    setNewTaskText("");
    setNewTaskDue("");
    setTaskAdding(false);
    await loadAll(user.id, currentProject?.id);
  };

  const deleteTask = async (id) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("deliverables").delete().eq("id", id);
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  const pending     = deliverables.filter(d => !d.is_complete && d.type !== "task");
  const activeCanon = canonDocs.filter(d => d.is_active);
  const filtered    = (() => {
    let f = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
    if (localSearch && localSearch.length >= 2) {
      const term = localSearch.toLowerCase();
      f = f.filter(i => i.text.toLowerCase().includes(term) || (i.ai_note || "").toLowerCase().includes(term));
    }
    return f;
  })();
  const mono        = "'Roboto Mono', 'SF Mono', monospace";
  const sans        = "'Inter', system-ui, -apple-system, sans-serif";

  const inputBase = {
    width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
    color: C.textPrimary, padding: "11px 14px", fontFamily: sans,
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const SectionHead = ({ label, onClick }) => (
    <div onClick={onClick}
      style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", cursor: onClick ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 5, transition: "color 0.15s" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.color = C.gold)}
      onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
      {label}{onClick && <span style={{ fontSize: 9 }}>→</span>}
    </div>
  );

  if (isLoading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 22, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  if (!authUser) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 28, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em", marginBottom: 6 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>
            {authScreen === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
          </div>
        </div>
        <input
          type="email" placeholder="Email" value={authEmail}
          onChange={e => setAuthEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && authPass && handleAuth(authScreen)}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 14, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }}
        />
        <input
          type="password" placeholder="Password" value={authPass}
          onChange={e => setAuthPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && authEmail && handleAuth(authScreen)}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 14, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }}
        />
        {authError && (
          <div style={{ fontSize: 12, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>
        )}
        <button
          onClick={() => handleAuth(authScreen)}
          disabled={authLoading || !authEmail || !authPass}
          style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
          {authLoading ? "..." : authScreen === "login" ? "LOG IN →" : "SIGN UP →"}
        </button>
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => { setAuthScreen(authScreen === "login" ? "signup" : "login"); setAuthError(""); }}
            style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>
            {authScreen === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    </div>
  );

  if (onboarding) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 28, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em", marginBottom: 6 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>NAME YOUR PROJECT</div>
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.6 }}>
          What are you working on? This becomes your workspace.
        </div>
        <input
          type="text" placeholder="e.g. CRISPR, Untitled Pilot, The Descent..."
          value={onboardName}
          onChange={e => setOnboardName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onboardName.trim() && completeOnboarding()}
          autoFocus
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "14px 16px", fontSize: 15, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box", textAlign: "center" }}
        />
        {authError && (
          <div style={{ fontSize: 12, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>
        )}
        <button
          onClick={completeOnboarding}
          disabled={authLoading || !onboardName.trim()}
          style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
          {authLoading ? "CREATING..." : "START →"}
        </button>
      </div>
    </div>
  );

  if (!user) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 22, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  const DashboardView = () => (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "36px 44px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 20, color: C.textPrimary, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>{user.project_name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 36 }}>
        {[
          { label: "Ideas",       value: ideas.length,   color: C.gold,   sub: `${ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length} this week`, dest: "library" },
          { label: "Invitations", value: pending.length, color: C.red,    sub: `${deliverables.filter(d => d.is_complete && d.type !== "task").length} completed`, dest: "deliverables" },
          { label: "Tasks",       value: deliverables.filter(d => d.type === "task" && !d.is_complete).length, color: C.blue, sub: `${deliverables.filter(d => d.type === "task" && d.is_complete).length} done`, dest: "tasks" },
          { label: "Canon",       value: activeCanon.length, color: C.purple, sub: "active sources", dest: "canon" },
        ].map(s => (
          <div key={s.label} onClick={() => navGo(s.dest)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ fontSize: 28, color: s.color, fontWeight: 300, lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}` }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHead label="RECENT CAPTURES" onClick={() => navGo("library")} />
          <span onClick={() => navGo("library")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
        </div>
        {ideas.length === 0
          ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>No ideas yet.</div>
          : ideas.slice(0, 6).map((idea, idx) => {
              const cat = getCat(idea.category);
              const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
              return (
                <div key={idea.id} onClick={() => navGo("library", idea)}
                  style={{ padding: "13px 18px", borderBottom: idx < 5 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 12, color: cat.color, marginTop: 2, flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{idea.text}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, marginTop: 3 }}>
                      {cat.label} · {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                      {idea.signal_strength >= 4 && <span style={{ color: C.gold, marginLeft: 6 }}>◈</span>}
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>
      <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}` }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHead label="OPEN INVITATIONS" onClick={() => navGo("deliverables")} />
          <span onClick={() => navGo("deliverables")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
        </div>
        {pending.length === 0
          ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>All caught up.</div>
          : pending.slice(0, 5).map((task, idx, arr) => {
              const cat = getCat(task.idea?.category);
              return (
                <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)}
                  style={{ padding: "13px 18px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 12 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{task.text}</div>
                    <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, marginTop: 3 }}>{cat.icon} {cat.label}</div>
                  </div>
                </div>
              );
            })
        }
      </div>
      {ideas.length > 0 && (
        <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <SectionHead label="SIGNAL DISTRIBUTION" onClick={() => navGo("library")} />
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 1, margin: "12px 0" }}>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return <div key={cat.id} title={`${cat.label}: ${count}`} style={{ flex: count, background: cat.color, opacity: 0.85 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <span key={cat.id} onClick={() => { setFilterCat(cat.id); navGo("library"); }}
                style={{ fontSize: 11, color: C.textMuted, cursor: "pointer", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = cat.color}
                onMouseLeave={e => e.currentTarget.style.color = C.textMuted}>
                <span style={{ color: cat.color }}>{cat.icon}</span> {cat.label} {ideas.filter(i => i.category === cat.id).length}
              </span>
            ))}
          </div>
        </div>
      )}
      {canonDocs.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionHead label="CANON LAYER" onClick={() => navGo("canon")} />
            <span onClick={() => navGo("canon")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>MANAGE →</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canonDocs.map(doc => (
              <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }}
                style={{ background: C.surfaceHigh, border: `1px solid ${doc.is_active ? C.green + "50" : C.border}`, padding: "10px 14px", display: "flex", gap: 8, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = doc.is_active ? C.green : C.textMuted}
                onMouseLeave={e => e.currentTarget.style.borderColor = doc.is_active ? C.green + "50" : C.border}>
                <span style={{ color: doc.is_active ? C.green : C.textDisabled }}>◈</span>
                <div>
                  <div style={{ fontSize: 13, color: doc.is_active ? C.textPrimary : C.textDisabled }}>{doc.title}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>{doc.is_active ? "active" : "inactive"}</div>
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
      <div style={{ maxWidth: 660 }}>
        <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
          <div style={{ fontSize: 19, lineHeight: 1.9, color: C.textMuted, fontStyle: "italic" }}>{todayInvitation}</div>
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>WHAT'S IN YOUR HEAD RIGHT NOW</div>
        <textarea ref={captureInputRef}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
          placeholder="Don't edit. Don't qualify. Just send the signal."
          rows={5}
          style={{ ...inputBase, fontSize: 16, lineHeight: 1.9, resize: "vertical", marginBottom: 16 }}
        />
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>
          WHY DOES THIS FEEL IMPORTANT? <span style={{ color: C.textDisabled }}>(optional)</span>
        </div>
        <input ref={contextInputRef}
          placeholder="e.g. it reframes the protagonist's entire moral logic..."
          style={{ ...inputBase, marginBottom: 24 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER</span>
          <button onClick={captureIdea} disabled={isAnalyzing}
            style={{ background: isAnalyzing ? C.surfaceHigh : C.gold, color: isAnalyzing ? C.textMuted : C.bg, border: "none", padding: "12px 32px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: isAnalyzing ? "default" : "pointer" }}>
            {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
          </button>
        </div>
        <div style={{ marginTop: 56, paddingTop: 32, borderTop: `1px solid ${C.border}`, display: "flex", gap: 48 }}>
          {[
            { l: "IDEAS CAPTURED",   v: ideas.length,       dest: "library"      },
            { l: "OPEN INVITATIONS", v: pending.length,     dest: "deliverables" },
            { l: "CANON DOCS",       v: activeCanon.length, dest: "canon"        },
          ].map(s => (
            <div key={s.l} onClick={() => navGo(s.dest)} style={{ cursor: "pointer" }}>
              <div style={{ fontSize: 44, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const LibraryView = () => {
    const displayIdea = activeIdea || filtered[0] || null;
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
        {!displayIdea
          ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>No ideas yet.</div>
            : (() => {
                const cat = getCat(displayIdea.category);
                const ideaDels = deliverables.filter(d => d.idea_id === displayIdea.id);
                return (
                  <div style={{ maxWidth: 640 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                      <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, letterSpacing: "0.1em" }}>{cat.icon} {cat.label.toUpperCase()}</span>
                      {displayIdea.signal_strength >= 4 && <span style={{ fontSize: 10, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px" }}>HIGH SIGNAL</span>}
                      {searchHighlight && <span onClick={() => setSearchHighlight("")} style={{ fontSize: 9, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px", cursor: "pointer" }}>✕ CLEAR HIGHLIGHT</span>}
                      <span style={{ flex: 1 }} />
                      <button onClick={() => deleteIdea(displayIdea.id)}
                        style={{ fontSize: 10, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4, opacity: 0.6 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                        DELETE
                      </button>
                      <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>
                        {new Date(displayIdea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.65, marginBottom: 28, fontFamily: sans }}><Highlight text={displayIdea.text} term={searchHighlight} /></div>
                    {displayIdea.inspiration_question && (
                      <div style={{ marginBottom: 32, padding: "16px 20px", background: C.surfaceHigh, borderLeft: `3px solid ${C.textMuted}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHY IT FELT IMPORTANT</div>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.65, fontStyle: "italic" }}><Highlight text={displayIdea.inspiration_question} term={searchHighlight} /></div>
                      </div>
                    )}
                    {displayIdea.ai_note && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
                        <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65 }}><Highlight text={displayIdea.ai_note} term={searchHighlight} /></div>
                        <ReplyBox ideaId={displayIdea.id} section="ai_note" />
                      </div>
                    )}
                    {displayIdea.canon_resonance && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: 10, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON RESONANCE</div>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.65 }}><Highlight text={displayIdea.canon_resonance} term={searchHighlight} /></div>
                        <ReplyBox ideaId={displayIdea.id} section="canon_resonance" />
                      </div>
                    )}
                    {displayIdea.dimensions?.length > 0 && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 12 }}>DIMENSIONS</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {displayIdea.dimensions.map((d, i) => (
                            <span key={i} style={{ fontSize: 12, color: C.textSecondary, border: `1px solid ${C.border}`, padding: "5px 14px", fontFamily: mono }}>{d.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ideaDels.length > 0 && (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 16 }}>INVITATIONS TO ACTION</div>
                        {ideaDels.map(d => (
                          <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                            style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <div style={{ width: 17, height: 17, border: `2px solid ${d.is_complete ? C.green : C.border}`, background: d.is_complete ? C.green + "25" : "transparent", flexShrink: 0, marginTop: 3 }} />
                            <div style={{ fontSize: 15, color: d.is_complete ? C.textDisabled : C.textSecondary, lineHeight: 1.75, textDecoration: d.is_complete ? "line-through" : "none" }}>{d.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
          }
        </div>
    );
  };

  const CanonView = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
      {showUpload && (
        <div style={{ maxWidth: 500, marginBottom: 32, padding: "20px 24px", background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))}
            placeholder="Document title"
            style={{ ...inputBase, marginBottom: 10, fontSize: 14 }} />
          <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
            style={{ ...inputBase, marginBottom: 10, fontSize: 14 }}>
            {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>UPLOAD FILE</div>
          <label style={{ display: "block", marginBottom: 10 }}>
            <input type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }} disabled={isProcessing}
              onChange={async (e) => { const file = e.target.files[0]; if (file) await processFile(file); e.target.value = ""; }} />
            <div style={{ background: isProcessing ? C.border : C.bg, border: `1px solid ${isProcessing ? C.gold : uploadedName ? C.green : C.border}`, color: isProcessing ? C.gold : uploadedName ? C.green : C.textSecondary, padding: "10px 14px", fontFamily: mono, fontSize: 11, cursor: isProcessing ? "default" : "pointer", borderRadius: 4 }}>
              {isProcessing ? "READING FILE..." : uploadedName ? `✓ ${uploadedName}` : "CHOOSE FILE →"}
            </div>
          </label>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 6, fontWeight: 500 }}>OR PASTE TEXT</div>
          <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
            placeholder="Paste document text here..." rows={5}
            style={{ ...inputBase, fontSize: 14, resize: "vertical", marginBottom: 8 }} />
          <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content}
            style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: sans, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
            {isUploading ? "SAVING..." : "ADD TO CANON →"}
          </button>
        </div>
      )}
      {!activeDoc
        ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>Select a document from the sidebar.</div>
        : (
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 18, color: C.textPrimary, fontWeight: 500 }}><Highlight text={activeDoc.title} term={searchHighlight} /></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggleCanon(activeDoc.id, activeDoc.is_active)}
                  style={{ fontSize: 10, color: activeDoc.is_active ? C.textMuted : C.green, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  {activeDoc.is_active ? "DEACTIVATE" : "ACTIVATE"}
                </button>
                <button onClick={() => deleteCanon(activeDoc.id)}
                  style={{ fontSize: 10, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", fontFamily: mono, cursor: "pointer", borderRadius: 4 }}>
                  DELETE
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 32 }}>{activeDoc.content?.length?.toLocaleString()} chars · {activeDoc.is_active ? "active" : "inactive"}</div>
            <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: sans }}><Highlight text={activeDoc.content} term={searchHighlight} /></div>
          </div>
        )
      }
    </div>
  );

  const DeliverablesView = () => {
    const completed = deliverables.filter(d => d.is_complete);
    const pct = deliverables.length ? Math.round((completed.length / deliverables.length) * 100) : 0;
    const byCategory = CATEGORIES.map(cat => ({ ...cat, items: pending.filter(d => d.idea?.category === cat.id) })).filter(cat => cat.items.length > 0);
    const next5 = pending.slice(0, 5);
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textSecondary }}>{pending.length} open · {completed.length} complete</span>
              <span style={{ fontSize: 13, color: C.gold, fontFamily: mono }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
              <div style={{ height: "100%", background: C.gold, width: `${pct}%`, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
            {[{ id: "focus", label: "Next Up" }, { id: "workshops", label: "Workshops" }, { id: "all", label: "All Open" }].map(t => (
              <button key={t.id} onClick={() => setActionsView(t.id)}
                style={{ background: actionsView === t.id ? C.gold + "20" : "transparent", border: `1px solid ${actionsView === t.id ? C.gold + "60" : C.border}`, color: actionsView === t.id ? C.gold : C.textMuted, padding: "5px 12px", fontSize: 11, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                {t.label}
              </button>
            ))}
          </div>

          {actionsView === "focus" && (
            <div>
              <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 12 }}>YOUR NEXT 5 ACTIONS</div>
              {next5.length === 0
                ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>All caught up.</div>
                : next5.map(d => {
                    const cat = getCat(d.idea?.category);
                    return (
                      <div key={d.id} id={`del-${d.id}`}
                        style={{ padding: "14px 16px", marginBottom: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, borderLeft: `3px solid ${cat.color}`, cursor: "pointer" }}
                        onClick={() => toggleDeliverable(d.id, d.is_complete)}
                        onMouseEnter={e => e.currentTarget.style.borderColor = cat.color}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                        <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6, marginBottom: 6 }}><Highlight text={d.text} term={searchHighlight} /></div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                          {d.idea?.text && <span style={{ fontSize: 9, color: C.textMuted, fontFamily: mono }}>· {d.idea.text.slice(0, 40)}...</span>}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {actionsView === "workshops" && (
            <div>
              {byCategory.map(cat => (
                <div key={cat.id} style={{ marginBottom: 28, padding: "16px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, borderTop: `3px solid ${cat.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label.toUpperCase()} WORKSHOP</span>
                    <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>{cat.items.length} tasks</span>
                  </div>
                  {cat.items.slice(0, 5).map(d => (
                    <div key={d.id} id={`del-${d.id}`}
                      onClick={() => toggleDeliverable(d.id, d.is_complete)}
                      style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}><Highlight text={d.text} term={searchHighlight} /></div>
                    </div>
                  ))}
                  {cat.items.length > 5 && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, marginTop: 8 }}>+{cat.items.length - 5} more</div>}
                </div>
              ))}
            </div>
          )}

          {actionsView === "all" && (
            pending.length === 0
              ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>All invitations complete.</div>
              : byCategory.map(cat => (
                  <div key={cat.id} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 10 }}>{cat.icon} {cat.label.toUpperCase()}</div>
                    {cat.items.map(d => (
                      <div key={d.id} id={`del-${d.id}`}
                        onClick={() => toggleDeliverable(d.id, d.is_complete)}
                        style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", background: scrollToId === d.id ? C.surfaceHigh : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                        onMouseLeave={e => scrollToId !== d.id && (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}><Highlight text={d.text} term={searchHighlight} /></div>
                          {d.idea?.text && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, marginTop: 4 }}>from: {d.idea.text.slice(0, 60)}...</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
          )}
        </div>
      </div>
    );
  };

  const TasksView = () => {
    const tasks = deliverables.filter(d => d.type === "task");
    const openTasks = tasks.filter(d => !d.is_complete);
    const doneTasks = tasks.filter(d => d.is_complete);
    const formatDue = (d) => {
      const date = new Date(d);
      const diff = Math.ceil((date.getTime() - Date.now()) / 864e5);
      if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: C.red };
      if (diff === 0) return { text: "today", color: C.gold };
      if (diff === 1) return { text: "tomorrow", color: C.gold };
      return { text: `in ${diff}d`, color: C.textMuted };
    };
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 48px" }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{ fontSize: 20, color: C.textPrimary, fontWeight: 500, marginBottom: 8 }}>Tasks</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 28 }}>Simple to-dos. No AI analysis.</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, marginBottom: 32 }}>
            <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newTaskText.trim()) addTask(); }}
              placeholder="What needs to get done?"
              style={{ width: "100%", background: "transparent", border: "none", color: C.textPrimary, fontSize: 15, outline: "none", marginBottom: 12, fontFamily: sans }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                placeholder="Due date (YYYY-MM-DD)"
                style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textPrimary, fontSize: 12, padding: "8px 12px", outline: "none", fontFamily: mono }} />
              <button onClick={addTask} disabled={!newTaskText.trim() || taskAdding}
                style={{ background: newTaskText.trim() ? C.gold : C.surfaceHigh, color: newTaskText.trim() ? C.bg : C.textMuted, border: "none", borderRadius: 4, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: newTaskText.trim() ? "pointer" : "default", fontFamily: sans }}>
                {taskAdding ? "..." : "Add"}
              </button>
            </div>
          </div>
          {openTasks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 500, marginBottom: 14 }}>OPEN ({openTasks.length})</div>
              {openTasks.map(t => {
                const due = t.due_date ? formatDue(t.due_date) : null;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, cursor: "pointer" }}>
                    <div onClick={() => toggleDeliverable(t.id, t.is_complete)}
                      style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.border}`, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }} onClick={() => toggleDeliverable(t.id, t.is_complete)}>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>{t.text}</div>
                      {due && <div style={{ fontSize: 10, color: due.color, marginTop: 6, fontFamily: mono }}>Due {due.text}</div>}
                    </div>
                    <div onClick={() => deleteTask(t.id)} style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}
                      onMouseEnter={e => e.currentTarget.style.color = C.red}
                      onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}>✕</div>
                  </div>
                );
              })}
            </div>
          )}
          {doneTasks.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", fontWeight: 500, marginBottom: 14 }}>DONE ({doneTasks.length})</div>
              {doneTasks.slice(0, 15).map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 6, opacity: 0.4, cursor: "pointer" }}>
                  <div onClick={() => toggleDeliverable(t.id, t.is_complete)}
                    style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${C.green}`, background: C.green + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.green, flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1, fontSize: 14, color: C.textDisabled, textDecoration: "line-through" }} onClick={() => toggleDeliverable(t.id, t.is_complete)}>{t.text}</div>
                  <div onClick={() => deleteTask(t.id)} style={{ fontSize: 10, color: C.textDisabled, cursor: "pointer", padding: "4px 8px" }}>✕</div>
                </div>
              ))}
            </div>
          )}
          {tasks.length === 0 && (
            <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No tasks yet. Add one above.</div>
          )}
        </div>
      </div>
    );
  };

  const createComposeDoc = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from("compose_documents").insert([{
        user_id: user.id, title: "Untitled", content: "",
      }]).select().single();
      if (error) throw error;
      setComposeDocs(prev => [data, ...prev]);
      setActiveCompose(data);
      notify("New document created.", "success");
    } catch (e) { console.error("Compose create:", e); notify("Failed to create.", "error"); }
  };

  const saveComposeDoc = async (id, updates) => {
    try {
      const { error } = await supabase.from("compose_documents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (activeCompose?.id === id) setActiveCompose(prev => ({ ...prev, ...updates }));
    } catch (e) { console.error("Compose save:", e); }
  };

  const deleteComposeDoc = async (id) => {
    await supabase.from("compose_documents").delete().eq("id", id);
    setComposeDocs(prev => prev.filter(d => d.id !== id));
    if (activeCompose?.id === id) setActiveCompose(null);
    notify("Document deleted.", "info");
  };

  const autoSaveCompose = (id) => {
    if (composeSaveTimer.current) clearTimeout(composeSaveTimer.current);
    composeSaveTimer.current = setTimeout(() => {
      const content = composeContentRef.current?.value || "";
      const title = composeTitleRef.current?.value || "Untitled";
      saveComposeDoc(id, { title, content });
    }, 1500);
  };

  const ComposeView = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {!activeCompose
        ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>Select or create a document.</div>
        : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "36px 48px", overflow: "hidden" }}>
            <input
              ref={composeTitleRef}
              key={activeCompose.id + "-title"}
              defaultValue={activeCompose.title}
              placeholder="Document title..."
              onChange={() => autoSaveCompose(activeCompose.id)}
              style={{ background: "transparent", border: "none", color: C.textPrimary, fontSize: 18, fontWeight: 500, outline: "none", marginBottom: 20, fontFamily: sans }}
            />
            <textarea
              ref={composeContentRef}
              key={activeCompose.id + "-content"}
              defaultValue={activeCompose.content}
              placeholder="Start writing, or paste content here..."
              onChange={() => autoSaveCompose(activeCompose.id)}
              style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "20px 24px", fontFamily: sans, fontSize: 15, lineHeight: 1.9, outline: "none", resize: "none", overflowY: "auto", borderRadius: 6 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>Auto-saves as you type</span>
              <button onClick={() => {
                const content = composeContentRef.current?.value || "";
                const title = composeTitleRef.current?.value || "Untitled";
                saveComposeDoc(activeCompose.id, { title, content });
                notify("Saved.", "success");
              }}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "6px 14px", fontFamily: mono, fontSize: 10, cursor: "pointer", borderRadius: 4 }}>
                SAVE NOW
              </button>
            </div>
          </div>
        )
      }
    </div>
  );

  const MindMapView = () => {

    const getNode = (id) => mapNodes.find(n => n.id === id);

    const handleMouseDown = (e, node) => {
      e.preventDefault();
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragNode(node.id);
      setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
    };

    const handleMouseMove = (e) => {
      if (!dragNode) return;
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      setMapNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x, y } : n));
    };

    const handleMouseUp = () => setDragNode(null);

    const nodeRadius = (node) => Math.max(6, 4 + node.signal * 2 + node.connCount);

    const filteredNodes = mapFilter === "all" ? mapNodes : mapNodes.filter(n => n.category === mapFilter);
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredConns = connections.filter(c =>
      filteredNodeIds.has(c.idea_id_a) && filteredNodeIds.has(c.idea_id_b)
    );

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{filteredNodes.length} ideas · {filteredConns.length} connections</span>
          <select value={mapFilter} onChange={e => { setMapFilter(e.target.value); setFocusedNode(null); }}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "4px 8px", fontSize: 11, fontFamily: sans, borderRadius: 4, outline: "none" }}>
            <option value="all">All Categories</option>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
            ))}
          </select>
          <button onClick={async () => {
            if (!user || ideas.length < 2) return;
            notify("Mapping connections...", "processing");
            for (const idea of ideas) {
              const existing = connections.filter(c => c.idea_id_a === idea.id || c.idea_id_b === idea.id);
              if (existing.length < 2) {
                await generateConnections(idea.id, idea.text, user.id);
              }
            }
            await loadAll(user.id);
            notify("Connections mapped.", "success");
          }}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "5px 12px", fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", borderRadius: 4, flexShrink: 0 }}>
            MAP ALL
          </button>
        </div>
        <div ref={mapContainerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={e => { if (e.target === mapContainerRef.current) setFocusedNode(null); }}
          style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg, cursor: dragNode ? "grabbing" : "default" }}>
          {focusedNode && (() => {
            const fi = ideas.find(i => i.id === focusedNode);
            const fc = connections.filter(c => c.idea_id_a === focusedNode || c.idea_id_b === focusedNode)
              .sort((a, b) => (b.strength || 3) - (a.strength || 3))
              .slice(0, 8);
            if (!fi) return null;
            const cat = getCat(fi.category);
            return (
              <div style={{ position: "absolute", top: 12, left: 16, zIndex: 50, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", maxWidth: 360, maxHeight: "80vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label.toUpperCase()}</span>
                  <span onClick={() => { setActiveIdea(fi); navGo("library"); }}
                    style={{ fontSize: 9, color: C.gold, fontFamily: mono, cursor: "pointer" }}>OPEN IN LIBRARY →</span>
                </div>
                <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5, marginBottom: 12 }}>{fi.text.slice(0, 120)}{fi.text.length > 120 ? "..." : ""}</div>
                {fc.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, marginBottom: 8 }}>TOP {fc.length} CONNECTION{fc.length > 1 ? "S" : ""}</div>
                    {fc.map((c, ci) => {
                      const otherId = c.idea_id_a === focusedNode ? c.idea_id_b : c.idea_id_a;
                      const other = ideas.find(i => i.id === otherId);
                      const otherCat = other ? getCat(other.category) : null;
                      return (
                        <div key={ci} style={{ padding: "8px 10px", marginBottom: 4, background: C.bg, borderRadius: 6, border: `1px solid ${C.borderSubtle}` }}>
                          {other && <div style={{ fontSize: 9, color: otherCat?.color || C.textMuted, fontFamily: mono, marginBottom: 3 }}>{otherCat?.icon} {other.text.slice(0, 50)}...</div>}
                          <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.45 }}>{(c.reason || "").slice(0, 100)}{(c.reason || "").length > 100 ? "..." : ""}</div>
                          {c.strength >= 4 && <div style={{ fontSize: 8, color: C.gold, fontFamily: mono, marginTop: 3 }}>◈ STRONG</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div onClick={() => setFocusedNode(null)}
                  style={{ marginTop: 10, fontSize: 9, color: C.textMuted, fontFamily: mono, cursor: "pointer", textAlign: "center" }}>✕ CLOSE</div>
              </div>
            );
          })()}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {filteredConns.map((conn, i) => {
              const a = getNode(conn.idea_id_a);
              const b = getNode(conn.idea_id_b);
              if (!a || !b) return null;
              const isHovered = hoveredNode && (conn.idea_id_a === hoveredNode || conn.idea_id_b === hoveredNode);
              const isFocusConn = focusedNode && (conn.idea_id_a === focusedNode || conn.idea_id_b === focusedNode);
              const hidden = focusedNode && !isFocusConn;
              return (
                <line key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isFocusConn ? C.gold : isHovered ? C.gold : C.border}
                  strokeWidth={isFocusConn ? 2 : isHovered ? 2 : Math.max(0.5, conn.strength * 0.4)}
                  opacity={hidden ? 0.03 : isFocusConn ? 0.9 : isHovered ? 0.9 : 0.3}
                />
              );
            })}
          </svg>
          {mapNodes.filter(n => filteredNodeIds.has(n.id)).map(node => {
            const r = nodeRadius(node);
            const isHovered = hoveredNode === node.id;
            const nodeConns = connections.filter(c => c.idea_id_a === node.id || c.idea_id_b === node.id);
            const isFocused = focusedNode === node.id;
            const isConnectedToFocus = focusedNode && nodeConns.some(c => c.idea_id_a === focusedNode || c.idea_id_b === focusedNode);
            const isFaded = focusedNode && !isFocused && !isConnectedToFocus;
            return (
              <div key={node.id}
                onMouseDown={e => handleMouseDown(e, node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => {
                  if (focusedNode === node.id) { setFocusedNode(null); }
                  else { setFocusedNode(node.id); }
                }}
                style={{
                  position: "absolute",
                  left: node.x - r,
                  top: node.y - r,
                  cursor: "pointer",
                  zIndex: isFocused ? 20 : isHovered ? 10 : 1,
                  opacity: isFaded ? 0.12 : 1,
                  transition: "opacity 0.3s",
                }}>
                <div style={{
                  width: r * 2,
                  height: r * 2,
                  borderRadius: "50%",
                  background: node.color + (isFocused ? "EE" : isHovered ? "CC" : "66"),
                  border: `2px solid ${isFocused ? C.gold : isHovered ? node.color : "transparent"}`,
                  transition: dragNode ? "none" : "border-color 0.15s, background 0.3s",
                }} />
                <div style={{
                  position: "absolute",
                  top: r * 2 + 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  maxWidth: isFocused || isConnectedToFocus ? 180 : 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: isFocused ? 11 : 9,
                  fontWeight: isFocused ? 500 : 400,
                  color: isFocused ? C.gold : isConnectedToFocus ? C.textPrimary : isHovered ? C.textPrimary : C.textMuted,
                  fontFamily: mono,
                  textAlign: "center",
                  pointerEvents: "none",
                  transition: "color 0.15s",
                }}>{node.text}</div>
                {isHovered && (
                  <div style={{
                    position: "absolute",
                    left: r * 2 + 10,
                    top: -10,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    padding: "12px 16px",
                    width: 280,
                    zIndex: 100,
                    pointerEvents: "none",
                  }}>
                    <div style={{ fontSize: 10, color: node.color, fontFamily: mono, marginBottom: 6 }}>{node.icon} {node.category.toUpperCase()}</div>
                    <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.6, marginBottom: nodeConns.length ? 10 : 0 }}>{node.fullText.slice(0, 120)}{node.fullText.length > 120 ? "..." : ""}</div>
                    {nodeConns.length > 0 && (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, marginBottom: 6 }}>{nodeConns.length} CONNECTION{nodeConns.length > 1 ? "S" : ""}</div>
                        {nodeConns.slice(0, 3).map((c, ci) => (
                          <div key={ci} style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, marginBottom: 4 }}>
                            → {c.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Studio panel content is now inline in the return JSX

  return (
    <div style={{ display: "flex", height: "100vh", background: "#131316", color: C.textPrimary, overflow: "hidden", padding: "8px", gap: 6 }}>
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, border: `1px solid ${notification.type === "success" ? C.green : notification.type === "error" ? C.red : C.border}`, color: C.textPrimary, padding: "10px 22px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", zIndex: 1000, borderRadius: 8 }}>
          {notification.msg}
        </div>
      )}

      {/* ─── LEFT COLUMN: Sources + Navigation ─── */}
      <div style={{ width: leftW, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ cursor: "pointer" }} onClick={() => navGo("dashboard")}>
              <div style={{ fontSize: 18, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em" }}>signal</div>
              <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginTop: 2 }}>{user.project_name?.toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={handleSignOut} style={{ background: "transparent", border: "none", color: C.textDisabled, fontSize: 10, cursor: "pointer", padding: 4, fontFamily: mono }} title="Sign out">⏻</button>
              <button onClick={() => setLeftW(prev => prev <= 60 ? 260 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer", padding: 4 }} title="Toggle panel">◧</button>
            </div>
          </div>
          {projects.length > 1 && (
            <select value={currentProject?.id || ""} onChange={e => switchProject(e.target.value)}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textSecondary, padding: "6px 8px", fontSize: 11, fontFamily: mono, outline: "none", borderRadius: 4, marginBottom: 10, cursor: "pointer" }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div style={{ position: "relative" }}>
            <input
              ref={globalSearchRef}
              placeholder={{ dashboard: "Search everything...", capture: "Search everything...", library: "Search ideas...", canon: "Search canon...", compose: "Search documents...", deliverables: "Search deliverables...", connections: "Search everything..." }[view] || "Search..."}
              onChange={e => {
                const val = e.target.value;
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => setGlobalSearch(val), 200);
              }}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "7px 12px 7px 28px", fontFamily: mono, fontSize: 10, outline: "none", borderRadius: 4 }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textDisabled }}>⌕</span>
            {globalSearch && globalResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderTop: "none", maxHeight: 320, overflowY: "auto", zIndex: 200, borderRadius: "0 0 4px 4px" }}>
                {globalResults.map((r, i) => (
                  <div key={i} onClick={() => {
                    const term = globalSearch;
                    setSearchHighlight(term);
                    if (r.type === "idea") { setActiveIdea(r.item); navGo("library"); }
                    else if (r.type === "canon") { setActiveDoc(r.item); navGo("canon"); }
                    else if (r.type === "compose") { setActiveCompose(r.item); navGo("compose"); }
                    else if (r.type === "deliverable") {
                      navGo("deliverables");
                      setScrollToId(r.item.id);
                      setTimeout(() => {
                        const el = document.getElementById(`del-${r.item.id}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        setTimeout(() => setScrollToId(null), 2000);
                      }, 100);
                    }
                    setGlobalSearch("");
                    if (globalSearchRef.current) globalSearchRef.current.value = "";
                  }}
                    style={{ padding: "8px 12px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", display: "flex", gap: 8, alignItems: "flex-start" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 8, color: r.color, fontFamily: mono, flexShrink: 0, marginTop: 3 }}>{r.sub.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.label} term={globalSearch} /></span>
                  </div>
                ))}
              </div>
            )}
            {globalSearch && globalResults.length === 0 && globalSearch.length >= 2 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderTop: "none", padding: "10px 12px", zIndex: 200 }}>
                <span style={{ fontSize: 11, color: C.textDisabled, fontStyle: "italic" }}>No results for "{globalSearch}"</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav pills */}
        <div style={{ padding: "12px 12px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            { id: "dashboard",    icon: "◉", label: "Overview" },
            { id: "capture",      icon: "◈", label: "Capture" },
            { id: "library",      icon: "▤", label: "Library" },
            { id: "canon",        icon: "◆", label: "Canon" },
            { id: "deliverables", icon: "☐", label: "Actions" },
            { id: "tasks",        icon: "✓", label: "Tasks" },
            { id: "compose",      icon: "✎", label: "Compose" },
            { id: "connections",  icon: "⬡", label: "Map" },
          ].map(item => (
            <button key={item.id} onClick={() => navGo(item.id)}
              style={{
                background: view === item.id ? C.gold + "20" : "transparent",
                border: `1px solid ${view === item.id ? C.gold + "60" : C.border}`,
                color: view === item.id ? C.gold : C.textMuted,
                padding: "5px 10px",
                fontSize: 9,
                fontFamily: mono,
                letterSpacing: "0.05em",
                cursor: "pointer",
                borderRadius: 4,
                transition: "all 0.15s",
              }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* Sources / Canon docs with checkmarks */}
        {(view === "library") ? (
          <>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
              <input
                ref={localSearchRef}
                placeholder="Search library..."
                onChange={e => setLocalSearch(e.target.value)}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "6px 10px", fontFamily: sans, fontSize: 12, outline: "none", borderRadius: 4 }}
              />
            </div>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setFilterCat(null)}
                style={{ background: !filterCat ? C.gold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.gold : C.border}`, padding: "3px 8px", fontSize: 10, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                ALL {ideas.length}
              </button>
              {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)}
                  style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "3px 8px", fontSize: 10, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 13 }}>Nothing here yet.</div>
                : filtered.map(idea => {
                    const cat = getCat(idea.category);
                    const displayIdea = activeIdea || filtered[0];
                    const isActive = displayIdea?.id === idea.id;
                    const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
                    return (
                      <div key={idea.id} onClick={() => { setActiveIdea(idea); setSearchHighlight(""); }}
                        style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}
                        onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                        onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
                          <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}{idea.signal_strength >= 4 ? " ◈" : ""}</span>
                        </div>
                        <div style={{ fontSize: 13, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Highlight text={idea.text} term={localSearch} /></div>
                        {idea.signal_strength >= 4 && <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginTop: 4 }}>◈ HIGH SIGNAL</div>}
                      </div>
                    );
                  })
              }
            </div>
          </>
        ) : (view === "canon") ? (
          <>
            <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => setShowUpload(!showUpload)}
                style={{ width: "100%", background: showUpload ? "transparent" : C.gold, color: showUpload ? C.textMuted : C.bg, border: showUpload ? `1px solid ${C.border}` : "none", padding: "8px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                {showUpload ? "CANCEL" : "+ ADD TO CANON"}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => setActiveDoc(doc)}
                  style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: activeDoc?.id === doc.id ? `3px solid ${C.green}` : "3px solid transparent", background: activeDoc?.id === doc.id ? C.surfaceHigh : "transparent" }}
                  onMouseEnter={e => activeDoc?.id !== doc.id && (e.currentTarget.style.background = C.surfaceHigh)}
                  onMouseLeave={e => activeDoc?.id !== doc.id && (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 11, color: doc.is_active ? C.green : C.textDisabled, flexShrink: 0 }}>{doc.is_active ? "✓" : "○"}</span>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                    <div style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{doc.type || "reference"}</div>
                  </div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 13 }}>No sources yet.</div>}
            </div>
          </>
        ) : (view === "compose") ? (
          <>
            <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={createComposeDoc}
                style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "8px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                + NEW DOCUMENT
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {composeDocs.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 13 }}>No documents yet.</div>
                : composeDocs.map(doc => (
                    <div key={doc.id} onClick={() => setActiveCompose(doc)}
                      style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", borderLeft: activeCompose?.id === doc.id ? `3px solid ${C.gold}` : "3px solid transparent", background: activeCompose?.id === doc.id ? C.surfaceHigh : "transparent" }}
                      onMouseEnter={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = C.surfaceHigh)}
                      onMouseLeave={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = "transparent")}>
                      <div style={{ fontSize: 13, color: activeCompose?.id === doc.id ? C.textPrimary : C.textSecondary, marginBottom: 3 }}>{doc.title || "Untitled"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>{doc.content?.length || 0} chars</span>
                        <button onClick={e => { e.stopPropagation(); deleteComposeDoc(doc.id); }}
                          style={{ fontSize: 9, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "2px 6px", fontFamily: mono, cursor: "pointer", borderRadius: 3 }}>
                          DEL
                        </button>
                      </div>
                    </div>
                  ))
              }
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "10px 10px 4px", fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>
              SOURCES · {activeCanon.length} active
            </div>
            <div style={{ overflowY: "auto", padding: "0 4px" }}>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }}
                  style={{ padding: "6px 10px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderRadius: 4, marginBottom: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 10, color: doc.is_active ? C.green : C.textDisabled, flexShrink: 0 }}>{doc.is_active ? "✓" : "○"}</span>
                  <div style={{ fontSize: 12, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.textDisabled, fontStyle: "italic" }}>No sources yet.</div>}

              <div style={{ padding: "14px 8px 4px", fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>
                RECENT IDEAS
              </div>
              {ideas.slice(0, 8).map(idea => {
                const cat = getCat(idea.category);
                const isActive = activeIdea?.id === idea.id;
                return (
                  <div key={idea.id} onClick={() => navGo("library", idea)}
                    style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, background: isActive ? C.surfaceHigh : "transparent", marginBottom: 1 }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontSize: 10, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</div>
                    <div style={{ fontSize: 12, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Left gutter - wide, centered in the gap */}
      <div onMouseDown={startDrag("left")} style={{ width: 4, cursor: "col-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 3, height: 40, borderRadius: 2, background: C.border, opacity: 0.4, transition: "opacity 0.15s, background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.background = C.border; }} />
      </div>

      {/* ─── CENTER COLUMN: Main Content ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg, borderRadius: 12 }}>
        <div style={{ padding: "10px 28px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>
            {{ dashboard: "OVERVIEW", capture: "CAPTURE", library: "LIBRARY", canon: "CANON", deliverables: "DELIVERABLES", tasks: "TASKS", compose: "COMPOSE", connections: "CONNECTIONS" }[view]}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{ideas.length} ideas</span>
            <span style={{ fontSize: 10, color: C.textDisabled }}>·</span>
            <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{pending.length} open</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "dashboard"    && DashboardView()}
          {view === "capture"      && CaptureView()}
          {view === "library"      && LibraryView()}
          {view === "canon"        && CanonView()}
          {view === "deliverables" && DeliverablesView()}
          {view === "tasks"        && TasksView()}
          {view === "compose"      && ComposeView()}
          {view === "connections"  && MindMapView()}
        </div>
      </div>

      {/* Right gutter - wide, centered in the gap */}
      <div onMouseDown={startDrag("right")} style={{ width: 4, cursor: "col-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 3, height: 40, borderRadius: 2, background: C.border, opacity: 0.4, transition: "opacity 0.15s, background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.background = C.border; }} />
      </div>

      {/* ─── RIGHT COLUMN: Studio + Tools ─── */}
      <div style={{ width: rightW, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ padding: "12px 14px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: C.textPrimary, fontWeight: 500 }}>Studio</span>
            <button onClick={() => setRightW(prev => prev <= 60 ? 290 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer", padding: 4 }} title="Toggle panel">◨</button>
          </div>

          {/* Tool cards grid — NotebookLM style */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { label: "Insight",      icon: "✦",  color: C.gold,   action: () => { if (!studio) runStudio(ideas, user); setStudioTab("insight"); } },
              { label: "Connections",   icon: "⬡",  color: C.blue,   action: () => navGo("connections") },
              { label: "Patterns",     icon: "◎",  color: C.purple, action: () => setStudioTab("patterns") },
              { label: "Audit",        icon: "⚑",  color: C.red,    action: () => { if (!auditing) auditLibrary(); } },
              { label: "Compose",      icon: "✎",  color: C.green,  action: () => navGo("compose") },
              { label: "Stats",        icon: "▦",  color: C.textMuted, action: () => setStudioTab("stats") },
              { label: "Pulse",        icon: "↯",  color: C.gold,      action: async () => {
                notify("Sending pulse...", "processing");
                try {
                  const r = await fetch("/api/pulse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "nudge" }) });
                  const d = await r.json();
                  if (d.sent) notify("Pulse sent to Telegram.", "success");
                  else notify("Pulse failed: " + (d.error || "unknown"), "error");
                } catch (e) { notify("Pulse failed.", "error"); }
              }},
            ].map(tool => (
              <button key={tool.label} onClick={tool.action}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = tool.color; e.currentTarget.style.background = tool.color + "10"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}>
                <span style={{ fontSize: 14, color: tool.color, flexShrink: 0 }}>{tool.icon}</span>
                <span style={{ fontSize: 11, color: C.textSecondary, flex: 1, textAlign: "left" }}>{tool.label}</span>
                <span style={{ fontSize: 10, color: C.textDisabled }}>›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Studio content tabs */}
        <div style={{ padding: "8px 14px 0", display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {[{ id: "insight", label: "Insight" }, { id: "patterns", label: "Patterns" }, { id: "stats", label: "Stats" }].map(t => (
            <button key={t.id} onClick={() => setStudioTab(t.id)}
              style={{ background: "transparent", border: "none", borderBottom: studioTab === t.id ? `2px solid ${C.gold}` : "2px solid transparent", color: studioTab === t.id ? C.textPrimary : C.textMuted, padding: "6px 12px 8px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {studioTab === "insight" && (
            studioLoading
              ? <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: C.gold, marginBottom: 8, animation: "pulse 1.5s infinite" }}>✦</div>
                  <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.8 }}>Analyzing your project...</div>
                  <div style={{ color: C.textDisabled, fontSize: 10, marginTop: 4 }}>This can take 10-15 seconds</div>
                </div>
              : studio ? (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 9, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>PROVOCATION</div>
                    <div style={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.provocation}</div>
                    <ReplyBox section="provocation" compact />
                  </div>
                  {studio.blind_spot && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 9, color: C.red, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>BLIND SPOT</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.75 }}>{studio.blind_spot}</div>
                      <ReplyBox section="blind_spot" compact />
                    </div>
                  )}
                  {studio.urgentIdea && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 9, color: C.green, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ACT ON THIS NOW</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.75, fontStyle: "italic" }}>{studio.urgentIdea}</div>
                      <ReplyBox section="urgent" compact />
                    </div>
                  )}
                  <button onClick={() => { studioFired.current = false; setStudio(null); runStudio(ideas, user); }}
                    style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "7px", fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", cursor: "pointer", marginTop: 4, borderRadius: 4 }}>
                    REFRESH ↻
                  </button>
                </div>
              ) : ideas.length < 2
                ? <div style={{ fontSize: 12, color: C.textDisabled, fontStyle: "italic", lineHeight: 1.8 }}>Capture a few ideas to activate the Studio.</div>
                : <button onClick={() => runStudio(ideas, user)}
                    style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 4 }}>
                    GENERATE INSIGHT →
                  </button>
          )}
          {studioTab === "patterns" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 6 }}>LIBRARY AUDIT</div>
                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>AI removes duplicates and test entries.</div>
                <button onClick={auditLibrary} disabled={auditing}
                  style={{ width: "100%", background: "transparent", border: `1px solid ${C.red}`, color: C.red, padding: "8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", cursor: auditing ? "default" : "pointer", opacity: auditing ? 0.5 : 1, borderRadius: 4 }}>
                  {auditing ? "AUDITING..." : "AUDIT + CLEAN LIBRARY"}
                </button>
              </div>
              {studio?.pattern && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 9, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHAT YOU KEEP CIRCLING</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.purple}`, paddingLeft: 10 }}>{studio.pattern}</div>
                </div>
              )}
              {studio?.duplicates && studio.duplicates !== "null" && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 9, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ON REPETITION</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.duplicates}</div>
                </div>
              )}
              {ideas.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>BY CATEGORY</div>
                  {CATEGORIES.map(cat => {
                    const count = ideas.filter(i => i.category === cat.id).length;
                    if (!count) return null;
                    return (
                      <div key={cat.id} onClick={() => { setFilterCat(cat.id); navGo("library"); }} style={{ marginBottom: 8, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: C.textSecondary }}>{cat.icon} {cat.label}</span>
                          <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{count}</span>
                        </div>
                        <div style={{ height: 2, background: C.border, borderRadius: 2 }}>
                          <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, borderRadius: 2, opacity: 0.8 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {studioTab === "stats" && (
            <div>
              {[
                { label: "Total Ideas",  value: ideas.length,   color: C.gold,   dest: "library"      },
                { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length, color: C.blue, dest: "library" },
                { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, dest: "library" },
                { label: "Via Telegram", value: ideas.filter(i => i.source === "whatsapp").length, color: C.purple, dest: "library" },
                { label: "Open Actions", value: pending.length, color: C.red,    dest: "deliverables" },
                { label: "Canon Docs",   value: activeCanon.length, color: C.green, dest: "canon"     },
              ].map(s => (
                <div key={s.label} onClick={() => navGo(s.dest)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 12, color: C.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 20, color: s.color, fontStyle: "italic" }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Roboto+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3A3A42; border-radius: 2px; }
        textarea::placeholder, input::placeholder { color: #4A4A52; }
        select option { background: #232328; color: #E3E3E8; }
        button { transition: opacity 0.15s; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      ` }} />
    </div>
  );
}
