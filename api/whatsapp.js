// ============================================
// SIGNAL: WhatsApp Webhook
// api/whatsapp.js
//
// This runs on Vercel as a serverless function.
// Twilio calls this URL every time you send a
// WhatsApp message to the sandbox number.
// It saves the message to Supabase and runs
// it through the AI analyzer.
// ============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { Body, From } = req.body;

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
      .single();

    // If no user found, get the most recent user as fallback
    // (works for single-user setup during development)
    let userId;
    if (!user) {
      const { data: latestUser } = await supabase
        .from("users")
        .select("id, project_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      userId = latestUser?.id;
    } else {
      userId = user.id;
    }

    if (!userId) {
      return sendTwilioResponse(res, "Signal: No user found. Complete onboarding at signal-navy-five.vercel.app first.");
    }

    // Run the idea through the AI analyzer
    const analysis = await analyzeWithAI(messageText, user?.project_name || "Film Series");

    // Save the idea to Supabase
    const { data: savedIdea, error: ideaError } = await supabase
      .from("ideas")
      .insert([{
        user_id: userId,
        text: messageText,
        source: "whatsapp",
        category: analysis.category || "premise",
        ai_note: analysis.aiNote || "",
        inspiration_question: analysis.inspirationQuestion,
        signal_strength: analysis.signalStrength || 3,
      }])
      .select()
      .single();

    if (ideaError) throw ideaError;

    // Save dimensions
    if (analysis.dimensions?.length) {
      await supabase.from("dimensions").insert(
        analysis.dimensions.map(label => ({ idea_id: savedIdea.id, label }))
      );
    }

    // Save deliverables
    if (analysis.deliverables?.length) {
      await supabase.from("deliverables").insert(
        analysis.deliverables.map(text => ({
          idea_id: savedIdea.id,
          user_id: userId,
          text
        }))
      );
    }

    // Mark raw message as processed
    await supabase
      .from("whatsapp_messages")
      .update({ processed: true, idea_id: savedIdea.id })
      .eq("from_number", phoneNumber)
      .eq("processed", false);

    // Send confirmation back to WhatsApp
    const categoryEmoji = {
      premise: "◈", character: "◉", scene: "◫", dialogue: "◌",
      arc: "◎", production: "◧", research: "◐", business: "◑"
    }[analysis.category] || "◈";

    const replyMessage = `${categoryEmoji} Signal captured.

${analysis.aiNote}

${analysis.dimensions?.length ? `Operating on: ${analysis.dimensions.join(", ")}` : ""}

${analysis.deliverables?.length ? `\nNext: ${analysis.deliverables[0]}` : ""}

View at signal-navy-five.vercel.app`;

    return sendTwilioResponse(res, replyMessage);

  } catch (error) {
    console.error("Webhook error:", error);
    return sendTwilioResponse(res, "Signal received your idea. Processing error — check your library.");
  }
}

// ── AI Analysis ──────────────────────────────
async function analyzeWithAI(text, projectName) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a brilliant script editor and dramaturg. Analyze ideas across MULTIPLE dimensions simultaneously.
Respond ONLY with JSON (no markdown):
- category: one of [premise,character,scene,dialogue,arc,production,research,business]
- dimensions: array of 2-4 strings (multiple levels this idea operates on)
- aiNote: 1-2 sentences of genuine dramaturgical insight
- deliverables: array of 2-3 next steps as invitations not tasks
- inspirationQuestion: one question to capture why this felt important
- signalStrength: integer 1-5`,
        messages: [{
          role: "user",
          content: `Project: ${projectName}\n\nIdea captured via WhatsApp: "${text}"`
        }],
      }),
    });

    const data = await response.json();
    return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
  } catch {
    return {
      category: "premise",
      dimensions: ["story", "character"],
      aiNote: "This idea has layers worth exploring.",
      deliverables: ["Expand in 3 sentences", "Connect to your protagonist's arc"],
      inspirationQuestion: "What made this feel important?",
      signalStrength: 3,
    };
  }
}

// ── Twilio Response ───────────────────────────
function sendTwilioResponse(res, message) {
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`);
}
