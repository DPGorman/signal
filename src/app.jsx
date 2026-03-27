import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { C, CATEGORIES, getCat, mono, sans, callAI } from "./lib/constants";
import CalendarIntegration from "./components/CalendarIntegration";
import TaskTracker from "./components/TaskTracker";
import TodayFocus from "./components/TodayFocus";
import WorkTypeSetup from "./components/WorkTypeSetup";
import Highlight from "./components/Highlight";
import ReplyBox from "./components/ReplyBox";
import DashboardView from "./components/views/DashboardView";
import CaptureView from "./components/views/CaptureView";
import LibraryView from "./components/views/LibraryView";
import CanonView from "./components/views/CanonView";
import DeliverablesView from "./components/views/DeliverablesView";
import TasksView from "./components/views/TasksView";
import ComposeView from "./components/views/ComposeView";
import MindMapView from "./components/views/MindMapView";
import CalendarView from "./components/views/CalendarView";

export default function Signal() {
  // ── Core data ────────────────────────────────────────────────────────────
  const [user,         setUser]         = useState(null);
  const [ideas,        setIdeas]        = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [canonDocs,    setCanonDocs]    = useState([]);
  const [composeDocs,  setComposeDocs]  = useState([]);
  const [connections,  setConnections]  = useState([]);
  const [replies,      setReplies]      = useState([]);
  const [projects,     setProjects]     = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  // ── Navigation & selection ───────────────────────────────────────────────
  const [view,         setView]         = useState("dashboard");
  const [activeIdea,   setActiveIdea]   = useState(null);
  const [activeDoc,    setActiveDoc]    = useState(null);
  const [activeCompose, setActiveCompose] = useState(null);
  const [filterCat,    setFilterCat]    = useState(null);
  const [scrollToId,   setScrollToId]   = useState(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [notification, setNotification] = useState(null);
  const [leftW,        setLeftW]        = useState(260);
  const [rightW,       setRightW]       = useState(290);

  // ── Studio ───────────────────────────────────────────────────────────────
  const [studio,       setStudio]       = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioTab,    setStudioTab]    = useState("insight");
  const [auditing,     setAuditing]     = useState(false);

  // ── Search ───────────────────────────────────────────────────────────────
  const [globalSearch,    setGlobalSearch]    = useState("");
  const [localSearch,     setLocalSearch]     = useState("");
  const [searchHighlight, setSearchHighlight] = useState("");

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useState(null);
  const [authScreen,  setAuthScreen]  = useState("login");
  const [authEmail,   setAuthEmail]   = useState("");
  const [authPass,    setAuthPass]    = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [onboarding,  setOnboarding]  = useState(false);
  const [onboardName, setOnboardName] = useState("");

  // ── Calendar events (Google Calendar) ───────────────────────────────────
  const [calendarEvents, setCalendarEvents] = useState([]);

  // ── Work types ───────────────────────────────────────────────────────────
  const [workTypesConfigured, setWorkTypesConfigured] = useState(false);
  const [showWorkTypeSetup,   setShowWorkTypeSetup]   = useState(true);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const studioFired     = useRef(false);
  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const globalSearchRef = useRef(null);
  const localSearchRef  = useRef(null);
  const searchTimer     = useRef(null);

  // ── Derived state ────────────────────────────────────────────────────────
  const pending     = useMemo(() => deliverables.filter(d => !d.is_complete && d.type !== "task"), [deliverables]);
  const activeCanon = useMemo(() => canonDocs.filter(d => d.is_active), [canonDocs]);
  const filtered    = useMemo(() => {
    let f = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
    if (localSearch && localSearch.length >= 2) {
      const term = localSearch.toLowerCase();
      f = f.filter(i => i.text.toLowerCase().includes(term) || (i.ai_note || "").toLowerCase().includes(term));
    }
    return f;
  }, [ideas, filterCat, localSearch]);

  // ── Auth init ────────────────────────────────────────────────────────────
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
  }, []); // eslint-disable-line

  // ── Auto-run studio ──────────────────────────────────────────────────────
  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]); // eslint-disable-line

  // ── Auto-select first item when entering list views ──────────────────────
  useEffect(() => {
    if (view === "library" && !activeIdea && ideas.length) setActiveIdea(ideas[0]);
    if (view === "canon"   && !activeDoc   && canonDocs.length)  setActiveDoc(canonDocs[0]);
    if (view === "compose" && !activeCompose && composeDocs.length) setActiveCompose(composeDocs[0]);
  }, [view, ideas.length, canonDocs.length, composeDocs.length]); // eslint-disable-line

  // ── Data loading ─────────────────────────────────────────────────────────
  const initFromAuth = async (au) => {
    try {
      const { data: userRecords, error } = await supabase
        .from("users").select("id, display_name, project_name")
        .eq("auth_id", au.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (userRecords?.length > 0) {
        await loadAll(userRecords[0].id);
      } else {
        setOnboarding(true);
        setIsLoading(false);
      }
    } catch {
      setOnboarding(true);
      setIsLoading(false);
    }
  };

  const loadAll = useCallback(async (uid, projId = null) => {
    try {
      const [{ data: u }, { data: projs }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).single(),
        supabase.from("projects").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      ]);
      if (u) setUser(u);
      const projList = projs || [];
      setProjects(projList);

      let activeProj = projId ? projList.find(p => p.id === projId) : null;
      if (!activeProj && projList.length > 0) activeProj = projList[0];
      if (activeProj) setCurrentProject(activeProj);

      const pid = activeProj?.id;
      let ideasQ = supabase.from("ideas").select("*, dimensions(*)").eq("user_id", uid).order("created_at", { ascending: false });
      let delsQ  = supabase.from("deliverables").select("*, idea:ideas(text,category)").eq("user_id", uid).order("created_at", { ascending: false });
      let canonQ = supabase.from("canon_documents").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      if (pid) {
        ideasQ = ideasQ.eq("project_id", pid);
        delsQ  = delsQ.eq("project_id", pid);
        canonQ = canonQ.eq("project_id", pid);
      }
      const [{ data: i }, { data: d }, { data: c }] = await Promise.all([ideasQ, delsQ, canonQ]);
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
      const { data: cn } = await supabase.from("connections").select("*");
      if (cn) setConnections(cn);
    } catch (e) { console.warn("Connections:", e); }
  }, []);

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleAuth = async (mode) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      let result;
      if (mode === "signup") {
        result = await supabase.auth.signUp({ email: authEmail, password: authPass });
        if (result.data?.user && !result.data.session) {
          setAuthError("Check your email to confirm your account, then log in.");
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
      const { data: newUser, error: ue } = await supabase.from("users").insert([{
        display_name: onboardName.trim(),
        project_name: onboardName.trim(),
        auth_id: authUser.id,
      }]).select().single();
      if (ue) throw ue;
      const { error: pe } = await supabase.from("projects").insert([{ user_id: newUser.id, name: onboardName.trim() }]);
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

  // ── Studio / AI ──────────────────────────────────────────────────────────
  const runStudio = useCallback(async (ideasList, userObj) => {
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
  }, [studioLoading]);

  const auditLibrary = useCallback(async () => {
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
  }, [ideas, user, auditing, loadAll]);

  // ── Idea management ──────────────────────────────────────────────────────
  const generateConnections = useCallback(async (newIdeaId, newIdeaText) => {
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
  }, [ideas]);

  const captureIdea = useCallback(async () => {
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
      generateConnections(saved.id, text);
    } catch (e) { console.error("Capture:", e); notify("Analysis failed.", "error"); }
    finally { setIsAnalyzing(false); }
  }, [user, isAnalyzing, canonDocs, ideas, deliverables, currentProject, loadAll, generateConnections]);

  const deleteIdea = useCallback(async (id) => {
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
  }, [activeIdea]);

  // ── Deliverable / task management ────────────────────────────────────────
  const toggleDeliverable = useCallback(async (id, current) => {
    await supabase.from("deliverables")
      .update({ is_complete: !current, completed_at: !current ? new Date().toISOString() : null })
      .eq("id", id);
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, is_complete: !current } : d));
  }, []);

  const addTask = useCallback(async (text, due) => {
    if (!text || !user) return;
    const insertData = { user_id: user.id, text, type: "task", priority: 2, project_id: currentProject?.id || null };
    if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) insertData.due_date = due;
    await supabase.from("deliverables").insert([insertData]);
    await loadAll(user.id, currentProject?.id);
  }, [user, currentProject, loadAll]);

  const deleteTask = useCallback(async (id) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("deliverables").delete().eq("id", id);
    setDeliverables(prev => prev.filter(d => d.id !== id));
  }, []);

  // ── Canon management ─────────────────────────────────────────────────────
  const uploadCanon = useCallback(async (canonUpload) => {
    if (!canonUpload.title || !canonUpload.content || !user) return false;
    try {
      const { data, error } = await supabase.from("canon_documents").insert([{
        user_id: user.id, title: canonUpload.title,
        doc_type: canonUpload.type, content: canonUpload.content, is_active: true,
        project_id: currentProject?.id || null,
      }]).select().single();
      if (error) throw error;
      setCanonDocs(prev => [data, ...prev]);
      notify("Added to Canon.", "success");
      return true;
    } catch { notify("Upload failed.", "error"); return false; }
  }, [user, currentProject]);

  const toggleCanon = useCallback(async (id, current) => {
    await supabase.from("canon_documents").update({ is_active: !current }).eq("id", id);
    setCanonDocs(prev => prev.map(d => d.id === id ? { ...d, is_active: !current } : d));
  }, []);

  const deleteCanon = useCallback(async (id) => {
    await supabase.from("canon_documents").delete().eq("id", id);
    setCanonDocs(prev => prev.filter(d => d.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);
    notify("Removed from Canon.", "info");
  }, [activeDoc]);

  // ── Replies ──────────────────────────────────────────────────────────────
  const addReply = useCallback(async (ideaId, section, text) => {
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
  }, [user]);

  // ── Compose ──────────────────────────────────────────────────────────────
  const createComposeDoc = useCallback(async () => {
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
  }, [user]);

  const saveComposeDoc = useCallback(async (id, updates) => {
    try {
      const { error } = await supabase.from("compose_documents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setComposeDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (activeCompose?.id === id) setActiveCompose(prev => ({ ...prev, ...updates }));
    } catch (e) { console.error("Compose save:", e); }
  }, [activeCompose]);

  const deleteComposeDoc = useCallback(async (id) => {
    await supabase.from("compose_documents").delete().eq("id", id);
    setComposeDocs(prev => prev.filter(d => d.id !== id));
    if (activeCompose?.id === id) setActiveCompose(null);
    notify("Document deleted.", "info");
  }, [activeCompose]);

  // ── Navigation & UI utilities ────────────────────────────────────────────
  const notify = useCallback((msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const navGo = useCallback((v, idea = null) => {
    setView(v);
    setLocalSearch("");
    if (localSearchRef.current) localSearchRef.current.value = "";
    if (idea) {
      setActiveIdea(idea);
    } else if (!["library", "canon", "compose", "tasks"].includes(v)) {
      setActiveIdea(null);
      setActiveDoc(null);
    }
  }, []);

  const switchProject = useCallback(async (projId) => {
    const proj = projects.find(p => p.id === projId);
    if (proj && user) {
      setCurrentProject(proj);
      setIsLoading(true);
      await loadAll(user.id, proj.id);
    }
  }, [projects, user, loadAll]);

  const startDrag = (side) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === "left" ? leftW : rightW;
    const onMove = (ev) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const newW = Math.max(180, Math.min(450, startW + delta));
      if (side === "left") setLeftW(newW); else setRightW(newW);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const searchAll = useCallback((q) => {
    if (!q || q.length < 2) return [];
    try {
      const term = q.toLowerCase();
      const results = [];
      const inTab = view;
      const searchIdeas       = ["dashboard", "capture", "connections", "library"].includes(inTab);
      const searchCanon       = ["dashboard", "capture", "connections", "canon"].includes(inTab);
      const searchCompose     = ["dashboard", "capture", "connections", "compose"].includes(inTab);
      const searchDeliverables = ["dashboard", "capture", "connections", "deliverables"].includes(inTab);
      if (searchIdeas)       ideas.forEach(i => { if (i.text.toLowerCase().includes(term) || (i.ai_note || "").toLowerCase().includes(term)) results.push({ type: "idea", item: i, label: i.text.slice(0, 80), sub: getCat(i.category).label, color: getCat(i.category).color }); });
      if (searchCanon)       canonDocs.forEach(d => { if (d.title.toLowerCase().includes(term) || (d.content || "").slice(0, 5000).toLowerCase().includes(term)) results.push({ type: "canon", item: d, label: d.title, sub: "Canon", color: C.green }); });
      if (searchCompose)     composeDocs.forEach(d => { if ((d.title || "").toLowerCase().includes(term) || (d.content || "").slice(0, 5000).toLowerCase().includes(term)) results.push({ type: "compose", item: d, label: d.title || "Untitled", sub: "Compose", color: C.blue }); });
      if (searchDeliverables) deliverables.forEach(d => { if (d.text.toLowerCase().includes(term)) results.push({ type: "deliverable", item: d, label: d.text.slice(0, 80), sub: d.is_complete ? "Complete" : "Open", color: C.red }); });
      return results.slice(0, 15);
    } catch (e) { console.warn("Search error:", e); return []; }
  }, [view, ideas, canonDocs, composeDocs, deliverables]);

  const globalResults = useMemo(() => searchAll(globalSearch), [searchAll, globalSearch]);

  // ── Early returns ────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 23, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  if (!authUser) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 29, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em", marginBottom: 6 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>
            {authScreen === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
          </div>
        </div>
        <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && authPass && handleAuth(authScreen)}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 11, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }} />
        <input type="password" placeholder="Password" value={authPass} onChange={e => setAuthPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && authEmail && handleAuth(authScreen)}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 11, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }} />
        {authError && <div style={{ fontSize: 11, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>}
        <button onClick={() => handleAuth(authScreen)} disabled={authLoading || !authEmail || !authPass}
          style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
          {authLoading ? "..." : authScreen === "login" ? "LOG IN →" : "SIGN UP →"}
        </button>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => { setAuthScreen(authScreen === "login" ? "signup" : "login"); setAuthError(""); }}
            style={{ background: "none", border: "none", color: C.textMuted, fontSize: 11, cursor: "pointer", fontFamily: sans }}>
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
          <div style={{ fontSize: 29, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em", marginBottom: 6 }}>Signal</div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>NAME YOUR PROJECT</div>
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary, textAlign: "center", lineHeight: 1.6 }}>What are you working on? This becomes your workspace.</div>
        <input type="text" placeholder="e.g. CRISPR, Untitled Pilot, The Descent..." value={onboardName}
          onChange={e => setOnboardName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onboardName.trim() && completeOnboarding()}
          autoFocus
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "14px 16px", fontSize: 11, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box", textAlign: "center" }} />
        {authError && <div style={{ fontSize: 11, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>}
        <button onClick={completeOnboarding} disabled={authLoading || !onboardName.trim()}
          style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
          {authLoading ? "CREATING..." : "START →"}
        </button>
      </div>
    </div>
  );

  if (!user) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 23, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#131316", color: C.textPrimary, overflow: "hidden", padding: "8px", gap: 6 }}>

      {/* Toast notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, border: `1px solid ${notification.type === "success" ? C.green : notification.type === "error" ? C.red : C.border}`, color: C.textPrimary, padding: "10px 22px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", zIndex: 1000, borderRadius: 8 }}>
          {notification.msg}
        </div>
      )}

      {/* ─── LEFT COLUMN ─── */}
      <div style={{ width: leftW, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ cursor: "pointer" }} onClick={() => navGo("dashboard")}>
              <div style={{ fontSize: 16, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em" }}>signal</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginTop: 2 }}>{user.project_name?.toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <CalendarIntegration user={user} deliverables={deliverables} setDeliverables={setDeliverables} onEventsLoaded={setCalendarEvents} onEventsDue={(tasks) => notify(`${tasks.length} task${tasks.length > 1 ? "s" : ""} may need attention`, "warning")} />
              <button onClick={handleSignOut} style={{ background: "transparent", border: "none", color: C.textDisabled, fontSize: 11, cursor: "pointer", padding: 4, fontFamily: mono }} title="Sign out">⏻</button>
              <button onClick={() => setLeftW(prev => prev <= 60 ? 260 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 11, cursor: "pointer", padding: 4 }} title="Toggle panel">◧</button>
            </div>
          </div>

          {projects.length > 1 && (
            <select value={currentProject?.id || ""} onChange={e => switchProject(e.target.value)}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textSecondary, padding: "6px 8px", fontSize: 11, fontFamily: mono, outline: "none", borderRadius: 4, marginBottom: 10, cursor: "pointer" }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Global search */}
          <div style={{ position: "relative" }}>
            <input
              ref={globalSearchRef}
              placeholder={{ dashboard: "Search everything...", capture: "Search everything...", library: "Search ideas...", canon: "Search canon...", compose: "Search documents...", deliverables: "Search deliverables...", connections: "Search everything..." }[view] || "Search..."}
              onChange={e => {
                const val = e.target.value;
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => setGlobalSearch(val), 200);
              }}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "7px 12px 7px 28px", fontFamily: mono, fontSize: 11, outline: "none", borderRadius: 4 }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textDisabled }}>⌕</span>
            {globalSearch && globalResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderTop: "none", maxHeight: 320, overflowY: "auto", zIndex: 200, borderRadius: "0 0 4px 4px" }}>
                {globalResults.map((r, i) => (
                  <div key={i} onClick={() => {
                    const term = globalSearch;
                    setSearchHighlight(term);
                    if (r.type === "idea")       { setActiveIdea(r.item); navGo("library"); }
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
                    <span style={{ fontSize: 11, color: r.color, fontFamily: mono, flexShrink: 0, marginTop: 3 }}>{r.sub.toUpperCase()}</span>
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

        {/* Navigation */}
        <div style={{ padding: "12px 12px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: "today",   icon: "◎", label: "Today",    color: C.green,         full: true },
            { id: "dashboard", icon: "◉", label: "Overview", color: C.gold,         full: true },
          ].map(item => (
            <button key={item.id} onClick={() => navGo(item.id)}
              style={{ background: view === item.id ? item.color + "15" : C.bg, border: `1px solid ${view === item.id ? item.color : C.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => { if (view !== item.id) { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.background = item.color + "10"; }}}
              onMouseLeave={e => { if (view !== item.id) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}}>
              <span style={{ fontSize: 16, color: view === item.id ? item.color : C.textSecondary, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 16, color: view === item.id ? item.color : C.textSecondary, flex: 1, textAlign: "left" }}>{item.label}</span>
              <span style={{ fontSize: 16, color: C.textDisabled }}>›</span>
            </button>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {[
              { id: "capture",      icon: "◈", label: "Capture",  color: C.blue },
              { id: "library",      icon: "▤", label: "Library",  color: C.textSecondary },
              { id: "canon",        icon: "◆", label: "Canon",    color: C.green },
              { id: "deliverables", icon: "☐", label: "Actions",  color: C.gold },
              { id: "tasks",        icon: "✓", label: "Tasks",    color: C.textSecondary },
              { id: "compose",      icon: "✎", label: "Compose",  color: C.purple },
              { id: "connections",  icon: "⬡", label: "Map",      color: C.blue },
              { id: "calendar",    icon: "▦", label: "Calendar", color: C.gold },
            ].map(item => (
              <button key={item.id} onClick={() => navGo(item.id)}
                style={{ background: view === item.id ? item.color + "15" : C.bg, border: `1px solid ${view === item.id ? item.color : C.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.15s, background 0.15s" }}
                onMouseEnter={e => { if (view !== item.id) { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.background = item.color + "10"; }}}
                onMouseLeave={e => { if (view !== item.id) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}}>
                <span style={{ fontSize: 11, color: view === item.id ? item.color : C.textSecondary, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 11, color: view === item.id ? item.color : C.textSecondary }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Context-aware sidebar list */}
        {view === "library" ? (
          <>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
              <input ref={localSearchRef} placeholder="Search library..."
                onChange={e => setLocalSearch(e.target.value)}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "6px 10px", fontFamily: sans, fontSize: 11, outline: "none", borderRadius: 4 }} />
            </div>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setFilterCat(null)}
                style={{ background: !filterCat ? C.gold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.gold : C.border}`, padding: "3px 8px", fontSize: 11, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                ALL {ideas.length}
              </button>
              {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)}
                  style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "3px 8px", fontSize: 11, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>Nothing here yet.</div>
                : filtered.map(idea => {
                    const cat = getCat(idea.category);
                    const isActive = (activeIdea || filtered[0])?.id === idea.id;
                    const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
                    return (
                      <div key={idea.id} onClick={() => { setActiveIdea(idea); setSearchHighlight(""); }}
                        style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}
                        onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                        onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
                          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}{idea.signal_strength >= 4 ? " ◈" : ""}</span>
                        </div>
                        <div style={{ fontSize: 11, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          <Highlight text={idea.text} term={localSearch} />
                        </div>
                        {idea.signal_strength >= 4 && <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, marginTop: 4 }}>◈ HIGH SIGNAL</div>}
                      </div>
                    );
                  })
              }
            </div>
          </>
        ) : view === "canon" ? (
          <>
            <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => navGo("canon")}
                style={{ width: "100%", background: C.gold, color: C.bg, border: "none", padding: "8px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                + ADD TO CANON
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
                    <div style={{ fontSize: 11, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>{doc.type || "reference"}</div>
                  </div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>No sources yet.</div>}
            </div>
          </>
        ) : view === "compose" ? (
          <>
            <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={createComposeDoc}
                style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "8px", fontFamily: sans, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                + NEW DOCUMENT
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {composeDocs.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 11 }}>No documents yet.</div>
                : composeDocs.map(doc => (
                    <div key={doc.id} onClick={() => setActiveCompose(doc)}
                      style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", borderLeft: activeCompose?.id === doc.id ? `3px solid ${C.gold}` : "3px solid transparent", background: activeCompose?.id === doc.id ? C.surfaceHigh : "transparent" }}
                      onMouseEnter={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = C.surfaceHigh)}
                      onMouseLeave={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = "transparent")}>
                      <div style={{ fontSize: 11, color: activeCompose?.id === doc.id ? C.textPrimary : C.textSecondary, marginBottom: 3 }}>{doc.title || "Untitled"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{doc.content?.length || 0} chars</span>
                        <button onClick={e => { e.stopPropagation(); deleteComposeDoc(doc.id); }}
                          style={{ fontSize: 11, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "2px 6px", fontFamily: mono, cursor: "pointer", borderRadius: 3 }}>
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
            <div style={{ padding: "10px 10px 4px", fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>
              SOURCES · {activeCanon.length} active
            </div>
            <div style={{ overflowY: "auto", padding: "0 4px" }}>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }}
                  style={{ padding: "6px 10px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderRadius: 4, marginBottom: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 11, color: doc.is_active ? C.green : C.textDisabled, flexShrink: 0 }}>{doc.is_active ? "✓" : "○"}</span>
                  <div style={{ fontSize: 11, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 12, fontSize: 11, color: C.textDisabled, fontStyle: "italic" }}>No sources yet.</div>}

              <div style={{ padding: "14px 8px 4px", fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>RECENT IDEAS</div>
              {ideas.slice(0, 8).map(idea => {
                const cat = getCat(idea.category);
                const isActive = activeIdea?.id === idea.id;
                return (
                  <div key={idea.id} onClick={() => navGo("library", idea)}
                    style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, background: isActive ? C.surfaceHigh : "transparent", marginBottom: 1 }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                    <div style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</div>
                    <div style={{ fontSize: 11, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Left resize gutter */}
      <div onMouseDown={startDrag("left")} style={{ width: 4, cursor: "col-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 3, height: 40, borderRadius: 2, background: C.border, opacity: 0.4, transition: "opacity 0.15s, background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.background = C.border; }} />
      </div>

      {/* ─── CENTER COLUMN ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg, borderRadius: 12 }}>
        <div style={{ padding: "10px 28px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>
            {{ today: "TODAY", dashboard: "OVERVIEW", capture: "CAPTURE", library: "LIBRARY", canon: "CANON", deliverables: "DELIVERABLES", tasks: "TASKS", compose: "COMPOSE", connections: "CONNECTIONS", calendar: "CALENDAR" }[view]}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>{ideas.length} ideas</span>
            <span style={{ fontSize: 11, color: C.textDisabled }}>·</span>
            <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>{pending.length} open</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "today"        && <TodayFocus deliverables={deliverables} connections={[]} calendarEvents={[]} />}
          {view === "dashboard"    && <DashboardView user={user} ideas={ideas} deliverables={deliverables} pending={pending} activeCanon={activeCanon} canonDocs={canonDocs} onNavigate={navGo} onSetFilterCat={setFilterCat} onSetActiveDoc={setActiveDoc} />}
          {view === "capture"      && <CaptureView captureInputRef={captureInputRef} contextInputRef={contextInputRef} ideas={ideas} pending={pending} activeCanon={activeCanon} isAnalyzing={isAnalyzing} onCapture={captureIdea} onNavigate={navGo} />}
          {view === "library"      && <LibraryView activeIdea={activeIdea} filtered={filtered} deliverables={deliverables} replies={replies} searchHighlight={searchHighlight} onDeleteIdea={deleteIdea} onToggleDeliverable={toggleDeliverable} onSetSearchHighlight={setSearchHighlight} onAddReply={addReply} />}
          {view === "canon"        && <CanonView canonDocs={canonDocs} activeDoc={activeDoc} searchHighlight={searchHighlight} onToggleCanon={toggleCanon} onDeleteCanon={deleteCanon} onSetActiveDoc={setActiveDoc} onUploadCanon={uploadCanon} />}
          {view === "deliverables" && <DeliverablesView deliverables={deliverables} pending={pending} searchHighlight={searchHighlight} scrollToId={scrollToId} onToggleDeliverable={toggleDeliverable} />}
          {view === "tasks"        && <TasksView deliverables={deliverables} onAddTask={addTask} onDeleteTask={deleteTask} onToggleDeliverable={toggleDeliverable} />}
          {view === "compose"      && <ComposeView activeCompose={activeCompose} onSaveCompose={saveComposeDoc} onNotify={notify} />}
          {view === "connections"  && <MindMapView ideas={ideas} connections={connections} user={user} onGenerateConnections={generateConnections} onLoadAll={loadAll} onNavigate={navGo} onSetActiveIdea={setActiveIdea} onNotify={notify} />}
          {view === "calendar"    && <CalendarView deliverables={deliverables} calendarEvents={calendarEvents} onToggleDeliverable={toggleDeliverable} />}
        </div>
      </div>

      {/* Right resize gutter */}
      <div onMouseDown={startDrag("right")} style={{ width: 4, cursor: "col-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 3, height: 40, borderRadius: 2, background: C.border, opacity: 0.4, transition: "opacity 0.15s, background 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.background = C.border; }} />
      </div>

      {/* ─── RIGHT COLUMN: Studio ─── */}
      <div style={{ width: rightW, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ padding: "12px 14px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: C.textPrimary, fontWeight: 500 }}>Studio</span>
            <button onClick={() => setRightW(prev => prev <= 60 ? 290 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 11, cursor: "pointer", padding: 4 }} title="Toggle panel">◨</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { label: "Insight",     icon: "✦",  color: C.gold,     action: () => { if (!studio) runStudio(ideas, user); setStudioTab("insight"); } },
              { label: "Connections", icon: "⬡",  color: C.blue,     action: () => navGo("connections") },
              { label: "Patterns",    icon: "◎",  color: C.purple,   action: () => setStudioTab("patterns") },
              { label: "Audit",       icon: "⚑",  color: C.red,      action: () => { if (!auditing) auditLibrary(); } },
              { label: "Compose",     icon: "✎",  color: C.green,    action: () => navGo("compose") },
              { label: "Stats",       icon: "▦",  color: C.textMuted, action: () => setStudioTab("stats") },
              { label: "Pulse",       icon: "↯",  color: C.gold,     action: async () => {
                notify("Sending pulse...", "processing");
                try {
                  const r = await fetch("/api/pulse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "nudge", user_id: user?.id }) });
                  const d = await r.json();
                  if (d.sent) notify("Pulse sent to Telegram.", "success");
                  else notify("Pulse failed: " + (d.error || "unknown"), "error");
                } catch { notify("Pulse failed.", "error"); }
              }},
            ].map(tool => (
              <button key={tool.label} onClick={tool.action}
                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s, background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = tool.color; e.currentTarget.style.background = tool.color + "10"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}>
                <span style={{ fontSize: 11, color: tool.color, flexShrink: 0 }}>{tool.icon}</span>
                <span style={{ fontSize: 11, color: C.textSecondary, flex: 1, textAlign: "left" }}>{tool.label}</span>
                <span style={{ fontSize: 11, color: C.textDisabled }}>›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Studio tabs */}
        <div style={{ padding: "8px 14px 0", display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {[{ id: "insight", label: "Insight" }, { id: "patterns", label: "Patterns" }, { id: "stats", label: "Stats" }].map(t => (
            <button key={t.id} onClick={() => setStudioTab(t.id)}
              style={{ background: "transparent", border: "none", borderBottom: studioTab === t.id ? `2px solid ${C.gold}` : "2px solid transparent", color: studioTab === t.id ? C.textPrimary : C.textMuted, padding: "6px 12px 8px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {studioTab === "insight" && (
            studioLoading
              ? <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.gold, marginBottom: 8, animation: "pulse 1.5s infinite" }}>✦</div>
                  <div style={{ color: C.textMuted, fontSize: 11, lineHeight: 1.8 }}>Analyzing your project...</div>
                  <div style={{ color: C.textDisabled, fontSize: 11, marginTop: 4 }}>This can take 10-15 seconds</div>
                </div>
              : studio ? (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>PROVOCATION</div>
                    <div style={{ fontSize: 11, color: C.textPrimary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.provocation}</div>
                    <ReplyBox section="provocation" compact replies={replies} onAddReply={addReply} />
                  </div>
                  {studio.blind_spot && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: C.red, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>BLIND SPOT</div>
                      <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.75 }}>{studio.blind_spot}</div>
                      <ReplyBox section="blind_spot" compact replies={replies} onAddReply={addReply} />
                    </div>
                  )}
                  {studio.urgentIdea && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: C.green, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ACT ON THIS NOW</div>
                      <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.75, fontStyle: "italic" }}>{studio.urgentIdea}</div>
                      <ReplyBox section="urgent" compact replies={replies} onAddReply={addReply} />
                    </div>
                  )}
                  <button onClick={() => { studioFired.current = false; setStudio(null); runStudio(ideas, user); }}
                    style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "7px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", marginTop: 4, borderRadius: 4 }}>
                    REFRESH ↻
                  </button>
                </div>
              ) : ideas.length < 2
                ? <div style={{ fontSize: 11, color: C.textDisabled, fontStyle: "italic", lineHeight: 1.8 }}>Capture a few ideas to activate the Studio.</div>
                : <button onClick={() => runStudio(ideas, user)}
                    style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 4 }}>
                    GENERATE INSIGHT →
                  </button>
          )}

          {studioTab === "patterns" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 6 }}>LIBRARY AUDIT</div>
                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>AI removes duplicates and test entries.</div>
                <button onClick={auditLibrary} disabled={auditing}
                  style={{ width: "100%", background: "transparent", border: `1px solid ${C.red}`, color: C.red, padding: "8px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", cursor: auditing ? "default" : "pointer", opacity: auditing ? 0.5 : 1, borderRadius: 4 }}>
                  {auditing ? "AUDITING..." : "AUDIT + CLEAN LIBRARY"}
                </button>
              </div>
              {studio?.pattern && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHAT YOU KEEP CIRCLING</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.purple}`, paddingLeft: 10 }}>{studio.pattern}</div>
                </div>
              )}
              {studio?.duplicates && studio.duplicates !== "null" && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ON REPETITION</div>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.duplicates}</div>
                </div>
              )}
              {ideas.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>BY CATEGORY</div>
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
                { label: "Total Ideas",  value: ideas.length,                                                                    color: C.gold,   dest: "library"      },
                { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length,         color: C.blue,   dest: "library"      },
                { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length,                               color: C.green,  dest: "library"      },
                { label: "Via Telegram", value: ideas.filter(i => i.source === "whatsapp").length,                              color: C.purple, dest: "library"      },
                { label: "Open Actions", value: pending.length,                                                                  color: C.red,    dest: "deliverables" },
                { label: "Canon Docs",   value: activeCanon.length,                                                              color: C.green,  dest: "canon"        },
              ].map(s => (
                <div key={s.label} onClick={() => navGo(s.dest)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 11, color: C.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 16, color: s.color, fontStyle: "italic" }}>{s.value}</span>
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

      {!workTypesConfigured && user && showWorkTypeSetup && (
        <WorkTypeSetup user={user} onComplete={() => { setWorkTypesConfigured(true); setShowWorkTypeSetup(false); }} />
      )}
      <TaskTracker user={user} deliverables={deliverables} setDeliverables={setDeliverables} />
    </div>
  );
}
