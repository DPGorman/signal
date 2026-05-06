// ============================================
// SIGNAL: WhatsApp Webhook (capture-and-relay only)
// api/whatsapp.js
// ============================================
// Per 2026-05-07 decision: keep both Telegram and WhatsApp bots functional, but
// deliberately dumb. Each bot saves the raw text to the ideas table with
// source="whatsapp" and replies with a confirmation. The desktop and iOS apps
// run the rich pipeline (voice overlay analysis, lexicon writes, invitations
// with due dates, connection generation) when the user opens them.
// Rationale: keeping the bots simple means a global user on WhatsApp/Telegram
// gets zero-friction capture without us maintaining three parallel AI pipelines.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Tell Vercel to parse form-encoded bodies (how Twilio sends data)
export const config = {
  api: {
    bodyParser: {
      type: "application/x-www-form-urlencoded",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Twilio sends form-encoded data — read both cases
    const Body = req.body?.Body || req.body?.body || "";
    const From = req.body?.From || req.body?.from || "";

    console.log("Incoming WhatsApp:", { Body, From });

    if (!Body || !From) {
      return res.status(400).json({ error: "Missing body or from" });
    }

    const phoneNumber = From.replace("whatsapp:", "");
    const messageText = Body.trim();

    // Log raw message immediately so nothing is ever lost
    await supabase.from("whatsapp_messages").insert([{
      from_number: phoneNumber,
      message_body: messageText,
      processed: false,
    }]);

    // Find the user by WhatsApp number
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("whatsapp_number", phoneNumber)
      .limit(1);

    // Fallback to most recent user for single-user dev setup
    let userId;
    let projectName = "Film Series";
    const matchedUser = user?.[0];
    if (!matchedUser) {
      const { data: latestUsers } = await supabase
        .from("users")
        .select("id, project_name")
        .order("created_at", { ascending: false })
        .limit(1);
      const latestUser = latestUsers?.[0];
      userId = latestUser?.id;
      projectName = latestUser?.project_name || "Film Series";
    } else {
      userId = matchedUser.id;
      projectName = matchedUser.project_name || "Film Series";
    }

    if (!userId) {
      return sendTwilioResponse(res, "Signal: No user found. Complete onboarding in the app first.");
    }

    // Capture-and-relay only — no AI analysis here.
    // The idea sits as raw text in the ideas table. When the user next opens
    // the desktop or iOS app, the workstation runs the rich pipeline.
    const { data: savedIdea, error: ideaError } = await supabase
      .from("ideas")
      .insert([{
        user_id: userId,
        text: messageText,
        source: "whatsapp",
      }])
      .select()
      .single();

    if (ideaError) throw ideaError;

    await supabase
      .from("whatsapp_messages")
      .update({ processed: true, idea_id: savedIdea.id })
      .eq("from_number", phoneNumber)
      .eq("processed", false);

    return sendTwilioResponse(res, "◈ Signal captured. Open the app to see the analysis.");

  } catch (error) {
    console.error("Webhook error:", error);
    return sendTwilioResponse(res, "Signal received your idea. Check your library.");
  }
}

function sendTwilioResponse(res, message) {
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`);
}
