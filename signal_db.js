// ============================================
// SIGNAL: Database Client Layer
// signal_db.js
//
// This is the interface between the Signal app
// and Supabase. Every database operation goes
// through here. When we swap or upgrade the DB,
// only this file changes — not the app.
// ============================================

// Initialize Supabase client
// Replace with your actual Supabase URL and anon key from:
// https://app.supabase.com → your project → Settings → API
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// IDEAS
// ============================================

export async function saveIdea(ideaData) {
  const { data, error } = await supabase
    .from("ideas")
    .insert([ideaData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getIdeas(userId, filters = {}) {
  let query = supabase
    .from("ideas")
    .select(`
      *,
      dimensions(*),
      deliverables(*),
      connections_a:connections!connections_idea_id_a_fkey(*, idea_b:ideas!connections_idea_id_b_fkey(id, text, category)),
      connections_b:connections!connections_idea_id_b_fkey(*, idea_a:ideas!connections_idea_id_a_fkey(id, text, category))
    `)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.signalStrength) query = query.gte("signal_strength", filters.signalStrength);

  const { data, error } = await query;
  if (error) throw error;

  // Merge both connection directions into one clean array
  return data.map(idea => ({
    ...idea,
    connections: [
      ...(idea.connections_a || []).map(c => ({
        ...c,
        related_idea: c.idea_b
      })),
      ...(idea.connections_b || []).map(c => ({
        ...c,
        related_idea: c.idea_a
      }))
    ]
  }));
}

export async function updateIdea(ideaId, updates) {
  const { data, error } = await supabase
    .from("ideas")
    .update(updates)
    .eq("id", ideaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// DIMENSIONS (multi-layer tags)
// ============================================

export async function saveDimensions(ideaId, dimensions) {
  const rows = dimensions.map(label => ({
    idea_id: ideaId,
    label,
    ai_generated: true
  }));
  const { data, error } = await supabase
    .from("dimensions")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

// ============================================
// CONNECTIONS (relational memory)
// The "reason" field is everything here.
// ============================================

export async function saveConnection(ideaIdA, ideaIdB, reason, connectionType = "thematic", strength = 0.7) {
  const { data, error } = await supabase
    .from("connections")
    .upsert([{
      idea_id_a: ideaIdA,
      idea_id_b: ideaIdB,
      reason,
      connection_type: connectionType,
      strength,
      ai_generated: true
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// DELIVERABLES
// ============================================

export async function saveDeliverables(ideaId, userId, deliverables) {
  const rows = deliverables.map(text => ({
    idea_id: ideaId,
    user_id: userId,
    text
  }));
  const { data, error } = await supabase
    .from("deliverables")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

export async function toggleDeliverable(deliverableId, isComplete) {
  const { data, error } = await supabase
    .from("deliverables")
    .update({
      is_complete: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null
    })
    .eq("id", deliverableId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// CANON DOCUMENTS
// ============================================

export async function saveCanonDocument(userId, title, content, docType = "reference") {
  const { data, error } = await supabase
    .from("canon_documents")
    .insert([{ user_id: userId, title, content, doc_type: docType }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCanonDocuments(userId) {
  const { data, error } = await supabase
    .from("canon_documents")
    .select("id, title, doc_type, summary, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ============================================
// CRAWL INSIGHTS
// ============================================

export async function saveCrawlInsight(userId, insightType, title, body, ideaIds = []) {
  const { data, error } = await supabase
    .from("crawl_insights")
    .insert([{
      user_id: userId,
      insight_type: insightType,
      title,
      body,
      idea_ids: ideaIds
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUnreadInsights(userId) {
  const { data, error } = await supabase
    .from("crawl_insights")
    .select("*")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function markInsightRead(insightId) {
  const { error } = await supabase
    .from("crawl_insights")
    .update({ is_read: true })
    .eq("id", insightId);
  if (error) throw error;
}

// ============================================
// ONBOARDING
// ============================================

export async function createUser(email, displayName, projectName, projectType, whatsappNumber) {
  const { data, error } = await supabase
    .from("users")
    .insert([{
      email,
      display_name: displayName,
      project_name: projectName,
      project_type: projectType,
      whatsapp_number: whatsappNumber,
      onboarding_complete: false,
      onboarding_step: 1
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function advanceOnboarding(userId, step) {
  const isComplete = step >= 4;
  const { data, error } = await supabase
    .from("users")
    .update({
      onboarding_step: step,
      onboarding_complete: isComplete
    })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// SEMANTIC SEARCH (zettelkasten engine)
// Find ideas by MEANING using vector similarity.
// This is what makes "find everything related to
// the theme of betrayal" possible even if the
// word "betrayal" never appears.
// ============================================

export async function findSimilarIdeas(userId, embedding, limit = 5, excludeIdeaId = null) {
  // Supabase vector similarity search via RPC function
  // The SQL function for this needs to be created in Supabase:
  // See signal_schema.sql for the function definition
  const { data, error } = await supabase.rpc("match_ideas", {
    query_embedding: embedding,
    match_user_id: userId,
    match_threshold: 0.7,
    match_count: limit,
    exclude_id: excludeIdeaId
  });
  if (error) throw error;
  return data;
}
