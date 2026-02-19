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
  const [studio,        setStudio]        = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioTab,     setStudioTab]     = useState("insight");
  const [auditing,      setAuditing]      = useState(false);

  const fileInputRef = useRef(null);
  const studioFired  = useRef(false);

  useEffect(() => {
    const uid = localStorage.getItem("signal_user_id");
    if (uid) {
      loadAll(uid);
    } else {
      supabase.from("users").select("id").order("created_at", { ascending: false }).limit(1).single()
        .then(({ data }) => {
          if (data?.id) { localStorage.setItem("signal_user_id", data.id); loadAll(data.id); }
          else setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (ideas.length > 1 && user && !studioFired.current && !studioLoading) {
      studioFired.current = true;
      runStudio(ideas, user);
    }
  }, [ideas, user]); // eslint-disable-line

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
    } catch (e) { console.error("loadAll:", e); }
    finally { setIsLoading(false); }
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
    notify("Reading your library...", "processing");
    try {
      const allIdeas = ideas.map(i => `ID:${i.id} [${i.category}] "${i.text}"`).join("\n");
      const result = await callAI(
        `You are cleaning a creative idea database. Delete without mercy:

1. Any idea containing the words "test", "not a capture", "for the platform", or clearly written to test the system rather than capture a real creative idea
2. Any idea that is essentially the same as another idea — even if phrased slightly differently. When two ideas convey the same story beat, character note, or premise, keep only the single clearest articulation and delete the rest
3. Sentence fragments or incomplete thoughts fully covered by a more complete version

Be decisive. If something looks like a test or a duplicate, it is. Return the IDs to delete.

Return ONLY raw JSON — no other text:
{ "toDelete": ["id1","id2"], "summary": "one sentence saying what was removed" }
If nothing to remove: { "toDelete": [], "summary": "Library is clean." }`,
        `ALL IDEAS:\n${allIdeas}`,
        800
      );
      if (result.toDelete?.length > 0) {
        for (const id of result.toDelete) {
          await supabase.from("deliverables").delete().eq("idea_id", id);
          await supabase.from("dimensions").delete().eq("idea_id", id);
          await supabase.from("ideas").delete().eq("id", id);
        }
        studioFired.current = false;
        await loadAll(user.id);
        notify(result.summary, "success");
      } else {
        notify(result.summary, "info");
      }
    } catch (e) { console.error("Audit:", e); notify("Audit failed.", "error"); }
    finally { setAuditing(false); }
  };

  const captureIdea = async () => {
    if (!input.trim() || !user || isAnalyzing) return;
    const text = input.trim();
    const ctx  = context.trim();
    setInput(""); setContext("");
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
      }]).select().single();

      if (error) { notify("Failed to save.", "error"); return; }

      if (analysis.dimensions?.length)
        await supabase.from("dimensions").insert(
          analysis.dimensions.map(label => ({ idea_id: saved.id, label }))
        );
      if (analysis.invitations?.length)
        await supabase.from("deliverables").insert(
          analysis.invitations.map(t => ({ idea_id: saved.id, user_id: user.id, text: t }))
        );

      await loadAll(user.id);
      setActiveIdea({ ...saved, dimensions: (analysis.dimensions || []).map(label => ({ label })) });
      setView("library");
      notify("Signal captured.", "success");
      studioFired.current = false;
    } catch (e) { console.error("Capture:", e); notify("Analysis failed.", "error"); }
    finally { setIsAnalyzing(false); }
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
      notify("Added to Canon.", "success");
    } catch { notify("Upload failed.", "error"); }
    finally { setIsUploading(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    notify("Reading file...", "processing");
    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Send to server for proper parsing
      const res = await fetch("/api/parse-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: base64, filename: file.name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCanonUpload(p => ({ ...p, content: data.text, title: p.title || name }));
      notify("File loaded.", "success");
    } catch (err) {
      console.error("File read error:", err);
      notify("Could not read file — try pasting the text directly.", "error");
    }
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
    if (idea) setActiveIdea(idea);
    else if (v !== "library") { setActiveIdea(null); setActiveDoc(null); }
  };

  const pending     = deliverables.filter(d => !d.is_complete);
  const activeCanon = canonDocs.filter(d => d.is_active);
  const filtered    = filterCat ? ideas.filter(i => i.category === filterCat) : ideas;
  const mono        = "'Google Sans Mono', 'Roboto Mono', monospace";
  const serif       = "'Google Sans', 'Inter', system-ui, sans-serif";

  const inputBase = {
    width: "100%", background: C.surfaceHigh, border: `1px solid ${C.border}`,
    color: C.textPrimary, padding: "11px 14px", fontFamily: serif,
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

      {/* Stat tiles — all clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 44 }}>
        {[
          { label: "Ideas",       value: ideas.length,   color: C.gold,   sub: `${ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length} this week`, dest: "library" },
          { label: "Invitations", value: pending.length, color: C.red,    sub: `${deliverables.filter(d => d.is_complete).length} completed`,  dest: "deliverables" },
          { label: "High Signal", value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, sub: "worth pursuing", dest: "library" },
          { label: "Canon",       value: activeCanon.length, color: C.purple, sub: "active documents", dest: "canon" },
        ].map(s => (
          <div key={s.label} onClick={() => navGo(s.dest)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "20px 18px", cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ fontSize: 40, color: s.color, fontStyle: "italic", lineHeight: 1, marginBottom: 10 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: C.textPrimary, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent captures — contained box */}
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

      {/* Open invitations — contained box */}
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

      {/* Signal distribution — contained, categories clickable */}
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

      {/* Canon — contained, each doc clickable */}
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
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) captureIdea(); }}
          placeholder="Don't edit. Don't qualify. Just send the signal."
          rows={5}
          style={{ ...inputBase, fontSize: 16, lineHeight: 1.9, resize: "vertical", marginBottom: 16 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 8 }}>
          WHY DOES THIS FEEL IMPORTANT? <span style={{ color: C.textDisabled }}>(optional)</span>
        </div>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. it reframes the protagonist's entire moral logic..."
          style={{ ...inputBase, marginBottom: 24 }}
          onFocus={e => e.target.style.borderColor = C.gold}
          onBlur={e => e.target.style.borderColor = C.border} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono }}>⌘ + ENTER</span>
          <button onClick={captureIdea} disabled={isAnalyzing || !input.trim()}
            style={{
              background: isAnalyzing || !input.trim() ? C.surfaceHigh : C.gold,
              color: isAnalyzing || !input.trim() ? C.textMuted : C.bg,
              border: "none", padding: "12px 32px", fontFamily: mono, fontSize: 11,
              letterSpacing: "0.1em", cursor: isAnalyzing || !input.trim() ? "default" : "pointer",
            }}>
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
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* List */}
        <div style={{ width: 300, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setFilterCat(null)}
              style={{ background: !filterCat ? C.gold : "transparent", color: !filterCat ? C.bg : C.textMuted, border: `1px solid ${!filterCat ? C.gold : C.border}`, padding: "3px 10px", fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
              ALL {ideas.length}
            </button>
            {CATEGORIES.filter(cat => ideas.some(i => i.category === cat.id)).map(cat => (
              <button key={cat.id} onClick={() => setFilterCat(cat.id === filterCat ? null : cat.id)}
                style={{ background: filterCat === cat.id ? cat.color : "transparent", color: filterCat === cat.id ? C.bg : C.textMuted, border: `1px solid ${filterCat === cat.id ? cat.color : C.border}`, padding: "3px 10px", fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {filtered.length === 0
            ? <div style={{ padding: 40, color: C.textDisabled, fontStyle: "italic" }}>Nothing here yet.</div>
            : filtered.map(idea => {
                const cat = getCat(idea.category);
                const isActive = displayIdea?.id === idea.id;
                const daysAgo = Math.floor((Date.now() - new Date(idea.created_at)) / 864e5);
                return (
                  <div key={idea.id} onClick={() => setActiveIdea(idea)}
                    style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSubtle}`, borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent", background: isActive ? C.surfaceHigh : "transparent", cursor: "pointer" }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize: 10, color: C.textDisabled, fontFamily: mono }}>{daysAgo === 0 ? "today" : `${daysAgo}d`}{idea.signal_strength >= 4 ? " ◈" : ""}</span>
                    </div>
                    <div style={{ fontSize: 13, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
                    {idea.signal_strength >= 4 && <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, marginTop: 6 }}>◈ HIGH SIGNAL</div>}
                  </div>
                );
              })
          }
        </div>

        {/* Detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: "48px 56px" }}>
          {!displayIdea
            ? <div style={{ color: C.textDisabled, fontStyle: "italic" }}>No ideas yet.</div>
            : (() => {
                const cat = getCat(displayIdea.category);
                const ideaDels = deliverables.filter(d => d.idea_id === displayIdea.id);
                return (
                  <div style={{ maxWidth: 640 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                      <span style={{ fontSize: 11, color: cat.color, fontFamily: mono, letterSpacing: "0.1em" }}>{cat.icon} {cat.label.toUpperCase()}</span>
                      {displayIdea.signal_strength >= 4 && (
                        <span style={{ fontSize: 10, color: C.gold, fontFamily: mono, border: `1px solid ${C.gold}40`, padding: "2px 10px" }}>HIGH SIGNAL</span>
                      )}
                      <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono, marginLeft: "auto" }}>
                        {new Date(displayIdea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <div style={{ fontSize: 22, color: C.textPrimary, lineHeight: 1.9, marginBottom: 36, fontFamily: serif }}>{displayIdea.text}</div>

                    {displayIdea.inspiration_question && (
                      <div style={{ marginBottom: 32, padding: "16px 20px", background: C.surfaceHigh, borderLeft: `3px solid ${C.textMuted}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>WHY IT FELT IMPORTANT</div>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.85, fontStyle: "italic" }}>{displayIdea.inspiration_question}</div>
                      </div>
                    )}

                    {displayIdea.ai_note && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>DRAMATURGICAL ANALYSIS</div>
                        <div style={{ fontSize: 16, color: C.textSecondary, lineHeight: 1.9 }}>{displayIdea.ai_note}</div>
                      </div>
                    )}

                    {displayIdea.canon_resonance && (
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ fontSize: 10, color: C.purple, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON RESONANCE</div>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.85 }}>{displayIdea.canon_resonance}</div>
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
      </div>
    );
  };

  const CanonView = () => (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
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
            <input type="file" accept="*/*" ref={fileInputRef} onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, padding: "8px", fontFamily: mono, fontSize: 10, cursor: "pointer", marginBottom: 8 }}>
              {canonUpload.content ? "✓ FILE LOADED — REPLACE" : "UPLOAD FILE (.txt .md .docx .pdf)"}
            </button>
            <textarea value={canonUpload.content} onChange={e => setCanonUpload(p => ({ ...p, content: e.target.value }))}
              placeholder="Or paste text directly here..."
              rows={4}
              style={{ ...inputBase, fontSize: 13, resize: "vertical", marginBottom: 8 }} />
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
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: doc.is_active ? C.textPrimary : C.textMuted }}>{doc.title}</span>
                    <span style={{ fontSize: 10, color: doc.is_active ? C.green : C.textDisabled, fontFamily: mono }}>{doc.is_active ? "ON" : "OFF"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 8 }}>{doc.content?.length?.toLocaleString()} chars</div>
                  <div style={{ display: "flex", gap: 6 }}>
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

      <div style={{ flex: 1, overflowY: "auto", padding: "36px 44px" }}>
        {!activeDoc
          ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 15 }}>Select a document.</div>
          : (
            <div style={{ maxWidth: 680 }}>
              <div style={{ fontSize: 22, color: C.textPrimary, marginBottom: 6 }}>{activeDoc.title}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginBottom: 32 }}>{activeDoc.content?.length?.toLocaleString()} chars · {activeDoc.is_active ? "active" : "inactive"}</div>
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
      ...cat, items: pending.filter(d => d.idea?.category === cat.id),
    })).filter(cat => cat.items.length > 0);

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textSecondary }}>{pending.length} open · {completed.length} complete</span>
              <span style={{ fontSize: 13, color: C.gold, fontFamily: mono }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
              <div style={{ height: "100%", background: C.gold, width: `${pct}%`, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>

          {pending.length === 0
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 16 }}>All invitations complete.</div>
            : byCategory.map(cat => (
                <div key={cat.id} style={{ marginBottom: 36 }}>
                  <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 14 }}>{cat.icon} {cat.label.toUpperCase()}</div>
                  {cat.items.map(d => (
                    <div key={d.id} onClick={() => toggleDeliverable(d.id, d.is_complete)}
                      style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.75 }}>{d.text}</div>
                        {d.idea?.text && (
                          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 5 }}>from: "{d.idea.text.slice(0, 70)}..."</div>
                        )}
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

  const StudioPanel = () => (
    <div style={{ width: 268, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 12 }}>STUDIO</div>
        <div style={{ display: "flex" }}>
          {[{ id: "insight", label: "Insight" }, { id: "patterns", label: "Patterns" }, { id: "stats", label: "Stats" }].map(t => (
            <button key={t.id} onClick={() => setStudioTab(t.id)}
              style={{ background: "transparent", border: "none", borderBottom: studioTab === t.id ? `2px solid ${C.gold}` : "2px solid transparent", color: studioTab === t.id ? C.textPrimary : C.textMuted, padding: "6px 12px 10px", fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>

        {studioTab === "insight" && (
          studioLoading
            ? <div style={{ color: C.textDisabled, fontStyle: "italic", fontSize: 13, lineHeight: 1.8 }}>Reading your project...</div>
            : studio ? (
              <div>
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10, color: C.gold, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>PROVOCATION</div>
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
            ) : ideas.length < 2
              ? <div style={{ fontSize: 13, color: C.textDisabled, fontStyle: "italic", lineHeight: 1.8 }}>Capture a few ideas to activate the Studio.</div>
              : <button onClick={() => runStudio(ideas, user)}
                  style={{ width: "100%", background: C.gold, border: "none", color: C.bg, padding: "10px", fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                  GENERATE INSIGHT →
                </button>
        )}

        {studioTab === "patterns" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 8 }}>LIBRARY AUDIT</div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7, marginBottom: 10 }}>AI removes duplicates and test entries. Keeps the best version of each.</div>
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
                    <div key={cat.id} onClick={() => { setFilterCat(cat.id); navGo("library"); }}
                      style={{ marginBottom: 10, cursor: "pointer" }}>
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

        {studioTab === "stats" && (
          <div>
            {[
              { label: "Total Ideas",  value: ideas.length,   color: C.gold,   dest: "library"      },
              { label: "This Week",    value: ideas.filter(i => Date.now() - new Date(i.created_at) < 7*864e5).length, color: C.blue, dest: "library" },
              { label: "High Signal",  value: ideas.filter(i => i.signal_strength >= 4).length, color: C.green, dest: "library" },
              { label: "Via WhatsApp", value: ideas.filter(i => i.source === "whatsapp").length, color: C.purple, dest: "library" },
              { label: "Open Actions", value: pending.length, color: C.red,    dest: "deliverables" },
              { label: "Canon Docs",   value: activeCanon.length, color: C.green, dest: "canon"     },
            ].map(s => (
              <div key={s.label} onClick={() => navGo(s.dest)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 13, color: C.textSecondary }}>{s.label}</span>
                <span style={{ fontSize: 22, color: s.color, fontStyle: "italic" }}>{s.value}</span>
              </div>
            ))}

            {activeCanon.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.12em", marginBottom: 10 }}>CANON ACTIVE</div>
                {activeCanon.map(d => (
                  <div key={d.id} onClick={() => { setActiveDoc(d); navGo("canon"); }}
                    style={{ fontSize: 12, color: C.green, marginBottom: 6, display: "flex", gap: 6, cursor: "pointer" }}>
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

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.textPrimary, overflow: "hidden" }}>

      {notification && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceHigh, border: `1px solid ${notification.type === "success" ? C.green : notification.type === "error" ? C.red : C.border}`, color: C.textPrimary, padding: "10px 22px", fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", zIndex: 1000 }}>
          {notification.msg}
        </div>
      )}

      {/* LEFT NAV */}
      <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "26px 22px 18px", cursor: "pointer" }} onClick={() => navGo("dashboard")}>
          <div style={{ fontSize: 20, color: C.textPrimary, fontStyle: "italic", letterSpacing: "-0.02em" }}>signal</div>
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em", marginTop: 3 }}>{user.project_name?.toUpperCase()}</div>
        </div>

        <nav>
          {[
            { id: "dashboard",    label: "Dashboard",    badge: null },
            { id: "capture",      label: "Capture",      badge: null },
            { id: "library",      label: "Library",      badge: ideas.length || null },
            { id: "canon",        label: "Canon",        badge: activeCanon.length || null },
            { id: "deliverables", label: "Deliverables", badge: pending.length || null },
          ].map(item => (
            <div key={item.id} onClick={() => navGo(item.id)}
              style={{ padding: "11px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: view === item.id ? C.surfaceHigh : "transparent", borderLeft: view === item.id ? `3px solid ${C.gold}` : "3px solid transparent" }}
              onMouseEnter={e => view !== item.id && (e.currentTarget.style.background = C.surfaceHigh)}
              onMouseLeave={e => view !== item.id && (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 15, color: view === item.id ? C.textPrimary : C.textSecondary }}>{item.label}</span>
              {item.badge ? <span style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>{item.badge}</span> : null}
            </div>
          ))}
        </nav>

        <div style={{ padding: "14px 20px 6px", fontSize: 10, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>RECENT</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {ideas.slice(0, 8).map(idea => {
            const cat = getCat(idea.category);
            const isActive = activeIdea?.id === idea.id;
            return (
              <div key={idea.id} onClick={() => navGo("library", idea)}
                style={{ padding: "9px 20px", cursor: "pointer", background: isActive ? C.surfaceHigh : "transparent", borderLeft: isActive ? `3px solid ${cat.color}` : "3px solid transparent" }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.surfaceHigh)}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontSize: 10, color: cat.color, fontFamily: mono, marginBottom: 2 }}>{cat.icon} {cat.label}</div>
                <div style={{ fontSize: 12, color: isActive ? C.textPrimary : C.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.text}</div>
              </div>
            );
          })}
        </div>

        {activeCanon.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, cursor: "pointer" }} onClick={() => navGo("canon")}>
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

      {/* CENTER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "13px 36px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.15em" }}>
            {{ dashboard: "OVERVIEW", capture: "CAPTURE", library: "LIBRARY", canon: "CANON", deliverables: "DELIVERABLES" }[view]}
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {view === "dashboard"    && <DashboardView />}
          {view === "capture"      && <CaptureView />}
          {view === "library"      && <LibraryView />}
          {view === "canon"        && <CanonView />}
          {view === "deliverables" && <DeliverablesView />}
        </div>
      </div>

      {/* RIGHT STUDIO */}
      <StudioPanel />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&family=Google+Sans+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Google Sans', 'Inter', system-ui, sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        textarea::placeholder, input::placeholder { color: ${C.textDisabled}; font-family: 'Google Sans', system-ui, sans-serif; }
        select option { background: ${C.surface}; color: ${C.textPrimary}; }
        button { transition: opacity 0.15s; font-family: 'Google Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
