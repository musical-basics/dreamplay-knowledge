-- ============================================================
-- DreamPlay Knowledge — Phase 2 Migration
-- Consolidated SQL for all new tables + ALTER existing research_knowledgebase
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- ─── 1. AI Personas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_personas (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    prompt_snippet text NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- ─── 2. AI Missions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_missions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL,
    objective_prompt text NOT NULL,
    created_at       timestamptz DEFAULT now()
);

-- ─── 3. AI Platform Rules ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_platform_rules (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform   text NOT NULL CHECK (platform IN ('email', 'blog', 'global')),
    rule_text  text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ─── 4. AI Knowledge Chunks ────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category   text NOT NULL CHECK (category IN ('campaign_push', 'company_info', 'ceo_story')),
    title      text NOT NULL,
    content    text NOT NULL,
    is_active  boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ─── 5. Upgrade research_knowledgebase ─────────────────────
-- Add abstract and citation_count columns (non-destructive)
ALTER TABLE research_knowledgebase
    ADD COLUMN IF NOT EXISTS abstract text;

ALTER TABLE research_knowledgebase
    ADD COLUMN IF NOT EXISTS citation_count integer DEFAULT 0;

-- ─── 6. Research Tags Directory ────────────────────────────
CREATE TABLE IF NOT EXISTS research_tags_directory (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    created_at  timestamptz DEFAULT now()
);

-- ─── 7. Research Tag Links (junction) ──────────────────────
CREATE TABLE IF NOT EXISTS research_tag_links (
    research_id uuid NOT NULL REFERENCES research_knowledgebase(id) ON DELETE CASCADE,
    tag_id      uuid NOT NULL REFERENCES research_tags_directory(id) ON DELETE CASCADE,
    PRIMARY KEY (research_id, tag_id)
);

-- ─── 8. Citation Logs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS citation_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    research_id  uuid NOT NULL REFERENCES research_knowledgebase(id) ON DELETE CASCADE,
    source_repo  text NOT NULL CHECK (source_repo IN ('blog', 'email')),
    created_at   timestamptz DEFAULT now()
);

-- ─── Indexes for performance ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_research_tag_links_research ON research_tag_links(research_id);
CREATE INDEX IF NOT EXISTS idx_research_tag_links_tag ON research_tag_links(tag_id);
CREATE INDEX IF NOT EXISTS idx_citation_logs_research ON citation_logs(research_id);
CREATE INDEX IF NOT EXISTS idx_citation_logs_created ON citation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_research_kb_citation_count ON research_knowledgebase(citation_count DESC);
CREATE INDEX IF NOT EXISTS idx_research_kb_active ON research_knowledgebase(is_active);

-- ─── RLS Policies (restrict to authenticated admins) ───────
-- Enable RLS on all new tables
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_platform_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_tags_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (service role bypasses RLS)
CREATE POLICY "Authenticated users can manage ai_personas"
    ON ai_personas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ai_missions"
    ON ai_missions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ai_platform_rules"
    ON ai_platform_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage ai_knowledge_chunks"
    ON ai_knowledge_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage research_tags_directory"
    ON research_tags_directory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage research_tag_links"
    ON research_tag_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage citation_logs"
    ON citation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
