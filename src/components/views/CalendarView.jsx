import { useState, useMemo } from "react";
import { C, getCat, mono, sans } from "../../lib/constants";

function startOfMonth(d)  { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function isoDate(d)       { return d.toISOString().slice(0, 10); }
function todayStr()       { return isoDate(new Date()); }
function startOfWeek(d)   { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s; }

function formatDuration(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function CalendarView({ deliverables, calendarEvents, onToggleDeliverable, onPushToCalendar }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [calMode, setCalMode] = useState("month"); // "month" | "week"

  const today = todayStr();
  const year  = month.getFullYear();
  const mon   = month.getMonth();

  // Build month grid
  const firstDow = startOfMonth(month).getDay();
  const numDays  = daysInMonth(month);
  const cells    = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(new Date(year, mon, d));

  // Build week grid
  const weekStart = startOfWeek(selectedDay ? new Date(selectedDay + "T12:00:00") : new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Index deliverables and calendar events by date
  const delivByDate = useMemo(() => {
    const map = {};
    deliverables.forEach(d => {
      if (!d.due_date) return;
      const key = d.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deliverables]);

  const eventsByDate = useMemo(() => {
    const map = {};
    (calendarEvents || []).forEach(e => {
      const key = (e.start || "").slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [calendarEvents]);

  // Workload per day (in minutes)
  const workloadByDate = useMemo(() => {
    const map = {};
    deliverables.forEach(d => {
      if (!d.due_date || d.is_complete) return;
      const key = d.due_date.slice(0, 10);
      map[key] = (map[key] || 0) + (d.duration_minutes || 60); // default 1h if no estimate
    });
    return map;
  }, [deliverables]);

  const prevMonth = () => setMonth(new Date(year, mon - 1, 1));
  const nextMonth = () => setMonth(new Date(year, mon + 1, 1));
  const goToday   = () => { setMonth(startOfMonth(new Date())); setSelectedDay(todayStr()); };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setSelectedDay(isoDate(d));
    if (d.getMonth() !== mon) setMonth(startOfMonth(d));
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setSelectedDay(isoDate(d));
    if (d.getMonth() !== mon) setMonth(startOfMonth(d));
  };

  const selDeliv  = selectedDay ? (delivByDate[selectedDay] || []) : [];
  const selEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  const overdueCount = deliverables.filter(d => d.due_date && d.due_date.slice(0,10) < today && !d.is_complete).length;
  const noDueDate = deliverables.filter(d => !d.due_date && !d.is_complete);

  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Workload intensity: returns 0-4 scale
  const getIntensity = (mins) => {
    if (!mins || mins <= 0) return 0;
    if (mins <= 60) return 1;
    if (mins <= 120) return 2;
    if (mins <= 240) return 3;
    return 4;
  };

  const renderDayCell = (day, compact = false) => {
    if (!day) return <div key={"e" + Math.random()} />;
    const ds     = isoDate(day);
    const isToday = ds === today;
    const isSel   = ds === selectedDay;
    const dayDelivs = delivByDate[ds] || [];
    const dayEvents = eventsByDate[ds] || [];
    const overdue   = ds < today && dayDelivs.some(d => !d.is_complete);
    const open      = dayDelivs.filter(d => !d.is_complete).length;
    const done      = dayDelivs.filter(d => d.is_complete).length;
    const workload  = workloadByDate[ds] || 0;
    const intensity = getIntensity(workload);

    // Workload bar color
    const wColor = intensity === 0 ? "transparent" : intensity <= 2 ? C.gold : intensity === 3 ? C.orange || "#FFAB76" : C.red;

    return (
      <div key={ds}
        onClick={() => setSelectedDay(isSel ? null : ds)}
        style={{
          minHeight: compact ? 120 : 90, padding: "8px 8px 6px", borderRadius: 8, cursor: "pointer",
          background: isSel ? C.surfaceHigh : C.surface,
          border: `1px solid ${isToday ? C.gold : isSel ? C.border : overdue ? C.red + "40" : C.border}`,
          outline: isToday ? `2px solid ${C.gold}40` : "none",
          transition: "border-color 0.15s, background 0.15s",
          display: "flex", flexDirection: "column", gap: 4, overflow: "hidden",
        }}
        onMouseEnter={e => !isSel && (e.currentTarget.style.background = C.surfaceHigh)}
        onMouseLeave={e => !isSel && (e.currentTarget.style.background = C.surface)}>

        {/* Date + workload */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: isToday ? 600 : 400, color: isToday ? C.gold : overdue ? C.red : C.textSecondary, fontFamily: mono }}>
            {day.getDate()}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {workload > 0 && (
              <span style={{ fontSize: 10, color: wColor, fontFamily: mono }}>
                {formatDuration(workload)}
              </span>
            )}
            {open > 0 && (
              <span style={{ fontSize: 10, color: overdue ? C.red : C.textMuted, fontFamily: mono }}>
                {open}
              </span>
            )}
          </div>
        </div>

        {/* Workload density bar */}
        {intensity > 0 && (
          <div style={{ height: 2, borderRadius: 1, background: C.border }}>
            <div style={{ height: "100%", borderRadius: 1, background: wColor, width: `${Math.min(100, (workload / 480) * 100)}%`, transition: "width 0.3s" }} />
          </div>
        )}

        {/* Calendar events */}
        {dayEvents.slice(0, compact ? 3 : 2).map((ev, j) => (
          <div key={j} style={{ fontSize: 10, color: C.blue, background: C.blue + "18", padding: "2px 6px", borderRadius: 3, borderLeft: `2px solid ${C.blue}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ev.allDay ? "" : new Date(ev.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " "}
            {ev.title}
          </div>
        ))}

        {/* Deliverable chips */}
        {dayDelivs.slice(0, compact ? 4 : 3).map(d => {
          const cat = getCat(d.idea?.category);
          return (
            <div key={d.id}
              onClick={e => { e.stopPropagation(); onToggleDeliverable(d.id, d.is_complete); }}
              style={{ fontSize: 10, color: d.is_complete ? C.textDisabled : C.textSecondary, background: d.is_complete ? "transparent" : cat.color + "20", border: `1px solid ${d.is_complete ? C.borderSubtle : cat.color + "50"}`, padding: "2px 6px", borderRadius: 3, display: "flex", gap: 4, alignItems: "center", overflow: "hidden", textDecoration: d.is_complete ? "line-through" : "none", cursor: "pointer" }}
              title={d.text}>
              <span style={{ color: cat.color, flexShrink: 0 }}>{cat.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.text}</span>
              {d.duration_minutes && <span style={{ color: C.textMuted, flexShrink: 0, fontSize: 9 }}>{formatDuration(d.duration_minutes)}</span>}
            </div>
          );
        })}

        {/* Overflow */}
        {(dayDelivs.length + dayEvents.length) > (compact ? 7 : 5) && (
          <div style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>+{(dayDelivs.length + dayEvents.length) - (compact ? 7 : 5)} more</div>
        )}

        {/* Done indicator */}
        {done > 0 && open === 0 && (
          <div style={{ fontSize: 10, color: C.green, fontFamily: mono }}>✓ {done} done</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* ── Main calendar ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "24px 28px" }}>

        {/* Header: mode toggle + nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={calMode === "month" ? prevMonth : prevWeek} style={navBtn}>‹</button>
            <span style={{ fontSize: 18, color: C.textPrimary, fontWeight: 500, letterSpacing: "-0.01em", minWidth: 220, textAlign: "center" }}>
              {calMode === "month" ? monthLabel : weekLabel}
            </span>
            <button onClick={calMode === "month" ? nextMonth : nextWeek} style={navBtn}>›</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {overdueCount > 0 && (
              <span style={{ fontSize: 11, color: C.red, fontFamily: mono, border: `1px solid ${C.red}40`, padding: "3px 10px", borderRadius: 4 }}>
                {overdueCount} OVERDUE
              </span>
            )}
            {/* Mode toggle */}
            <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
              {[{ id: "month", label: "Month" }, { id: "week", label: "Week" }].map(m => (
                <button key={m.id} onClick={() => setCalMode(m.id)}
                  style={{ background: calMode === m.id ? C.gold + "20" : "transparent", border: "none", color: calMode === m.id ? C.gold : C.textMuted, padding: "5px 14px", fontSize: 11, fontFamily: mono, cursor: "pointer", letterSpacing: "0.08em" }}>
                  {m.label}
                </button>
              ))}
            </div>
            <button onClick={goToday} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, padding: "5px 14px", fontSize: 11, fontFamily: mono, cursor: "pointer", borderRadius: 4, letterSpacing: "0.08em" }}>
              TODAY
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {DOW.map(d => (
            <div key={d} style={{ fontSize: 11, color: C.textDisabled, fontFamily: mono, letterSpacing: "0.1em", textAlign: "center", padding: "4px 0" }}>{d.toUpperCase()}</div>
          ))}
        </div>

        {/* Month grid */}
        {calMode === "month" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, flex: 1, overflowY: "auto" }}>
            {cells.map((day, i) => day ? renderDayCell(day) : <div key={"e" + i} />)}
          </div>
        )}

        {/* Week grid — taller cells */}
        {calMode === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, flex: 1 }}>
            {weekDays.map(day => renderDayCell(day, true))}
          </div>
        )}

        {/* Weekly workload summary */}
        {calMode === "week" && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em" }}>WEEK WORKLOAD</span>
              <span style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>
                {formatDuration(weekDays.reduce((sum, d) => sum + (workloadByDate[isoDate(d)] || 0), 0))} committed
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, height: 32, alignItems: "flex-end" }}>
              {weekDays.map(d => {
                const ds = isoDate(d);
                const mins = workloadByDate[ds] || 0;
                const pct = Math.min(100, (mins / 480) * 100); // 8h = 100%
                const intensity = getIntensity(mins);
                const barColor = intensity === 0 ? C.border : intensity <= 2 ? C.gold : intensity === 3 ? "#FFAB76" : C.red;
                return (
                  <div key={ds} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", height: 24, background: C.bg, borderRadius: 2, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: `${Math.max(pct, 2)}%`, background: barColor, borderRadius: 2, transition: "height 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 9, color: ds === today ? C.gold : C.textDisabled, fontFamily: mono }}>{DOW[d.getDay()].charAt(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 300, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>

        {/* Selected day detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px" }}>
          {selectedDay ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 500, marginBottom: 2 }}>
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                {selectedDay < today && selectedDay !== today && (
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>Past</div>
                )}
                {selectedDay === today && (
                  <div style={{ fontSize: 11, color: C.gold, fontFamily: mono }}>TODAY</div>
                )}
                {/* Day workload total */}
                {(workloadByDate[selectedDay] || 0) > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, marginTop: 4 }}>
                    {formatDuration(workloadByDate[selectedDay])} of work scheduled
                  </div>
                )}
              </div>

              {selEvents.length === 0 && selDeliv.length === 0 && (
                <div style={{ fontSize: 11, color: C.textDisabled, fontStyle: "italic" }}>Nothing scheduled.</div>
              )}

              {selEvents.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.blue, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>CALENDAR EVENTS</div>
                  {selEvents.map((ev, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 6, marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: C.textPrimary, fontWeight: 500, marginBottom: 3 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono }}>
                        {ev.allDay ? "All day" : new Date(ev.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selDeliv.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.gold, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 8 }}>DELIVERABLES</div>
                  {selDeliv.map(d => {
                    const cat = getCat(d.idea?.category);
                    const overdue = !d.is_complete && selectedDay < today;
                    return (
                      <div key={d.id}
                        onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                        style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: C.surface, border: `1px solid ${overdue ? C.red + "50" : C.border}`, borderLeft: `3px solid ${d.is_complete ? C.green : overdue ? C.red : cat.color}`, borderRadius: 6, marginBottom: 6, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                        onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                        <div style={{ width: 16, height: 16, border: `2px solid ${d.is_complete ? C.green : overdue ? C.red : C.border}`, background: d.is_complete ? C.green + "30" : "transparent", borderRadius: 3, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {d.is_complete && <span style={{ fontSize: 10, color: C.green }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: d.is_complete ? C.textDisabled : C.textPrimary, lineHeight: 1.5, textDecoration: d.is_complete ? "line-through" : "none" }}>{d.text}</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                            {d.duration_minutes && <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>· {formatDuration(d.duration_minutes)}</span>}
                          </div>
                          {overdue && <div style={{ fontSize: 11, color: C.red, fontFamily: mono, marginTop: 2 }}>OVERDUE</div>}
                          {!d.is_complete && onPushToCalendar && (
                            <button
                              onClick={e => { e.stopPropagation(); onPushToCalendar(d); }}
                              style={{ marginTop: 4, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.blue, fontSize: 10, fontFamily: mono, padding: "3px 8px", cursor: "pointer", transition: "border-color 0.15s" }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
                              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                              Push to Google Calendar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: C.textDisabled, fontStyle: "italic" }}>Select a day to see details.</div>
          )}
        </div>

        {/* No-date deliverables */}
        {noDueDate.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 18px", maxHeight: 240, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: mono, letterSpacing: "0.1em", marginBottom: 10 }}>NO DUE DATE · {noDueDate.length}</div>
            {noDueDate.map(d => {
              const cat = getCat(d.idea?.category);
              return (
                <div key={d.id}
                  onClick={() => onToggleDeliverable(d.id, d.is_complete)}
                  style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 13, height: 13, border: `2px solid ${C.border}`, borderRadius: 3, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.text}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: cat.color, fontFamily: mono }}>{cat.icon} {cat.label}</span>
                      {d.duration_minutes && <span style={{ fontSize: 10, color: C.textMuted, fontFamily: mono }}>· {formatDuration(d.duration_minutes)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn = {
  background: "transparent", border: `1px solid #3A3A42`, color: "#C4C4CC",
  width: 30, height: 30, fontSize: 18, cursor: "pointer", borderRadius: 6,
  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
};
