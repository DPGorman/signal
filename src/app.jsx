import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase.js";
import { C, CATEGORIES, DOC_TYPES, DAILY_INVITATIONS, getCat, todayInvitation, callAI } from "./lib/constants.js";
import Highlight from "./components/Highlight.jsx";
import ReplyBox from "./components/ReplyBox.jsx";
import TodayFocus from "./components/TodayFocus.jsx";
import CalendarIntegration from "./components/CalendarIntegration.jsx";
import CalendarView from "./components/views/CalendarView.jsx";
import TasksView from "./components/views/TasksView.jsx";
import DashboardView from "./components/views/DashboardView.jsx";
import CanonView from "./components/views/CanonView.jsx";
import CaptureView from "./components/views/CaptureView.jsx";
import LibraryView from "./components/views/LibraryView.jsx";
import DeliverablesView from "./components/views/DeliverablesView.jsx";
import ComposeView from "./components/views/ComposeView.jsx";
import MindMapView from "./components/views/MindMapView.jsx";
import OnboardingFlow from "./components/OnboardingFlow.jsx";

const formatDuration = (mins) => { if (!mins) return null; if (mins < 60) return `${mins}m`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `${h}h ${m}m` : `${h}h`; };

// Voice-overlay shape: server assembles backbone + craft overlay + user-layer + mode contract.
// See api/_voice/* and SIGNAL_VOICE_AND_OVERLAYS_2026-05-06_v2.1.md.
async function callAIv2({ mode, userId, context, message = "", maxTokens = 1000 }) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, userId, context, message, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
  return res.json();
}

export default function Signal() {
  const [user,          setUser]          = useState(null);
  const [ideas,         setIdeas]         = useState([]);
  const [deliverables,  setDeliverables]  = useState([]);
  const [canonDocs,     setCanonDocs]     = useState([]);
  const [view,          setView]          = useState("today");
  const [activeIdea,    setActiveIdea]    = useState(null);
  const [activeDoc,     setActiveDoc]     = useState(null);
  const [input,         setInput]         = useState("");
  const [context,       setContext]       = useState("");
  const [isAnalyzing,   setIsAnalyzing]   = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);
  const [notification,  setNotification]  = useState(null);
  const [filterCat,     setFilterCat]     = useState(null);
  const [signalFilter,  setSignalFilter]  = useState(false);
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
  const [globalSearch,  setGlobalSearch]  = useState("");
  const [localSearch,   setLocalSearch]   = useState("");
  const [searchHighlight, setSearchHighlight] = useState("");
  const [scrollToId,    setScrollToId]    = useState(null);
  const [actionsView,   setActionsView]   = useState("focus");
  const [justDone,      setJustDone]      = useState(new Set());
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
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [calendarEvents, setCalendarEvents] = useState([]);
  // Clarification flow state (voice doc v2.3 §2.5 + §2.7). When classify
  // returns type=unclear AND round < 4, we DON'T persist the row — instead
  // we surface the AI's clarifying question inline and let the user answer.
  // Up to 4 rounds total before we give up and persist as kind=unclear.
  // null when not in a clarification flow.
  // shape: { originalText, originalContext, qaHistory: [{q, a}], round, currentQuestion }
  const [clarification, setClarification] = useState(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");

  const studioFired = useRef(false);
  const captureInputRef = useRef(null);
  const contextInputRef = useRef(null);
  const globalSearchRef = useRef(null);
  const localSearchRef = useRef(null);
  const searchTimer = useRef(null);

  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("magic"); // "magic" | "password"
  const [authStep, setAuthStep] = useState("email"); // "email" | "code" — magic mode only
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "signup" — password mode only
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  // onboardName state migrated into <OnboardingFlow /> component (5/7).

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

  const handleSendCode = async () => {
    if (!authEmail) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setAuthStep("code");
    } catch (e) {
      setAuthError(e.message || "Could not send code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (authCode.trim().length !== 6) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: authEmail.trim(),
        token: authCode.trim(),
        type: "email",
      });
      if (error) throw error;
      // onAuthStateChange picks up the session
    } catch (e) {
      setAuthError(e.message || "That code didn't work.");
      setAuthCode("");
    } finally {
      setAuthLoading(false);
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

  // Activation-pattern onboarding: accepts { name, craft, collaborator, canon }
  // from <OnboardingFlow />. Writes user (with craft + collaborator_name),
  // creates first project, optionally creates one canon doc per the activation
  // lock (SIGNAL-OPS · 5/7).
  const completeOnboarding = async (values) => {
    if (!values?.name?.trim() || !values?.craft || !authUser) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      // Create user record with craft + collaborator
      const { data: newUser, error: ue } = await supabase.from("users").insert([{
        display_name:      values.name.trim(),
        project_name:      values.name.trim(),
        auth_id:           authUser.id,
        craft:             values.craft,
        collaborator_name: values.collaborator || null,
      }]).select().single();
      if (ue) throw ue;

      // Create first project
      const { error: pe } = await supabase.from("projects").insert([{
        user_id: newUser.id,
        name:    values.name.trim(),
      }]);
      if (pe) throw pe;

      // Optionally create the day-1 canon doc (skippable in UI, nag-once)
      if (values.canon?.title && values.canon?.content) {
        const { error: ce } = await supabase.from("canon_documents").insert([{
          user_id:   newUser.id,
          title:     values.canon.title,
          doc_type:  "reference",
          content:   values.canon.content,
          is_active: true,
        }]);
        if (ce) console.warn("Canon insert failed (non-fatal):", ce.message);
      }

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

  const loadAll = async (uid, projId = null) => {
    try {
      // Load user + projects first
      const [{ data: users }, { data: projs }] = await Promise.all([
        supabase.from("users").select("*").eq("id", uid).limit(1),
        supabase.from("projects").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      ]);
      const u = users?.[0];
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
      const result = await callAIv2({
        mode: "studio",
        userId: userObj?.id,
        context: `PROJECT: ${userObj?.project_name || "Film Series"}\n\nALL IDEAS (${ideasList.length} total):\n${allIdeas}`,
      });
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
      const result = await callAIv2({
        mode: "audit",
        userId: user.id,
        context: `Timestamp: ${Date.now()}\n\nCURRENT LIBRARY (${ideas.length} ideas):\n${allIdeas}`,
        maxTokens: 1000,
      });

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

  // Core two-step capture pipeline (voice doc v2.3 §2.5 + §2.7 multi-round).
  // Call 1: classify — gate before craft analysis. Returns one of
  //   project_material | task | personal_note | unclear.
  // When type=unclear AND round < 4, surfaces a clarifying question UI
  // instead of persisting; the user's answer recursively re-enters this
  // function with qaHistory appended. Round 4 is the final attempt — if
  // still unclear, persist as kind=unclear with the full Q&A transcript.
  // Call 2 (craft analysis) fires only for project_material.
  const runClassifyAndCapture = async ({ text, ctx, qaHistory = [], round = 1 }) => {
    const activeDocs   = canonDocs.filter(d => d.is_active);
    const canonContext = activeDocs.slice(0, 3).map(d => `[${d.title}]:\n${d.content.slice(0, 800)}`).join("\n\n");
    const existing     = ideas.slice(0, 20).map(i => `"${i.text.slice(0, 100)}"`).join("\n");
    const openInvites  = deliverables.filter(d => !d.is_complete).slice(0, 15).map(d => `"${d.text}"`).join("\n");

    const qaBlock = qaHistory.length
      ? `\n\nCLARIFICATION HISTORY (rounds 1-${qaHistory.length}, you are now on round ${round}):\n` +
        qaHistory.map((qa, i) => `Round ${i + 1}\n  AI asked: "${qa.q}"\n  User answered: "${qa.a}"`).join("\n")
      : "";

    const classifyContext = `PROJECT: ${user.project_name || "(no active project)"}
CRAFT: ${user.craft || "screenwriter"}
TODAY: ${new Date().toISOString().split("T")[0]}

${canonContext ? `CANON (excerpts):\n${canonContext}\n\n` : ""}RECENT CAPTURES (for context — do not duplicate-check, that's a downstream call):
${existing || "None yet."}${ctx ? `\n\nUSER'S FRAMING:\n"${ctx}"` : ""}${qaBlock}${round === 4 ? "\n\nFINAL ROUND — if still unclear, return type=unclear with clarifying_question=null per the multi-round protocol." : ""}`;

    const classify = await callAIv2({
      mode: "classify",
      userId: user.id,
      context: classifyContext,
      message: `Capture: "${text}"`,
      maxTokens: 300,
    });

    const kind = classify.type || "project_material";

    // Unclear + still rounds left → surface clarification UI; don't persist yet.
    if (kind === "unclear" && classify.clarifying_question && round < 4) {
      setClarification({
        originalText: text,
        originalContext: ctx,
        qaHistory,
        round,
        currentQuestion: classify.clarifying_question,
      });
      setIsAnalyzing(false);
      notify(`Round ${round}: Signal needs more context.`, "info");
      return;
    }

    // Off-topic branch (task | personal_note | unclear-final). Persist + done.
    if (kind !== "project_material") {
      // For unclear-final, save the full Q&A transcript into ai_note so the
      // user can see what was asked and how they answered.
      let aiNote = "";
      if (kind === "unclear") {
        const transcript = qaHistory.length
          ? "Clarification attempts:\n" + qaHistory.map((qa, i) => `${i + 1}. Q: ${qa.q}\n   A: ${qa.a}`).join("\n")
          : (classify.clarifying_question || "Signal couldn't place this capture. Edit to clarify.");
        aiNote = transcript;
      }
      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id: user.id, text, source: "app",
        kind,
        category:             kind,
        auto_tag:             classify.auto_tag || null,
        ai_note:              aiNote,
        inspiration_question: ctx || null,
        signal_strength:      1,
        canon_resonance:      "",
        project_id:           currentProject?.id || null,
      }]).select().single();

      if (error) { notify("Failed to save.", "error"); return; }

      setClarification(null);
      setClarifyAnswer("");
      await loadAll(user.id);
      setActiveIdea(saved);
      if (kind === "task") {
        notify(`Captured as task${classify.auto_tag ? ` · ${classify.auto_tag}` : ""}.`, "success");
      } else if (kind === "personal_note") {
        notify(`Captured as note${classify.auto_tag ? ` · ${classify.auto_tag}` : ""}.`, "success");
      } else {
        notify(`Captured as unclear after ${qaHistory.length} clarification round${qaHistory.length === 1 ? "" : "s"}. Edit to refine.`, "info");
      }
      studioFired.current = false;
      return;
    }

    // Project_material — fire Call 2 (craft analysis) and persist with all the trimmings.
    const analysis = await callAIv2({
      mode: "capture",
      userId: user.id,
      context: `PROJECT: ${user.project_name}
TODAY: ${new Date().toISOString().split("T")[0]} — for invitations, pick realistic due dates within the next 1-4 weeks, or null if none fits.

${canonContext ? `CANON:\n${canonContext}\n\n` : ""}EXISTING IDEAS — don't duplicate:
${existing || "None yet."}

OPEN INVITATIONS — don't overlap:
${openInvites || "None yet."}${ctx ? `\n\nWHY THIS FELT IMPORTANT (user's framing):\n"${ctx}"` : ""}${qaBlock}`,
      message: `New idea: "${text}"`,
      maxTokens: 1200,
    });

    const { data: saved, error } = await supabase.from("ideas").insert([{
      user_id: user.id, text, source: "app",
      kind:                 "project_material",
      category:             analysis.category      || "premise",
      auto_tag:             classify.auto_tag      || null,
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
        analysis.invitations.map(inv => ({
          idea_id: saved.id,
          user_id: user.id,
          text: typeof inv === "string" ? inv : inv.text,
          due_date: (typeof inv === "object" && inv.due_date) ? inv.due_date : null,
          duration_minutes: (typeof inv === "object" && inv.duration_minutes) ? inv.duration_minutes : null,
          project_id: currentProject?.id || null,
        }))
      );

    setClarification(null);
    setClarifyAnswer("");
    await loadAll(user.id);
    setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(label => ({ label })) });
    setView("library");
    notify(qaHistory.length ? `Captured after ${qaHistory.length} clarification round${qaHistory.length === 1 ? "" : "s"}.` : "Signal captured.", "success");
    studioFired.current = false;
    // Generate connections in background
    generateConnections(saved.id, text, user.id);
  };

  // Entry point: "SEND THE SIGNAL →" button. Starts a fresh capture flow.
  const captureIdea = async () => {
    const text = (captureInputRef.current?.value || "").trim();
    const ctx  = (contextInputRef.current?.value || "").trim();
    if (!text || !user || isAnalyzing) return;
    if (captureInputRef.current) captureInputRef.current.value = "";
    if (contextInputRef.current) contextInputRef.current.value = "";
    setIsAnalyzing(true);
    notify("Analyzing...", "processing");
    try {
      await runClassifyAndCapture({ text, ctx, qaHistory: [], round: 1 });
    } catch (e) {
      console.error("Capture:", e);
      notify("Analysis failed.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-entry from the clarification panel. Appends the user's answer to qaHistory
  // and re-runs classify (advancing the round counter).
  const submitClarification = async () => {
    const answer = clarifyAnswer.trim();
    if (!answer || !clarification || isAnalyzing) return;
    const nextHistory = [...clarification.qaHistory, { q: clarification.currentQuestion, a: answer }];
    const nextRound = clarification.round + 1;
    setClarifyAnswer("");
    setIsAnalyzing(true);
    notify(`Round ${nextRound}: re-classifying...`, "processing");
    try {
      await runClassifyAndCapture({
        text: clarification.originalText,
        ctx:  clarification.originalContext,
        qaHistory: nextHistory,
        round: nextRound,
      });
    } catch (e) {
      console.error("Clarify:", e);
      notify("Clarification failed.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // User abandons the clarification flow — persist as unclear with the qaHistory so far.
  const giveUpClarification = async () => {
    if (!clarification || !user) return;
    setIsAnalyzing(true);
    try {
      const transcript = clarification.qaHistory.length
        ? "Clarification attempts:\n" + clarification.qaHistory.map((qa, i) => `${i + 1}. Q: ${qa.q}\n   A: ${qa.a}`).join("\n") + `\n${clarification.qaHistory.length + 1}. Q: ${clarification.currentQuestion}\n   A: (skipped)`
        : `Signal asked: "${clarification.currentQuestion}" — skipped.`;
      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id: user.id, text: clarification.originalText, source: "app",
        kind: "unclear", category: "unclear", auto_tag: null,
        ai_note: transcript,
        inspiration_question: clarification.originalContext || null,
        signal_strength: 1, canon_resonance: "",
        project_id: currentProject?.id || null,
      }]).select().single();
      if (error) { notify("Failed to save.", "error"); return; }
      setClarification(null);
      setClarifyAnswer("");
      await loadAll(user.id);
      setActiveIdea(saved);
      notify("Saved as unclear. Edit to clarify later.", "info");
    } finally { setIsAnalyzing(false); }
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

      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      let data = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch("/api/parse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
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
    if (!current) {
      setJustDone(prev => new Set([...prev, id]));
      setTimeout(() => {
        setDeliverables(prev => prev.map(d => d.id === id ? { ...d, is_complete: true } : d));
        setJustDone(prev => { const s = new Set(prev); s.delete(id); return s; });
      }, 700);
      await supabase.from("deliverables")
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq("id", id);
      notify("Action complete", "success");
    } else {
      await supabase.from("deliverables")
        .update({ is_complete: false, completed_at: null })
        .eq("id", id);
      setDeliverables(prev => prev.map(d => d.id === id ? { ...d, is_complete: false } : d));
    }
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

  const navGo = (v, idea = null, catId = null) => {
    setView(v);
    setLocalSearch("");
    if (localSearchRef.current) localSearchRef.current.value = "";
    if (idea) { setActiveIdea(idea); }
    else if (v !== "library" && v !== "canon" && v !== "compose") { setActiveIdea(null); setActiveDoc(null); }
    if (catId !== null) { setFilterCat(catId); }
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

  const addTask = async (text, dueDate, extra = {}) => {
    const taskText = (text || newTaskText).trim();
    if (!taskText || !user || taskAdding) return;
    setTaskAdding(true);
    const insertData = { user_id: user.id, text: taskText, type: "task", priority: 2, project_id: currentProject?.id || null, ...extra };
    const dueDateVal = dueDate || newTaskDue;
    if (dueDateVal) insertData.due_date = dueDateVal;
    if (newTaskDuration) insertData.duration_minutes = parseInt(newTaskDuration);
    await supabase.from("deliverables").insert([insertData]);
    setNewTaskText("");
    setNewTaskDue("");
    setNewTaskDuration("");
    setTaskAdding(false);
    await loadAll(user.id, currentProject?.id);
  };

  const deleteTask = async (id) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("deliverables").delete().eq("id", id);
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  const updateTask = async (id, updates) => {
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    await supabase.from("deliverables").update(updates).eq("id", id);
  };

  const starTask = async (id, starred) => {
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, is_starred: starred } : d));
    await supabase.from("deliverables").update({ is_starred: starred }).eq("id", id);
  };

  const addToSession = async (id) => {
    const todayStr = new Date().toISOString().split("T")[0];
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, session_date: todayStr } : d));
    await supabase.from("deliverables").update({ session_date: todayStr }).eq("id", id);
  };

  const removeFromSession = async (id) => {
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, session_date: null } : d));
    await supabase.from("deliverables").update({ session_date: null }).eq("id", id);
  };

  const pushToGoogleCalendar = async (deliverable) => {
    if (!user) return;
    try {
      // Get refresh token
      const { data } = await supabase
        .from("user_integrations")
        .select("refresh_token")
        .eq("user_id", user.id)
        .eq("provider", "google_calendar")
        .limit(1);
      const token = data?.[0]?.refresh_token;
      if (!token) { notify("Connect Google Calendar first.", "error"); return; }

      const res = await fetch("/api/calendar?action=create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: token,
          title: deliverable.text,
          date: deliverable.due_date,
          duration_minutes: deliverable.duration_minutes || 60,
          description: deliverable.idea?.text || "",
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      notify("Pushed to Google Calendar.", "success");
    } catch (e) { console.error("Push to calendar:", e); notify("Failed to push to calendar.", "error"); }
  };

  const pending     = deliverables.filter(d => !d.is_complete);
  const activeCanon = canonDocs.filter(d => d.is_active);
  // Creative library: project_material kind only (legacy null treated as project_material).
  // Tasks + personal_notes + unclear captures from the classify gate live in `ideas`
  // but don't belong in the creative library view, category-filter row, or library count.
  const creativeIdeas = ideas.filter(i => !i.kind || i.kind === "project_material");
  const filtered    = (() => {
    let f = creativeIdeas;
    if (filterCat) f = f.filter(i => i.category === filterCat);
    if (signalFilter) f = f.filter(i => i.signal_strength >= 4);
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
    fontSize: 12, outline: "none", boxSizing: "border-box",
  };

  if (isLoading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 24, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  if (!authUser) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>
      <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 30, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.03em", marginBottom: 6 }}>Signal</div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>
            {authMode === "magic" && authStep === "code"
              ? "CHECK YOUR EMAIL"
              : authMode === "password"
                ? (authScreen === "login" ? "WELCOME BACK" : "CREATE ACCOUNT")
                : "SIGN IN"}
          </div>
        </div>

        {authMode === "magic" && authStep === "code" ? (
          <>
            <div style={{ fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.5, padding: "0 4px" }}>
              We sent a 6-digit code to{" "}
              <span style={{ color: C.textPrimary }}>{authEmail}</span>.
            </div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder="123456" value={authCode}
              onChange={e => setAuthCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "14px", fontSize: 22, fontFamily: mono, letterSpacing: "0.5em", textAlign: "center", outline: "none", borderRadius: 6, boxSizing: "border-box" }}
            />
            {authError && (
              <div style={{ fontSize: 12, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>
            )}
            <button
              onClick={handleVerifyCode}
              disabled={authLoading || authCode.length !== 6}
              style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
              {authLoading ? "..." : "VERIFY →"}
            </button>
            <button
              onClick={() => { setAuthStep("email"); setAuthCode(""); setAuthError(""); }}
              style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans, marginTop: 4 }}>
              ← Use a different email
            </button>
          </>
        ) : (
          <>
            <input
              type="email" placeholder="Email" value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                if (authMode === "magic" && authEmail) handleSendCode();
                else if (authMode === "password" && authEmail && authPass) handleAuth(authScreen);
              }}
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }}
            />

            {authMode === "password" && (
              <input
                type="password" placeholder="Password" value={authPass}
                onChange={e => setAuthPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && authEmail && authPass && handleAuth(authScreen)}
                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "12px 14px", fontSize: 12, fontFamily: sans, outline: "none", borderRadius: 6, boxSizing: "border-box" }}
              />
            )}

            {authError && (
              <div style={{ fontSize: 12, color: C.red, textAlign: "center", lineHeight: 1.5 }}>{authError}</div>
            )}

            <button
              onClick={() => authMode === "magic" ? handleSendCode() : handleAuth(authScreen)}
              disabled={authLoading || !authEmail || (authMode === "password" && !authPass)}
              style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "12px", fontFamily: mono, fontSize: 12, letterSpacing: "0.12em", cursor: authLoading ? "default" : "pointer", borderRadius: 6, opacity: authLoading ? 0.6 : 1 }}>
              {authLoading
                ? "..."
                : authMode === "magic"
                  ? "EMAIL ME A CODE →"
                  : authScreen === "login" ? "LOG IN →" : "SIGN UP →"}
            </button>

            {authMode === "magic" ? (
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button
                  onClick={() => { setAuthMode("password"); setAuthError(""); }}
                  style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>
                  Use a password instead
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => { setAuthScreen(authScreen === "login" ? "signup" : "login"); setAuthError(""); }}
                    style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>
                    {authScreen === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                  </button>
                </div>
                <div style={{ textAlign: "center", marginTop: -4 }}>
                  <button
                    onClick={() => { setAuthMode("magic"); setAuthPass(""); setAuthError(""); }}
                    style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: sans }}>
                    ← Back to email code
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (onboarding) return (
    <OnboardingFlow
      C={C}
      sans={sans}
      mono={mono}
      error={authError}
      loading={authLoading}
      onComplete={completeOnboarding}
    />
  );

  if (!user) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: sans, fontSize: 24, fontStyle: "italic" }}>Signal</div>
    </div>
  );





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




  // Studio panel content is now inline in the return JSX

  return (
    <div style={{ display: "flex", height: "100vh", background: "#131316", color: C.textPrimary, overflow: "hidden", padding: "8px", gap: 6 }}>
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, border: `1px solid ${notification.type === "success" ? C.green : notification.type === "error" ? C.red : C.border}`, color: C.textPrimary, padding: "10px 22px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", zIndex: 1000, borderRadius: 8 }}>
          {notification.msg}
        </div>
      )}

      {/* ─── LEFT COLUMN: Sources + Navigation ─── */}
      <div style={{ width: leftW, background: C.surface, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ cursor: "pointer" }} onClick={() => navGo("dashboard")}>
              <div style={{ fontSize: 17, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em" }}>signal</div>
              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginTop: 2 }}>{user.project_name?.toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={handleSignOut} style={{ background: "transparent", border: "none", color: C.textDisabled, fontSize: 12, cursor: "pointer", padding: 4, fontFamily: mono }} title="Sign out">⏻</button>
              <button onClick={() => setLeftW(prev => prev <= 60 ? 260 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", padding: 4 }} title="Toggle panel">◧</button>
            </div>
          </div>
          {projects.length > 1 && (
            <select value={currentProject?.id || ""} onChange={e => switchProject(e.target.value)}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textSecondary, padding: "6px 8px", fontSize: 12, fontFamily: mono, outline: "none", borderRadius: 4, marginBottom: 10, cursor: "pointer" }}>
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
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, padding: "7px 12px 7px 28px", fontFamily: mono, fontSize: 12, outline: "none", borderRadius: 4 }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textDisabled }}>⌕</span>
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
                    <span style={{ fontSize: 12, color: r.color, fontFamily: mono, flexShrink: 0, marginTop: 3 }}>{r.sub.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.label} term={globalSearch} /></span>
                  </div>
                ))}
              </div>
            )}
            {globalSearch && globalResults.length === 0 && globalSearch.length >= 2 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderTop: "none", padding: "10px 12px", zIndex: 200 }}>
                <span style={{ fontSize: 12, color: C.textDisabled, fontStyle: "italic" }}>No results for "{globalSearch}"</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav pills */}
        <div style={{ padding: "12px 12px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => navGo("today")}
            style={{
              background: view === "today" ? C.gold + "15" : C.bg,
              border: `1px solid ${view === "today" ? C.gold : C.border}`,
              borderRadius: 8, padding: "7px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { if (view !== "today") { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.gold + "10"; }}}
            onMouseLeave={e => { if (view !== "today") { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}}>
            <span style={{ fontSize: 17, color: view === "today" ? C.gold : C.textSecondary, flexShrink: 0 }}>◉</span>
            <span style={{ fontSize: 17, color: view === "today" ? C.gold : C.textSecondary, flex: 1, textAlign: "left" }}>Today</span>
            <span style={{ fontSize: 17, color: C.textDisabled }}>›</span>
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {[
            { id: "tasks",        icon: "☑", label: "Tasks",    color: C.gold },
            { id: "calendar",     icon: "▦", label: "Calendar", color: C.blue },
            { id: "capture",      icon: "◈", label: "Capture",  color: C.blue },
            { id: "deliverables", icon: "☐", label: "Actions",  color: C.gold },
            { id: "library",      icon: "▤", label: "Library",  color: C.textSecondary },
            { id: "canon",        icon: "◆", label: "Canon",    color: C.green },
            { id: "compose",      icon: "✎", label: "Compose",  color: C.purple },
            { id: "connections",  icon: "⬡", label: "Map",      color: C.blue },
            { id: "dashboard",    icon: "◎", label: "Overview",  color: C.textSecondary },
          ].map(item => (
            <button key={item.id} onClick={() => navGo(item.id)}
              style={{
                background: view === item.id ? item.color + "15" : C.bg,
                border: `1px solid ${view === item.id ? item.color : C.border}`,
                borderRadius: 8, padding: "7px 10px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { if (view !== item.id) { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.background = item.color + "10"; }}}
              onMouseLeave={e => { if (view !== item.id) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg; }}}>
              <span style={{ fontSize: 12, color: view === item.id ? item.color : C.textSecondary, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: view === item.id ? item.color : C.textSecondary }}>{item.label}</span>
            </button>
          ))}
          </div>
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
                style={{ background: !filterCat ? C.gold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.gold : C.border}`, padding: "3px 8px", fontSize: 12, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                ALL {creativeIdeas.length}
              </button>
              {CATEGORIES.filter(cat => creativeIdeas.some(i => i.category === cat.id)).map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)}
                  style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "3px 8px", fontSize: 12, fontFamily: sans, fontWeight: 500, cursor: "pointer", borderRadius: 4 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>Nothing here yet.</div>
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
                          <span style={{ fontSize: 12, color: cat.color, fontFamily: mono, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
                          <span style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}{idea.signal_strength >= 4 ? " ◈" : ""}</span>
                        </div>
                        <div style={{ fontSize: 12, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Highlight text={idea.text} term={localSearch} /></div>
                        {idea.signal_strength >= 4 && <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, marginTop: 4 }}>◈ HIGH SIGNAL</div>}
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
                style={{ width: "100%", background: showUpload ? "transparent" : C.gold, color: showUpload ? C.textMuted : C.bg, border: showUpload ? `1px solid ${C.border}` : "none", padding: "8px", fontFamily: sans, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                {showUpload ? "CANCEL" : "+ ADD TO CANON"}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => setActiveDoc(doc)}
                  style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: activeDoc?.id === doc.id ? `3px solid ${C.green}` : "3px solid transparent", background: activeDoc?.id === doc.id ? C.surfaceHigh : "transparent" }}
                  onMouseEnter={e => activeDoc?.id !== doc.id && (e.currentTarget.style.background = C.surfaceHigh)}
                  onMouseLeave={e => activeDoc?.id !== doc.id && (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 12, color: doc.is_active ? C.green : C.textDisabled, flexShrink: 0 }}>{doc.is_active ? "✓" : "○"}</span>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 12, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                    <div style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono }}>{doc.type || "reference"}</div>
                  </div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>No sources yet.</div>}
            </div>
          </>
        ) : (view === "compose") ? (
          <>
            <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={createComposeDoc}
                style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "8px", fontFamily: sans, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 4 }}>
                + NEW DOCUMENT
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {composeDocs.length === 0
                ? <div style={{ padding: 20, color: C.textDisabled, fontStyle: "italic", fontSize: 12 }}>No documents yet.</div>
                : composeDocs.map(doc => (
                    <div key={doc.id} onClick={() => setActiveCompose(doc)}
                      style={{ padding: "10px 12px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", borderLeft: activeCompose?.id === doc.id ? `3px solid ${C.gold}` : "3px solid transparent", background: activeCompose?.id === doc.id ? C.surfaceHigh : "transparent" }}
                      onMouseEnter={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = C.surfaceHigh)}
                      onMouseLeave={e => activeCompose?.id !== doc.id && (e.currentTarget.style.background = "transparent")}>
                      <div style={{ fontSize: 12, color: activeCompose?.id === doc.id ? C.textPrimary : C.textSecondary, marginBottom: 3 }}>{doc.title || "Untitled"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>{doc.content?.length || 0} chars</span>
                        <button onClick={e => { e.stopPropagation(); deleteComposeDoc(doc.id); }}
                          style={{ fontSize: 12, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "2px 6px", fontFamily: mono, cursor: "pointer", borderRadius: 3 }}>
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
            <div style={{ padding: "10px 10px 4px", fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>
              SOURCES · {activeCanon.length} active
            </div>
            <div style={{ overflowY: "auto", padding: "0 4px" }}>
              {canonDocs.map(doc => (
                <div key={doc.id} onClick={() => { setActiveDoc(doc); navGo("canon"); }}
                  style={{ padding: "6px 10px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", borderRadius: 4, marginBottom: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 12, color: doc.is_active ? C.green : C.textDisabled, flexShrink: 0 }}>{doc.is_active ? "✓" : "○"}</span>
                  <div style={{ fontSize: 12, color: doc.is_active ? C.textPrimary : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                </div>
              ))}
              {canonDocs.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.textDisabled, fontStyle: "italic" }}>No sources yet.</div>}

              <div style={{ padding: "14px 8px 4px", fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", fontWeight: 500 }}>
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
                    <div style={{ fontSize: 12, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</div>
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
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>
            {{ today: "TODAY'S FOCUS", calendar: "CALENDAR", dashboard: "OVERVIEW", capture: "CAPTURE", library: "LIBRARY", canon: "CANON", deliverables: "ACTIONS", compose: "COMPOSE", connections: "CONNECTIONS" }[view]}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <span
              onClick={() => navGo("library")}
              style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono, cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.gold}
              onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}
            >
              {creativeIdeas.length} ideas
            </span>
            <span style={{ fontSize: 12, color: C.textDisabled }}>·</span>
            <span
              onClick={() => navGo("deliverables")}
              style={{ fontSize: 12, color: C.textDisabled, fontFamily: mono, cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = C.gold}
              onMouseLeave={e => e.currentTarget.style.color = C.textDisabled}
            >
              {pending.length} open
            </span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "today"        && <TodayFocus deliverables={deliverables} connections={connections} calendarEvents={calendarEvents} onToggleDeliverable={toggleDeliverable} onNavigate={navGo} onAddToSession={addToSession} />}
          {view === "tasks"        && <TasksView deliverables={deliverables} onAddTask={addTask} onDeleteTask={deleteTask} onToggleDeliverable={toggleDeliverable} onUpdateTask={updateTask} onAddToSession={addToSession} onRemoveFromSession={removeFromSession} onStarTask={starTask} />}
          {view === "calendar"     && <CalendarView deliverables={deliverables} calendarEvents={calendarEvents} onToggleDeliverable={toggleDeliverable} onPushToCalendar={pushToGoogleCalendar} onNavigate={navGo} />}
          {view === "dashboard"    && (
            <DashboardView
              user={user}
              ideas={creativeIdeas}
              deliverables={deliverables}
              pending={pending}
              activeCanon={activeCanon}
              canonDocs={canonDocs}
              onNavigate={navGo}
              onSetFilterCat={setFilterCat}
              onSetActiveDoc={setActiveDoc}
              onToggleDeliverable={toggleDeliverable}
            />
          )}
          {view === "capture"      && (
            <CaptureView
              captureInputRef={captureInputRef}
              contextInputRef={contextInputRef}
              ideas={creativeIdeas}
              pending={pending}
              activeCanon={activeCanon}
              isAnalyzing={isAnalyzing}
              onCapture={captureIdea}
              onNavigate={navGo}
              clarification={clarification}
              clarifyAnswer={clarifyAnswer}
              onClarifyAnswerChange={setClarifyAnswer}
              onSubmitClarification={submitClarification}
              onGiveUpClarification={giveUpClarification}
            />
          )}
          {view === "library"      && (
            <LibraryView
              activeIdea={activeIdea}
              filtered={filtered}
              deliverables={deliverables}
              replies={replies}
              searchHighlight={searchHighlight}
              signalFilter={signalFilter}
              onSetSignalFilter={setSignalFilter}
              onSetSearchHighlight={setSearchHighlight}
              onDeleteIdea={deleteIdea}
              onToggleDeliverable={toggleDeliverable}
              onAddReply={addReply}
            />
          )}
          {view === "canon"        && (
            <CanonView
              showUpload={showUpload}
              canonUpload={canonUpload}
              isProcessing={isProcessing}
              isUploading={isUploading}
              uploadedName={uploadedName}
              onChangeUpload={setCanonUpload}
              onProcessFile={processFile}
              onUpload={uploadCanon}
              activeDoc={activeDoc}
              searchHighlight={searchHighlight}
              onToggleCanon={toggleCanon}
              onDeleteCanon={deleteCanon}
            />
          )}
          {view === "deliverables" && (
            <DeliverablesView
              deliverables={deliverables}
              pending={pending}
              justDone={justDone}
              actionsView={actionsView}
              newTaskText={newTaskText}
              newTaskDue={newTaskDue}
              newTaskDuration={newTaskDuration}
              taskAdding={taskAdding}
              searchHighlight={searchHighlight}
              scrollToId={scrollToId}
              onSetActionsView={setActionsView}
              onSetNewTaskText={setNewTaskText}
              onSetNewTaskDue={setNewTaskDue}
              onSetNewTaskDuration={setNewTaskDuration}
              onAddTask={addTask}
              onToggleDeliverable={toggleDeliverable}
              onDeleteTask={deleteTask}
              onNavigate={navGo}
            />
          )}
          {view === "compose"      && (
            <ComposeView
              activeCompose={activeCompose}
              onSave={saveComposeDoc}
              onNotify={notify}
            />
          )}
          {view === "connections"  && (
            <MindMapView
              ideas={ideas}
              connections={connections}
              user={user}
              onGenerateConnections={generateConnections}
              onLoadAll={loadAll}
              onSetActiveIdea={setActiveIdea}
              onNavigate={navGo}
              onNotify={notify}
            />
          )}
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
            <span style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>Studio</span>
            <button onClick={() => setRightW(prev => prev <= 60 ? 290 : 60)} style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", padding: 4 }} title="Toggle panel">◨</button>
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
                  const { data: { session } } = await supabase.auth.getSession();
                  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
                  const r = await fetch("/api/pulse", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ mode: "nudge", user_id: user?.id }) });
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
                <span style={{ fontSize: 12, color: tool.color, flexShrink: 0 }}>{tool.icon}</span>
                <span style={{ fontSize: 12, color: C.textSecondary, flex: 1, textAlign: "left" }}>{tool.label}</span>
                <span style={{ fontSize: 12, color: C.textDisabled }}>›</span>
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
                  <div style={{ fontSize: 12, color: C.gold, marginBottom: 8, animation: "pulse 1.5s infinite" }}>✦</div>
                  <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.8 }}>Analyzing your project...</div>
                  <div style={{ color: C.textDisabled, fontSize: 12, marginTop: 4 }}>This can take 10-15 seconds</div>
                </div>
              : studio ? (
                <div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>PROVOCATION</div>
                    <div style={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.provocation}</div>
                    <ReplyBox section="provocation" compact replies={replies} onAddReply={addReply} />
                  </div>
                  {studio.blind_spot && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, color: C.red, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>BLIND SPOT</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.75 }}>{studio.blind_spot}</div>
                      <ReplyBox section="blind_spot" compact replies={replies} onAddReply={addReply} />
                    </div>
                  )}
                  {studio.urgentIdea && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, color: C.green, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ACT ON THIS NOW</div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.75, fontStyle: "italic" }}>{studio.urgentIdea}</div>
                      <ReplyBox section="urgent" compact replies={replies} onAddReply={addReply} />
                    </div>
                  )}
                  <button onClick={() => { studioFired.current = false; setStudio(null); runStudio(ideas, user); }}
                    style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "7px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", cursor: "pointer", marginTop: 4, borderRadius: 4 }}>
                    REFRESH ↻
                  </button>
                </div>
              ) : creativeIdeas.length < 2
                ? <div style={{ fontSize: 12, color: C.textDisabled, fontStyle: "italic", lineHeight: 1.8 }}>Capture a few ideas to activate the Studio.</div>
                : <button onClick={() => runStudio(ideas, user)}
                    style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 4 }}>
                    GENERATE INSIGHT →
                  </button>
          )}
          {studioTab === "patterns" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 6 }}>LIBRARY AUDIT</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>AI removes duplicates and test entries.</div>
                <button onClick={auditLibrary} disabled={auditing}
                  style={{ width: "100%", background: "transparent", border: `1px solid ${C.red}`, color: C.red, padding: "8px", fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", cursor: auditing ? "default" : "pointer", opacity: auditing ? 0.5 : 1, borderRadius: 4 }}>
                  {auditing ? "AUDITING..." : "AUDIT + CLEAN LIBRARY"}
                </button>
              </div>
              {studio?.pattern && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHAT YOU KEEP CIRCLING</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.purple}`, paddingLeft: 10 }}>{studio.pattern}</div>
                </div>
              )}
              {studio?.duplicates && studio.duplicates !== "null" && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>ON REPETITION</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{studio.duplicates}</div>
                </div>
              )}
              {creativeIdeas.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>BY CATEGORY</div>
                  {CATEGORIES.map(cat => {
                    const count = creativeIdeas.filter(i => i.category === cat.id).length;
                    if (!count) return null;
                    return (
                      <div key={cat.id} onClick={() => { setFilterCat(cat.id); navGo("library"); }} style={{ marginBottom: 8, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 12, color: C.textSecondary }}>{cat.icon} {cat.label}</span>
                          <span style={{ fontSize: 12, color: cat.color, fontFamily: mono }}>{count}</span>
                        </div>
                        <div style={{ height: 2, background: C.border, borderRadius: 2 }}>
                          <div style={{ height: "100%", background: cat.color, width: `${(count / creativeIdeas.length) * 100}%`, borderRadius: 2, opacity: 0.8 }} />
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
                { label: "Total Ideas",  value: creativeIdeas.length,   color: C.gold,   dest: "library"      },
                { label: "This Week",    value: creativeIdeas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length, color: C.blue, dest: "library" },
                { label: "High Signal",  value: creativeIdeas.filter(i => i.signal_strength >= 4).length, color: C.green, dest: "library" },
                { label: "Via Telegram", value: creativeIdeas.filter(i => i.source === "whatsapp").length, color: C.purple, dest: "library" },
                { label: "Open Actions", value: pending.length, color: C.red,    dest: "deliverables" },
                { label: "Canon Docs",   value: activeCanon.length, color: C.green, dest: "canon"     },
              ].map(s => (
                <div key={s.label} onClick={() => navGo(s.dest)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 12, color: C.textSecondary }}>{s.label}</span>
                  <span style={{ fontSize: 17, color: s.color, fontStyle: "italic" }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CalendarIntegration loads events silently — no visible UI */}
      {user && (
        <CalendarIntegration
          user={user}
          deliverables={deliverables}
          onEventsLoaded={(evts) => setCalendarEvents(evts)}
        />
      )}

    </div>
  );
}
