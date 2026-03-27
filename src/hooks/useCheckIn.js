import { useState, useEffect } from "react";

const CHECK_IN_KEY = "signal_checkins";

function getCheckInRecord() {
  try {
    return JSON.parse(localStorage.getItem(CHECK_IN_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCheckInRecord(record) {
  localStorage.setItem(CHECK_IN_KEY, JSON.stringify(record));
}

function getSlotKey(type) {
  const today = new Date().toISOString().split("T")[0];
  return `${today}_${type}`;
}

function hasCheckedInToday(type) {
  const record = getCheckInRecord();
  return !!record[getSlotKey(type)];
}

function markCheckedIn(type) {
  const record = getCheckInRecord();
  record[getSlotKey(type)] = new Date().toISOString();
  saveCheckInRecord(record);
}

export function useCheckIn(deliverables = []) {
  const [checkInData, setCheckInData] = useState(null);
  const [pendingCheckIn, setPendingCheckIn] = useState(null);

  const getOverdue = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliverables.filter(d => !d.is_complete && d.due_date && new Date(d.due_date) < today);
  };

  const getToday = () => {
    const today = new Date().toISOString().split("T")[0];
    return deliverables.filter(d => !d.is_complete && d.due_date === today);
  };

  const getUpcoming = () => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + 7);
    return deliverables.filter(d => {
      if (d.is_complete || !d.due_date) return false;
      const due = new Date(d.due_date);
      return due > now && due <= cutoff;
    });
  };

  const triggerCheckIn = (type) => {
    const overdue = getOverdue();
    const today = getToday();
    const upcoming = getUpcoming();
    const data = { type, overdue, today, upcoming, timestamp: new Date().toISOString() };
    setCheckInData(data);
    setPendingCheckIn(data);
    markCheckedIn(type);
  };

  useEffect(() => {
    if (!deliverables.length) return;

    const check = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const isMorning = h === 6 && m < 10;
      const isNoon = h === 12 && m < 10;

      if (isMorning && !hasCheckedInToday("morning")) triggerCheckIn("morning");
      if (isNoon && !hasCheckedInToday("noon")) triggerCheckIn("noon");

      // Also surface overdue tasks any time on load if not yet shown today
      if (!hasCheckedInToday("load")) {
        const overdue = getOverdue();
        if (overdue.length > 0) {
          const today = getToday();
          const upcoming = getUpcoming();
          setCheckInData({ type: "load", overdue, today, upcoming, timestamp: new Date().toISOString() });
          markCheckedIn("load");
        }
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [deliverables]);

  const dismissCheckIn = () => setPendingCheckIn(null);

  return { checkInData, pendingCheckIn, dismissCheckIn, getOverdue, getToday, getUpcoming };
}
