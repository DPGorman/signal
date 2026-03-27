/**
 * priorityEngine.js
 * Zettelkasten-style priority analysis for Signal deliverables.
 * Surfaces conflicts, urgency, and what to focus on today.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Extract tags/keywords from text for overlap detection */
function extractKeywords(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
}

/** Check if two deliverables are related (shared project, tags, or keyword overlap) */
function areRelated(a, b) {
  if (a.id === b.id) return false;

  // Same project
  if (a.project_id && b.project_id && a.project_id === b.project_id) return true;

  // Keyword overlap (≥2 shared meaningful words)
  const aWords = new Set(extractKeywords(a.text));
  const bWords = extractKeywords(b.text);
  const shared = bWords.filter(w => aWords.has(w));
  if (shared.length >= 2) return true;

  return false;
}

/**
 * getPriorityConflicts(deliverables, connections)
 * Returns array of conflict objects: { task, conflictsWith, reason }
 */
export function getPriorityConflicts(deliverables = [], connections = []) {
  const conflicts = [];
  const active = deliverables.filter(d => !d.is_complete && d.due_date);

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const aDue = new Date(a.due_date).getTime();
      const bDue = new Date(b.due_date).getTime();
      const dateDiff = Math.abs(aDue - bDue);

      if (dateDiff <= 2 * DAY_MS && areRelated(a, b)) {
        conflicts.push({
          task: a,
          conflictsWith: b,
          reason: `Both due around ${new Date(Math.min(aDue, bDue)).toLocaleDateString()} and appear related`,
          severity: dateDiff <= DAY_MS ? "high" : "medium",
        });
      }
    }
  }

  // Also check connections for explicit links that create pressure
  if (connections && connections.length) {
    connections.forEach(conn => {
      const from = deliverables.find(d => d.id === conn.from_id);
      const to = deliverables.find(d => d.id === conn.to_id);
      if (!from || !to) return;
      if (!from.is_complete && !to.is_complete && from.due_date && to.due_date) {
        const fromDue = new Date(from.due_date).getTime();
        const toDue = new Date(to.due_date).getTime();
        // If a linked item is due before the item that depends on it
        if (toDue < fromDue) {
          conflicts.push({
            task: from,
            conflictsWith: to,
            reason: `"${to.text.slice(0, 40)}" is linked and due first`,
            severity: "high",
          });
        }
      }
    });
  }

  return conflicts;
}

/**
 * getTodayFocus(deliverables, connections)
 * Returns { urgent, important, upcoming, conflicts }
 */
export function getTodayFocus(deliverables = [], connections = []) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayStart = new Date(todayStr).getTime();

  const urgent = [];
  const important = [];
  const upcoming = [];

  deliverables
    .filter(d => !d.is_complete)
    .forEach(d => {
      if (!d.due_date) {
        // No due date — low priority unless recently created
        return;
      }
      const due = new Date(d.due_date).getTime();
      const daysUntilDue = (due - todayStart) / DAY_MS;

      if (daysUntilDue < 0) {
        // Overdue
        urgent.push({ ...d, daysOverdue: Math.abs(Math.floor(daysUntilDue)) });
      } else if (daysUntilDue <= 1) {
        // Due today or tomorrow
        urgent.push({ ...d, daysUntilDue: Math.floor(daysUntilDue) });
      } else if (daysUntilDue <= 4) {
        // Due within 4 days
        important.push({ ...d, daysUntilDue: Math.floor(daysUntilDue) });
      } else if (daysUntilDue <= 10) {
        upcoming.push({ ...d, daysUntilDue: Math.floor(daysUntilDue) });
      }
    });

  const conflicts = getPriorityConflicts(deliverables, connections);

  return { urgent, important, upcoming, conflicts };
}
