import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function TaskTracker({ user, deliverables, setDeliverables }) {
  const [checkInData, setCheckInData] = useState(null);
  const [lastCheckIn, setLastCheckIn] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadCheckInData();
    // Check if we need a check-in on load
    checkIfCheckInNeeded();
  }, [user]);

  const loadCheckInData = async () => {
    const { data } = await supabase
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (data?.[0]) {
      setLastCheckIn(new Date(data[0].created_at));
      setCheckInData(data[0]);
    }
  };

  const checkIfCheckInNeeded = () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Check if it's 6 AM or 12 PM (within 5 minutes)
    const isMorningCheckIn = (hour === 6 && minute <= 5);
    const isNoonCheckIn = (hour === 12 && minute <= 5);
    
    if (isMorningCheckIn || isNoonCheckIn) {
      const today = now.toDateString();
      const lastCheckInDate = lastCheckIn?.toDateString();
      
      // Only trigger if we haven't checked in today at this time
      if (lastCheckInDate !== today) {
        performCheckIn(isMorningCheckIn ? "morning" : "noon");
      }
    }
  };

  const performCheckIn = async (type) => {
    const now = new Date();
    const overdueTasks = getOverdueTasks();
    const todayTasks = getTodayTasks();
    const upcomingTasks = getUpcomingTasks();
    
    // Create check-in record
    const checkInRecord = {
      user_id: user.id,
      check_in_type: type,
      overdue_count: overdueTasks.length,
      today_count: todayTasks.length,
      upcoming_count: upcomingTasks.length,
      tasks_data: {
        overdue: overdueTasks,
        today: todayTasks,
        upcoming: upcomingTasks
      }
    };

    const { data, error } = await supabase
      .from("check_ins")
      .insert([checkInRecord])
      .select()
      .single();

    if (!error && data) {
      setCheckInData(data);
      setLastCheckIn(new Date(data.created_at));
      
      // Show check-in notification if there are items to review
      if (overdueTasks.length > 0 || todayTasks.length > 0) {
        showCheckInNotification(type, overdueTasks, todayTasks, upcomingTasks);
      }
    }
  };

  const getOverdueTasks = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    return deliverables.filter(d => 
      !d.is_complete && 
      d.due_date && 
      new Date(d.due_date) < now
    );
  };

  const getTodayTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    
    return deliverables.filter(d => 
      !d.is_complete && 
      d.due_date === today
    );
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    return deliverables.filter(d => 
      !d.is_complete && 
      d.due_date && 
      new Date(d.due_date) > today && 
      new Date(d.due_date) <= nextWeek
    );
  };

  const showCheckInNotification = (type, overdue, today, upcoming) => {
    const isMonring = type === "morning";
    const greeting = isMonring ? "Good morning!" : "Midday check-in";
    
    let message = `${greeting}\n\n`;
    
    if (overdue.length > 0) {
      message += `⚠️ ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}:\n`;
      overdue.slice(0, 3).forEach(task => {
        message += `• ${task.text.slice(0, 50)}${task.text.length > 50 ? '...' : ''}\n`;
      });
      if (overdue.length > 3) message += `• ...and ${overdue.length - 3} more\n`;
      message += '\n';
    }
    
    if (today.length > 0) {
      message += `📅 ${today.length} due today:\n`;
      today.slice(0, 3).forEach(task => {
        message += `• ${task.text.slice(0, 50)}${task.text.length > 50 ? '...' : ''}\n`;
      });
      if (today.length > 3) message += `• ...and ${today.length - 3} more\n`;
      message += '\n';
    }
    
    if (upcoming.length > 0) {
      message += `🔄 ${upcoming.length} coming up this week:\n`;
      upcoming.slice(0, 2).forEach(task => {
        const dueDate = new Date(task.due_date).toLocaleDateString();
        message += `• ${task.text.slice(0, 40)} (${dueDate})\n`;
      });
      if (upcoming.length > 2) message += `• ...and ${upcoming.length - 2} more\n`;
    }

    // For now, we'll use browser notification API
    // In production, this should integrate with Signal's notification system
    if (Notification.permission === "granted") {
      new Notification(`Signal ${greeting}`, {
        body: message.replace(/\n/g, ' '),
        icon: "/favicon.ico"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(`Signal ${greeting}`, {
            body: message.replace(/\n/g, ' '),
            icon: "/favicon.ico"
          });
        }
      });
    }
    
    // Also store in localStorage for dashboard display
    localStorage.setItem('signal_last_checkin', JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      message,
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length
    }));
  };

  const markTaskComplete = async (taskId) => {
    const { error } = await supabase
      .from("deliverables")
      .update({ is_complete: true, completed_at: new Date().toISOString() })
      .eq("id", taskId);
    
    if (!error) {
      // Update local state
      setDeliverables(prev => 
        prev.map(d => 
          d.id === taskId 
            ? { ...d, is_complete: true, completed_at: new Date().toISOString() }
            : d
        )
      );
      
      // Check if this was an overdue item that's now complete
      checkCompletionProgress();
    }
  };

  const checkCompletionProgress = () => {
    // This will be used to detect when overdue items are completed
    // and potentially reduce future check-in frequency or adjust priorities
    const completedToday = deliverables.filter(d => 
      d.is_complete && 
      d.completed_at && 
      new Date(d.completed_at).toDateString() === new Date().toDateString()
    );
    
    if (completedToday.length > 0) {
      console.log(`${completedToday.length} tasks completed today - good progress!`);
    }
  };

  // Component doesn't render UI - it's a background service
  // In the future, this could return a check-in dashboard widget
  return null;
}