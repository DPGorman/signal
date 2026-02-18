// ============================================
// SIGNAL: WhatsApp Webhook
// api/whatsapp.js
// ============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
      .single();

    // Fallback to most recent user for single-user dev setup
    let userId;
    let projectName = "Film Series";
    if (!user) {
      const { data: latestUser } = await supabase
        .from("users")
        .select("id, project_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      userId = latestUser?.id;
      projectName = latestUser?.project_name || "Film Series";
    } else {
      userId = user.id;
      projectName = user.project_name || "Film Series";
    }

    if (!userId) {
      return sendTwilioResponse(res, "Signal: No user found. Complete onboarding at signal-navy-five.vercel.app first.");
    }

    // Run the idea through the AI analyzer
    const analysis = await analyzeWithAI(messageText, projectName);
    console.log("AI Analysis:", analysis);

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

    if (analysis.dimensions?.length) {
      await supabase.from("dimensions").insert(
        analysis.dimensions.map(label => ({ idea_id: savedIdea.id, label }))
      );
    }

    if (analysis.deliverables?.length) {
      await supabase.from("deliverables").insert(
        analysis.deliverables.map(text => ({
          idea_id: savedIdea.id,
          user_id: userId,
          text
        }))
      );
    }

    await supabase
      .from("whatsapp_messages")
      .update({ processed: true, idea_id: savedIdea.id })
      .eq("from_number", phoneNumber)
      .eq("processed", false);

    const categoryEmoji = {
      premise: "◈", character: "◉", scene: "◫", dialogue: "◌",
      arc: "◎", production: "◧", research: "◐", business: "◑"
    }[analysis.category] || "◈";

    const replyMessage = `${categoryEmoji} Signal captured.

${analysis.aiNote}

Operating on: ${analysis.dimensions?.join(", ") || "story"}

Next: ${analysis.deliverables?.[0] || "Sit with this idea"}

signal-navy-five.vercel.app`;

    return sendTwilioResponse(res, replyMessage);

  } catch (error) {
    console.error("Webhook error:", error);
    return sendTwilioResponse(res, "Signal received your idea. Check your library.");
  }
}

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
Respond ONLY with a raw JSON object — no markdown, no backticks, no explanation:
{
  "category": one of [premise,character,scene,dialogue,arc,production,research,business],
  "dimensions": array of 2-4 strings,
  "aiNote": "1-2 sentences of genuine dramaturgical insight",
  "deliverables": array of 2-3 next steps as invitations,
  "inspirationQuestion": "one question",
  "signalStrength": integer 1-5
}`,
        messages: [{
          role: "user",
          content: `Project: ${projectName}\n\nIdea: "${text}"`
        }],
      }),
    });

    const data = await response.json();
    console.log("Anthropic raw response:", JSON.stringify(data));
    const raw = data.content[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error("AI analysis error:", e);
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

function sendTwilioResponse(res, message) {
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`);
}
