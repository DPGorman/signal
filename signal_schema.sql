-- ============================================
-- SIGNAL: Creative Execution System
-- Supabase PostgreSQL Schema v1.0
-- ============================================

-- Enable vector extension for semantic/meaning-based search
-- This is what powers the zettelkasten: finding ideas by MEANING not keyword
create extension if not exists vector;

-- ============================================
-- USERS
-- Designed for onboarding: every user gets a
-- project_type, so the schema serves filmmakers,
-- architects, musicians, entrepreneurs equally
-- ============================================
create table users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique,
  display_name text,
  project_name text,           -- "My Film Series", "Album 2025", etc.
  project_type text default 'film_series', -- film_series | feature | album | startup | other
  whatsapp_number text unique, -- links WhatsApp messages to this user
  onboarding_complete boolean default false,
  onboarding_step int default 0 -- tracks where they are in setup
);

-- ============================================
-- CANON DOCUMENTS
-- The "rules before breaking them" layer.
-- Documents that condition all AI analysis.
-- Stored with embeddings so AI can retrieve
-- relevant Canon passages for any new idea.
-- ============================================
create table canon_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references users(id) on delete cascade,
  title text not null,                        -- "Stranger Things Bible", "Egri - Dramatic Writing"
  doc_type text default 'reference',          -- reference | premise | character_bible | tone_guide | research
  content text not null,                      -- full text content
  summary text,                               -- AI-generated 2-3 sentence summary
  embedding vector(1536),                     -- semantic embedding for meaning-based retrieval
  is_active boolean default true              -- can disable without deleting
);

-- ============================================
-- IDEAS
-- The core capture unit. Every idea that enters
-- Signal lives here permanently.
-- The embedding column is what makes relational
-- memory possible: the AI can find ideas that
-- are SEMANTICALLY related even if they share
-- no keywords.
-- ============================================
create table ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references users(id) on delete cascade,
  
  -- The raw capture
  text text not null,
  source text default 'app',        -- app | whatsapp | voice | email
  
  -- AI analysis
  category text,                    -- premise | character | scene | dialogue | arc | production | research | business
  ai_note text,                     -- dramaturgical analysis
  inspiration_note text,            -- why this felt important (user-provided or AI-prompted)
  inspiration_question text,        -- the question the AI asked to capture context
  
  -- Zettelkasten layer: meaning-based connections
  embedding vector(1536),           -- semantic vector - this is what finds related ideas by MEANING
  
  -- Canon relationship
  canon_resonance text,             -- how this idea relates to or pushes against Canon docs
  canon_tension text,               -- if this BREAKS Canon interestingly, noted here
  
  -- Status
  is_archived boolean default false,
  signal_strength int default 3     -- 1-5: how strong is this signal? AI-assessed, user can override
);

-- ============================================
-- DIMENSIONS
-- The multi-layer tagging system.
-- One idea can operate on many levels simultaneously:
-- "fight scene" AND "premise encapsulation" AND "character arc pivot"
-- This is the core of the zettelkasten.
-- ============================================
create table dimensions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas(id) on delete cascade,
  label text not null,             -- "character arc", "premise", "structural pivot", etc.
  dimension_type text,             -- plot | character | theme | premise | structure | world | tone
  ai_generated boolean default true
);

-- ============================================
-- CONNECTIONS
-- Explicit relational links between ideas.
-- The "reason" field is critical: it stores WHY
-- these ideas are connected, not just that they are.
-- This is what prevents the "fight scene" problem:
-- the connection reason might say "this dialogue
-- also encapsulates the series premise."
-- ============================================
create table connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  idea_id_a uuid references ideas(id) on delete cascade,
  idea_id_b uuid references ideas(id) on delete cascade,
  reason text not null,            -- WHY are these connected? This is the memory.
  connection_type text,            -- thematic | structural | character | causal | contradicts | evolves
  strength float default 0.7,      -- 0-1: how strong is this connection?
  ai_generated boolean default true,
  user_confirmed boolean default false,
  unique(idea_id_a, idea_id_b)
);

-- ============================================
-- DELIVERABLES
-- Action items that emerge from ideas.
-- Framed as invitations, tracked as work product.
-- ============================================
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  idea_id uuid references ideas(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  text text not null,              -- the deliverable/invitation text
  is_complete boolean default false,
  completed_at timestamptz,
  priority int default 2,          -- 1=high, 2=medium, 3=low
  due_date date
);

-- ============================================
-- CRAWL INSIGHTS
-- This is the re-crawl engine's output.
-- Periodically, the AI reviews the entire idea
-- database and discovers new connections,
-- upgraded significance, forgotten signals.
-- Each insight is stored here with timestamp
-- so you can see how the understanding evolves.
-- ============================================
create table crawl_insights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references users(id) on delete cascade,
  insight_type text,               -- new_connection | upgraded_signal | forgotten_gem | canon_conflict | cluster_emerged
  title text,                      -- short headline: "3 ideas are all really about the same thing"
  body text,                       -- the full insight
  idea_ids uuid[],                 -- which ideas are involved
  is_read boolean default false,
  is_actioned boolean default false
);

-- ============================================
-- WHATSAPP MESSAGES (raw intake log)
-- Every WhatsApp message gets logged here first,
-- then processed into the ideas table.
-- This ensures nothing is ever lost even if
-- processing fails.
-- ============================================
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz default now(),
  from_number text not null,
  message_body text not null,
  media_url text,                  -- for voice notes, images
  processed boolean default false,
  idea_id uuid references ideas(id) -- set once processed
);

-- ============================================
-- INDEXES
-- Performance for the operations we'll run most:
-- - Finding all ideas by user
-- - Semantic similarity search (vector index)
-- - Finding unread insights
-- - Incomplete deliverables
-- ============================================
create index on ideas(user_id);
create index on ideas(category);
create index on ideas(created_at desc);
create index on deliverables(user_id, is_complete);
create index on crawl_insights(user_id, is_read);
create index on connections(idea_id_a);
create index on connections(idea_id_b);
create index on whatsapp_messages(from_number, processed);

-- Vector similarity index (IVFFlat for approximate nearest neighbor search)
-- This is what makes "find ideas by meaning" fast at scale
create index on ideas using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on canon_documents using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- ============================================
-- ROW LEVEL SECURITY
-- Each user only ever sees their own data.
-- Critical for the commercial product.
-- ============================================
alter table users enable row level security;
alter table ideas enable row level security;
alter table canon_documents enable row level security;
alter table dimensions enable row level security;
alter table connections enable row level security;
alter table deliverables enable row level security;
alter table crawl_insights enable row level security;

-- Users can only see/modify their own data
create policy "users_own_data" on ideas for all using (auth.uid() = user_id);
create policy "users_own_data" on canon_documents for all using (auth.uid() = user_id);
create policy "users_own_data" on deliverables for all using (auth.uid() = user_id);
create policy "users_own_data" on crawl_insights for all using (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTION: update updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ideas_updated_at
  before update on ideas
  for each row execute function update_updated_at();
