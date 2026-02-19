import { useState, useEffect, useRef } from "react";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

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

// ─── AI call helper — routes through serverless proxy ─────────────────────
async function callAI(system, userMsg, maxTokens = 1000) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, message: userMsg, maxTokens }),
  });
  if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
  return res.json();
}

// ──────────────────────────────────────────────────────────────────────────
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
  const [studio,        setStudio]        = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioTab,     setStudioTab]     = useState("insight");
  const [auditing,      setAuditing]      = useState(false);

  const fileInputRef  = useRef(null);
  const textareaRef   = useRef(null);
  const studioFired   = useRef(false); // ensures studio fires exactly once on load

  // ── Boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) {
      loadAll(uid);
    } else {
      // Try to recover from DB — useful when switching browsers
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => {
          if (data?.id) { localStorage.setItem("signal_user_id", data.id); loadAll(data.id); }
          else setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, []);

  // ── Fire studio exactly once after data loads ─────────────────────────
  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]); // eslint-disable-line

  // ── Data ─────────────────────────────────────────────────────────────────
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
    } catch (e) { console.error("loadAll error:", e); }
    finally { setIsLoading(false); }
  };

  // ── Studio — AI reads everything and thinks ──────────────────────────
  const runStudio = async (ideasList, userObj) => {
    if (!ideasList?.length || studioLoading) return;
    setStudioLoading(true);
    try {
      const allIdeas = ideasList.map((i, n) =>
        `#${n + 1} [${i.category}, signal ${i.signal_strength || "?"}] "${i.text}"`
      ).join("\n");

      const result = await callAI(
        `You are a senior creative collaborator — script editor, dramaturg, producer — working on a film series. You have just read every idea the creator has captured.

Your job is to THINK, not categorize. Read everything. Notice what's there, what's missing, what keeps surfacing in different forms, what the creator is working toward without knowing it yet.

Be direct. Be specific. Do not be encouraging for its own sake. Your value is seeing what the creator cannot see because they are too close.

On repetition: if ideas are clearly the same thought captured multiple times, say so plainly. Distinguish between genuine obsession (the creator hasn't cracked it yet) and noise (test entries, accidental duplicates). Name which is which.

Respond ONLY with raw JSON — no markdown, no preamble:
{
  "provocation": "the sharpest unresolved question this body of work raises. 2-3 sentences. Specific to these ideas, not generic writing advice.",
  "pattern": "what is this creator actually working on beneath the surface? the real subject. interpretive, not descriptive.",
  "urgentIdea": "the single captured idea that most deserves development right now, and one sentence saying exactly why.",
  "blind_spot": "what is this work not yet grappling with that it must? be honest.",
  "duplicates": "if ideas are clearly the same thought, name them and say which articulation is strongest. If no genuine duplicates exist, return null."
}`,
        `Project: ${userObj?.project_name || "Film Series"}\nTotal captured: ${ideasList.length}\n\nALL IDEAS:\n${allIdeas}`,
        1000
      );
      setStudio(result);
    } catch (e) {
      console.error("Studio error:", e);
    } finally {
      setStudioLoading(false);
    }
  };

  // ── Audit — AI identifies and deletes duplicates ─────────────────────
  const auditLibrary = async () => {
    if (!ideas.length || !user || auditing) return;
    setAuditing(true);
    notify("Reading your library...", "processing");
    try {
      const allIdeas = ideas.map(i => `ID:${i.id} [${i.category}] "${i.text}"`).join("\n");

      const result = await callAI(
        `You are auditing a creative idea database. Be ruthless and precise.

Read every idea. Identify:
1. EXACT or near-exact duplicates — same thought, same or nearly same wording. Keep the single best-articulated version, mark the rest for deletion.
2. Obvious test entries — "test", "hello", gibberish, clearly not real creative work.

Do NOT flag ideas that are genuinely different even if they share a theme.

Return ONLY raw JSON:
{
  "toDelete": ["id1", "id2"],
  "summary": "one plain sentence: what you removed and why"
}

If nothing needs removal: { "toDelete": [], "summary": "No duplicates or test entries found." }`,
        `ALL IDEAS:\n${allIdeas}`,
        800
      );

      if (result.toDelete?.length > 0) {
        for (const id of result.toDelete) {
          await supabase.from("deliverables").delete().eq("idea_id", id);
          await supabase.from("dimensions").delete().eq("idea_id", id);
          await supabase.from("ideas").delete().eq("id", id);
        }
        studioFired.current = false; // allow studio to re-fire with clean data
        await loadAll(user.id);
        notify(result.summary, "success");
      } else {
        notify(result.summary, "info");
      }
    } catch (e) {
      console.error("Audit error:", e);
      notify("Audit failed.", "error");
    } finally {
      setAuditing(false);
    }
  };

  // ── Capture ───────────────────────────────────────────────────────────
  const captureIdea = async () => {
    if (!input.trim() || !user || isAnalyzing) return;
    const text = input.trim();
    const ctx  = context.trim();
    setInput("");
    setContext("");
    setIsAnalyzing(true);
    notify("Analyzing...", "processing");

    try {
      const activeDocs      = canonDocs.filter(d => d.is_active);
      const canonContext    = activeDocs.slice(0, 3).map(d => `[${d.title}]:\n${d.content.slice(0, 800)}`).join("\n\n");
      const existingIdeas   = ideas.slice(0, 20).map(i => `"${i.text.slice(0, 100)}"`).join("\n");
      const openInvitations = deliverables.filter(d => !d.is_complete).slice(0, 15).map(d => `"${d.text}"`).join("\n");

      const analysis = await callAI(
        `You are a world-class script editor and dramaturg working on a specific creative project. Your job is to THINK, not process.

${canonContext ? `CANON — foundational documents to push every idea against:\n${canonContext}\n\n` : ""}EXISTING IDEAS — do not generate duplicates of these:
${existingIdeas || "None yet."}

OPEN INVITATIONS — do not generate invitations that overlap with these:
${openInvitations || "None yet."}

${ctx ? `CREATOR'S NOTE — why this felt important:\n"${ctx}"\n\n` : ""}Rules:
- If this idea is substantially the same as an existing idea, say so in aiNote and set signalStrength to 1
- dimensions: the specific levels this idea operates on simultaneously (2-3, precise not generic)
- invitations: creative pulls not tasks, max 2, only if genuinely new territory not already covered
- canonResonance: name a specific tension with or echo of the canon, or leave empty
- signalStrength: 1=noise/duplicate, 2=interesting, 3=strong, 4=urgent, 5=essential

Respond ONLY with raw JSON:
{
  "category": "premise|character|scene|dialogue|arc|production|research|business",
  "dimensions": ["level 1", "level 2"],
  "aiNote": "specific insight about this idea in context of everything already captured",
  "invitations": [],
  "signalStrength": 3,
  "canonResonance": ""
}`,
        `Project: ${user.project_name}\n\nNew idea: "${text}"`,
        1200
      );

      const { data: saved, error } = await supabase.from("ideas").insert([{
        user_id:              user.id,
        text,
        source:               "app",
        category:             analysis.category     || "premise",
        ai_note:              analysis.aiNote        || "",
        inspiration_question: ctx                    || null,
        signal_strength:      analysis.signalStrength || 3,
        canon_resonance:      analysis.canonResonance || "",
      }]).select().single();

      if (error) { notify("Failed to save.", "error"); return; }

      if (analysis.dimensions?.length)
        await supabase.from("dimensions").insert(
          analysis.dimensions.map(label => ({ idea_id: saved.id, label }))
        );

      if (analysis.invitations?.length)
        await supabase.from("deliverables").insert(
          analysis.invitations.map(text => ({ idea_id: saved.id, user_id: user.id, text }))
        );

      await loadAll(user.id);
      setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(label => ({ label })) });
      setView("library");
      notify("Signal captured.", "success");

      // Refresh studio with new data — reset ref so it fires again
      studioFired.current = false;

    } catch (e) {
      console.error("Capture error:", e);
      notify("Analysis failed.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Canon ─────────────────────────────────────────────────────────────
  const uploadCanon = async () => {
    if (!canonUpload.title || !canonUpload.content || !user) return;
    setIsUploading(true);
    try {
      const { data, error } = await supabase.from("canon_documents").insert([{
        user_id:  user.id,
        title:    canonUpload.title,
        doc_type: canonUpload.type,
        content:  canonUpload.content,
        is_active: true,
      }]).select().single();
      if (error) throw error;
      setCanonDocs(prev => [data, ...prev]);
      setCanonUpload({ title: "", type: "reference", content: "" });
      setShowUpload(false);
      notify("Added to Canon.", "success");
    } catch { notify("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCanonUpload(p => ({
      ...p,
      content: ev.target.result,
      title: p.title || file.name.replace(/\.[^/.]+$/, ""),
    }));
    reader.readAsText(file);
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

  // ── Notify ────────────────────────────────────────────────────────────
  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const navGo = (v) => { setView(v); setActiveIdea(null); setActiveDoc(null); };

  // ── Derived ───────────────────────────────────────────────────────────
  const pending     = deliverables.filter(d => !d.is_complete);
  const activeCanon = canonDocs.filter(d => d.is_active);
  const filtered    = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;

  // ── Styles ────────────────────────────────────────────────────────────
  const mono  = "'Courier New', monospace";
  const serif = "Georgia, 'Times New Roman', serif";

  const inputBase = {
    width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
    color: C.textPrimary, padding: "11px 14px", fontFamily: serif,
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const label = {
    fontSize: 10, color: C.textMuted, fontFamily: mono,
    letterSpacing: "0.15em", marginBottom: 7, display: "block",
  };

  // ── Guards ────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.textMuted, fontFamily: serif, fontSize: 22, fontStyle: "italic" }}>Signal</div>
    </div>
  );

  if (!user) return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
      <div style={{ color: C.textPrimary, fontFamily: serif, fontSize: 26, fontStyle: "italic" }}>Signal</div>
      <button onClick={() => {
        supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
          .then(({ data }) => {
            if (data?.id) { localStorage.setItem("signal_user_id", data.id); window.location.reload(); }
          });
      }} style={{ background: C.gold, border: "none", color: C.bg, padding: "12px 28px", fontFamily: mono, fontSize: 11, cursor: "pointer", letterSpacing: "0.1em" }}>
        RECOVER SESSION →
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════

  const DashboardView = () => (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "44px 52px" }}>

      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em", marginBottom: 5 }}>{user.project_name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: mono }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { label: "Ideas Captured",   value: ideas.length,   color: C.gold,   sub: `${ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length} this week` },
          { label: "Open Invitations", value: pending.length, color: C.red,    sub: `${deliverables.filter(d => d.is_complete).length} completed` },
          { label: "High Signal",      value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, sub: "worth pursuing now" },
          { label: "Canon Active",     value: activeCanon.length, color: C.purple, sub: "conditioning AI" },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "20px 18px" }}>
            <div style={{ fontSize: 40, color: s.color, fontStyle: "italic", lineHeight: 1, marginBottom: 10 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: C.textPrimary, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent + Invitations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36 }}>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={label}>RECENT CAPTURES</span>
            <span onClick={() => navGo("library")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {ideas.length === 0
              ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>No ideas yet.</div>
              : ideas.slice(0, 7).map((idea, idx) => {
                  const cat = getCat(idea.category);
                  const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
                  return (
                    <div key={idea.id} onClick={() => { setActiveIdea(idea); navGo("library"); }}
                      style={{ padding: "12px 16px", borderBottom: idx < 6 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ fontSize: 11, color: cat.color, marginTop: 3, flexShrink: 0 }}>{cat.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{idea.text}</div>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, marginTop: 3 }}>
                          {cat.label} · {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                          {idea.signal_strength >= 4 && <span style={{ color: C.gold, marginLeft: 6 }}>◈ high</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={label}>OPEN INVITATIONS</span>
            <span onClick={() => navGo("deliverables")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>VIEW ALL →</span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {pending.length === 0
              ? <div style={{ padding: "24px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 14 }}>All caught up.</div>
              : pending.slice(0, 7).map((task, idx, arr) => {
                  const cat = getCat(task.idea?.category);
                  return (
                    <div key={task.id} onClick={() => toggleDeliverable(task.id, task.is_complete)}
                      style={{ padding: "12px 16px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.borderSubtle}` : "none", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{task.text}</div>
                        <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, marginTop: 3 }}>{cat.icon} {cat.label}</div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* Signal distribution */}
      {ideas.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <span style={label}>SIGNAL DISTRIBUTION</span>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
            {CATEGORIES.map(cat => {
              const count = ideas.filter(i => i.category === cat.id).length;
              if (!count) return null;
              return <div key={cat.id} title={`${cat.label}: ${count}`} style={{ flex: count, background: cat.color, opacity: 0.85 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <span key={cat.id} style={{ fontSize: 11, color: C.textMuted }}>
                <span style={{ color: cat.color }}>{cat.icon}</span> {cat.label} {ideas.filter(i => i.category === cat.id).length}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canon summary */}
      {canonDocs.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={label}>CANON LAYER</span>
            <span onClick={() => navGo("canon")} style={{ fontSize: 11, color: C.gold, cursor: "pointer", fontFamily: mono }}>MANAGE →</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canonDocs.map(doc => (
              <div key={doc.id} style={{ background: C.surface, border: `1px solid ${doc.is_active ? C.green + "50" : C.border}`, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
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
      <div style={{ maxWidth: 680 }}>

        <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 10 }}>TODAY'S INVITATION</div>
          <div style={{ fontSize: 19, lineHeight: 1.9, color: C.textMuted, fontStyle: "italic" }}>{todayInvitation}</div>
        </div>

        <span style={label}>WHAT'S IN YOUR HEAD RIGHT NOW</span>
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
          placeholder="Don't edit. Don't qualify. Just send the signal."
          rows={5}
          style={{ ...inputBase, fontSize: 16, lineHeight: 1.9, resize: "vertical", marginBottom: 16 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        <span style={label}>WHY DOES THIS FEEL IMPORTANT RIGHT NOW? <span style={{ color: C.textDisabled }}>(optional)</span></span>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. it reframes the protagonist's entire moral logic..."
          style={{ ...inputBase, marginBottom: 20 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER</span>
          <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()}
            style={{
              background: isAnalyzing || !input.trim() ? C.surfaceHigh : C.gold,
              color: isAnalyzing || !input.trim() ? C.textMuted : C.bg,
              border: "none", padding: "12px 30px", fontFamily: mono, fontSize: 11,
              letterSpacing: "0.1em", cursor: isAnalyzing || !input.trim() ? "default" : "pointer",
            }}>
            {isAnalyzing ? "ANALYZING..." : "SEND THE SIGNAL →"}
          </button>
        </div>

        <div style={{ marginTop: 60, display: "flex", gap: 52, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          {[
            { l: "IDEAS CAPTURED",   v: ideas.length },
            { l: "OPEN INVITATIONS", v: pending.length },
            { l: "CANON DOCS",       v: activeCanon.length },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 44, color: C.textPrimary, fontStyle: "italic", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginTop: 8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const LibraryView = () => (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* List panel */}
      <div style={{ width: 320, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
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

        {filtered.length === 0
          ? <div style={{ padding: 40, color: C.textDisabled, fontStyle: "italic" }}>Nothing here yet.</div>
          : filtered.map(idea => {
              const cat = getCat(idea.category);
              const isActive = activeIdea?.id === idea.id;
              const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
              return (
                <div key={idea.id} onClick={() => setActiveIdea(idea)}
                  style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background = "#2E2C34")}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}</span>
                  </div>
                  <div style={{ fontSize: 13, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
                  {idea.signal_strength >= 4 && <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginTop: 5 }}>◈ HIGH SIGNAL</div>}
                </div>
              );
            })
        }
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 44px" }}>
        {!activeIdea
          ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 15, marginTop: 60 }}>Select an idea.</div>
          : (() => {
              const cat = getCat(activeIdea.category);
              const ideaDeliverables = deliverables.filter(d => d.idea_id === activeIdea.id);
              return (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 13, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                    {activeIdea.signal_strength >= 4 && <span style={{ fontSize: 10, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}`, padding: "2px 8px" }}>HIGH SIGNAL</span>}
                  </div>

                  <div style={{ fontSize: 20, color: C.textPrimary, lineHeight: 1.85, marginBottom: 28, fontFamily: serif }}>{activeIdea.text}</div>

                  {activeIdea.inspiration_question && (
                    <div style={{ marginBottom: 28, padding: "14px 18px", background: C.surfaceHigh, borderLeft: `3px solid ${C.textMuted}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 6 }}>WHY IT FELT IMPORTANT</div>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, fontStyle: "italic" }}>{activeIdea.inspiration_question}</div>
                    </div>
                  )}

                  {activeIdea.ai_note && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
                      <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.85 }}>{activeIdea.ai_note}</div>
                    </div>
                  )}

                  {activeIdea.canon_resonance && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 10, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON RESONANCE</div>
                      <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.85 }}>{activeIdea.canon_resonance}</div>
                    </div>
                  )}

                  {activeIdea.dimensions?.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>DIMENSIONS</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {activeIdea.dimensions.map((d, i) => (
                          <span key={i} style={{ fontSize: 12, color: C.textSecondary, border: `1px solid ${C.border}`, padding: "4px 12px", fontFamily: mono }}>{d.label}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ideaDeliverables.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>INVITATIONS TO ACTION</div>
                      {ideaDeliverables.map(d => (
                        <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                          style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}>
                          <div style={{ width: 16, height: 16, border: `2px solid ${d.is_complete ? C.green : C.border}`, background: d.is_complete ? C.green + "30" : "transparent", flexShrink: 0, marginTop: 2 }} />
                          <div style={{ fontSize: 14, color: d.is_complete ? C.textMuted : C.textSecondary, lineHeight: 1.7, textDecoration: d.is_complete ? "line-through" : "none" }}>{d.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
        }
      </div>
    </div>
  );

  const CanonView = () => (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* Doc list */}
      <div style={{ width: 300, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setShowUpload(!showUpload)}
            style={{ width: "100%", background: showUpload ? "transparent" : C.gold, color: showUpload ? C.textMuted : C.bg, border: showUpload ? `1px solid ${C.border}` : "none", padding: "9px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
            {showUpload ? "CANCEL" : "+ ADD TO CANON"}
          </button>
        </div>

        {showUpload && (
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, background: C.surfaceHigh }}>
            <input value={canonUpload.title} onChange={e => setCanonUpload(p => ({ ...p, title: e.target.value }))}
              placeholder="Document title"
              style={{ ...inputBase, marginBottom: 10, fontSize: 13 }} />
            <select value={canonUpload.type} onChange={e => setCanonUpload(p => ({ ...p, type: e.target.value }))}
              style={{ ...inputBase, marginBottom: 10, fontSize: 13 }}>
              {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input type="file" accept=".txt,.md" ref={fileInputRef} onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, padding: "8px", fontFamily: mono, fontSize: 10, cursor: "pointer", marginBottom: 8 }}>
              {canonUpload.content ? "✓ FILE LOADED" : "UPLOAD FILE"}
            </button>
            {!canonUpload.content && (
              <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
                placeholder="Or paste text directly..."
                rows={4}
                style={{ ...inputBase, fontSize: 13, resize: "vertical", marginBottom: 8 }} />
            )}
            <button onClick={uploadCanon} disabled={isUploading || !canonUpload.title || !canonUpload.content}
              style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "9px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
              {isUploading ? "SAVING..." : "ADD TO CANON →"}
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {canonDocs.length === 0
            ? <div style={{ padding: "32px 20px", color: C.textDisabled, fontStyle: "italic", fontSize: 13 }}>No documents yet.</div>
            : canonDocs.map(doc => (
                <div key={doc.id} onClick={() => setActiveDoc(doc)}
                  style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer", background: activeDoc?.id === doc.id ? C.surfaceHigh : "transparent", borderLeft: activeDoc?.id === doc.id ? `3px solid ${C.green}` : "3px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: doc.is_active ? C.textPrimary : C.textMuted }}>{doc.title}</span>
                    <span style={{ fontSize: 10, color: doc.is_active ? C.green : C.textDisabled, fontFamily: mono }}>{doc.is_active ? "ACTIVE" : "OFF"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{doc.content?.length?.toLocaleString()} chars</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={e => { e.stopPropagation(); toggleCanon(doc.id, doc.is_active); }}
                      style={{ fontSize: 10, color: doc.is_active ? C.textMuted : C.green, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 9px", fontFamily: mono, cursor: "pointer" }}>
                      {doc.is_active ? "DEACTIVATE" : "ACTIVATE"}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteCanon(doc.id); }}
                      style={{ fontSize: 10, color: C.red, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 9px", fontFamily: mono, cursor: "pointer" }}>
                      DELETE
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Reader */}
      <div style={{ flex: 1, overflowY: "auto", padding: "36px 44px" }}>
        {!activeDoc
          ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 15, marginTop: 60 }}>Select a document to read.</div>
          : (
            <div style={{ maxWidth: 680 }}>
              <div style={{ fontSize: 22, color: C.textPrimary, marginBottom: 8 }}>{activeDoc.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 32 }}>{activeDoc.content?.length?.toLocaleString()} characters · {activeDoc.is_active ? "active" : "inactive"}</div>
              <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.95, whiteSpace: "pre-wrap", fontFamily: serif }}>{activeDoc.content}</div>
            </div>
          )
        }
      </div>
    </div>
  );

  const DeliverablesView = () => {
    const completed = deliverables.filter(d => d.is_complete);
    const pct = deliverables.length ? Math.round((completed.length / deliverables.length) * 100) : 0;
    const byCategory = CATEGORIES.map(cat => ({
      ...cat,
      items: pending.filter(d => d.idea?.category === cat.id),
    })).filter(cat => cat.items.length > 0);

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        <div style={{ maxWidth: 720 }}>

          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.textSecondary }}>{pending.length} open · {completed.length} complete</span>
              <span style={{ fontSize: 14, color: C.gold, fontFamily: mono }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
              <div style={{ height: "100%", background: C.gold, width: `${pct}%`, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>

          {pending.length === 0
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 16, marginTop: 40 }}>All invitations complete.</div>
            : byCategory.map(cat => (
                <div key={cat.id} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 12 }}>{cat.icon} {cat.label.toUpperCase()}</div>
                  {cat.items.map(d => (
                    <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                      style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}>
                      <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.75 }}>{d.text}</div>
                        {d.idea?.text && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 5 }}>from: "{d.idea.text.slice(0, 60)}..."</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ))
          }
        </div>
      </div>
    );
  };

  // ── Studio Panel ──────────────────────────────────────────────────────
  const StudioPanel = () => (
    <div style={{ width: 268, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

      <div style={{ padding: "14px 16px 0", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 12 }}>STUDIO</div>
        <div style={{ display: "flex" }}>
          {[
            { id: "insight",  label: "Insight"  },
            { id: "patterns", label: "Patterns" },
            { id: "stats",    label: "Stats"    },
          ].map(t => (
            <button key={t.id} onClick={() => setStudioTab(t.id)}
              style={{ background: "transparent", border: "none", borderBottom: studioTab === t.id ? `2px solid ${C.gold}` : "2px solid transparent", color: studioTab === t.id ? C.textPrimary : C.textMuted, padding: "6px 12px 10px", fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>

        {/* ── INSIGHT ── */}
        {studioTab === "insight" && (
          studioLoading
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 13, lineHeight: 1.8 }}>Reading your project...</div>
            : studio
              ? (
                <div>
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>TODAY'S PROVOCATION</div>
                    <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.9, borderLeft: `3px solid ${C.gold}`, paddingLeft: 12 }}>{studio.provocation}</div>
                  </div>

                  {studio.blind_spot && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 10, color: C.red, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>BLIND SPOT</div>
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>{studio.blind_spot}</div>
                    </div>
                  )}

                  {studio.urgentIdea && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 10, color: C.green, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>ACT ON THIS NOW</div>
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8, fontStyle: "italic" }}>{studio.urgentIdea}</div>
                    </div>
                  )}

                  <button onClick={() => { studioFired.current = false; setStudio(null); runStudio(ideas, user); }}
                    style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "8px", fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", cursor: "pointer", marginTop: 4 }}>
                    REFRESH ↻
                  </button>
                </div>
              )
              : ideas.length < 2
                ? <div style={{ fontSize: 13, color: C.textDisabled, fontStyle: "italic", lineHeight: 1.8 }}>Capture a few ideas and the Studio will read your project.</div>
                : (
                  <button onClick={() => runStudio(ideas, user)}
                    style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                    GENERATE INSIGHT →
                  </button>
                )
        )}

        {/* ── PATTERNS ── */}
        {studioTab === "patterns" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>LIBRARY AUDIT</div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: 10 }}>AI reads every idea, removes exact duplicates and test entries, keeps the best version of each.</div>
              <button onClick={auditLibrary} disabled={auditing}
                style={{ width: "100%", background: "transparent", border: `1px solid ${C.red}`, color: C.red, padding: "9px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: auditing ? "default" : "pointer", opacity: auditing ? 0.5 : 1 }}>
                {auditing ? "AUDITING..." : "AUDIT + CLEAN LIBRARY"}
              </button>
            </div>

            {studio?.pattern && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>WHAT YOU KEEP CIRCLING</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.85, borderLeft: `3px solid ${C.purple}`, paddingLeft: 12 }}>{studio.pattern}</div>
              </div>
            )}

            {studio?.duplicates && studio.duplicates !== "null" && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>ON REPETITION</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 12 }}>{studio.duplicates}</div>
              </div>
            )}

            {ideas.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 12 }}>BY CATEGORY</div>
                {CATEGORIES.map(cat => {
                  const count = ideas.filter(i => i.category === cat.id).length;
                  if (!count) return null;
                  return (
                    <div key={cat.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: C.textSecondary }}>{cat.icon} {cat.label}</span>
                        <span style={{ fontSize: 12, color: cat.color, fontFamily: mono }}>{count}</span>
                      </div>
                      <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                        <div style={{ height: "100%", background: cat.color, width: `${(count / ideas.length) * 100}%`, borderRadius: 2, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STATS ── */}
        {studioTab === "stats" && (
          <div>
            {[
              { label: "Total Ideas",  value: ideas.length,   color: C.gold   },
              { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length, color: C.blue  },
              { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green  },
              { label: "Via WhatsApp", value: ideas.filter(i => i.source === "whatsapp").length, color: C.purple },
              { label: "Open Actions", value: pending.length, color: C.red    },
              { label: "Canon Docs",   value: activeCanon.length, color: C.green },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}` }}>
                <span style={{ fontSize: 13, color: C.textSecondary }}>{s.label}</span>
                <span style={{ fontSize: 22, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}

            {activeCanon.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON ACTIVE</div>
                {activeCanon.map(d => (
                  <div key={d.id} style={{ fontSize: 12, color: C.green, marginBottom: 6, display: "flex", gap: 6 }}>
                    <span style={{ flexShrink: 0 }}>◈</span><span style={{ lineHeight: 1.5 }}>{d.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // SHELL
  // ══════════════════════════════════════════════════════════════════════

  const navItems = [
    { id: "dashboard",    label: "Dashboard",    badge: null },
    { id: "capture",      label: "Capture",      badge: null },
    { id: "library",      label: "Library",      badge: ideas.length || null },
    { id: "canon",        label: "Canon",        badge: activeCanon.length || null },
    { id: "deliverables", label: "Deliverables", badge: pending.length || null },
  ];

  const centerLabels = { dashboard: "OVERVIEW", capture: "CAPTURE", library: "LIBRARY", canon: "CANON", deliverables: "DELIVERABLES" };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, overflow: "hidden" }}>

      {/* Notification */}
      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, border: `1px solid ${notification.type === "success" ? C.green : notification.type === "error" ? C.red : C.border}`, color: C.textPrimary, padding: "10px 20px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", zIndex: 1000 }}>
          {notification.msg}
        </div>
      )}

      {/* ── LEFT NAV ── */}
      <div style={{ width: 224, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 24px 20px" }}>
          <div style={{ fontSize: 22, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em" }}>signal</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginTop: 3 }}>{user.project_name?.toUpperCase()}</div>
        </div>

        <nav style={{ flex: "0 0 auto" }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => navGo(item.id)}
              style={{ padding: "11px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: view === item.id ? C.surfaceHigh : "transparent", borderLeft: view === item.id ? `3px solid ${C.gold}` : "3px solid transparent" }}
              onMouseEnter={e => view !== item.id && (e.currentTarget.style.background = "#2E2C34")}
              onMouseLeave={e => view !== item.id && (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 15, color: view === item.id ? C.textPrimary : C.textSecondary }}>{item.label}</span>
              {item.badge ? <span style={{ fontSize: 12, color: C.gold, fontFamily: mono }}>{item.badge}</span> : null}
            </div>
          ))}
        </nav>

        {/* Recent ideas in nav */}
        <div style={{ padding: "14px 20px 6px", fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>RECENT</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {ideas.slice(0, 12).map(idea => {
            const cat = getCat(idea.category);
            const isActive = activeIdea?.id === idea.id;
            return (
              <div key={idea.id} onClick={() => { setActiveIdea(idea); navGo("library"); }}
                style={{ padding: "9px 20px", cursor: "pointer", background: isActive ? C.surfaceHigh : "transparent", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent" }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = "#2E2C34")}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, marginBottom: 2 }}>{cat.icon} {cat.label}</div>
                <div style={{ fontSize: 12, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
              </div>
            );
          })}
        </div>

        {/* Canon status in nav */}
        {activeCanon.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 6 }}>CANON ACTIVE</div>
            {activeCanon.slice(0, 2).map(d => (
              <div key={d.id} style={{ fontSize: 11, color: C.green, marginBottom: 3, display: "flex", gap: 5, overflow: "hidden" }}>
                <span style={{ flexShrink: 0 }}>◈</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "13px 36px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>{centerLabels[view]}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "dashboard"    && <DashboardView />}
          {view === "capture"      && <CaptureView />}
          {view === "library"      && <LibraryView />}
          {view === "canon"        && <CanonView />}
          {view === "deliverables" && <DeliverablesView />}
        </div>
      </div>

      {/* ── RIGHT STUDIO ── */}
      <StudioPanel />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        textarea::placeholder, input::placeholder { color: ${C.textDisabled}; }
        select option { background: ${C.surface}; color: ${C.textPrimary}; }
        button { transition: opacity 0.15s; }
      `}</style>
    </div>
  );
}
