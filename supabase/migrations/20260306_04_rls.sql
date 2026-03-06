-- ============================================================
-- V2 AI Schema — Step 4: Row Level Security
-- Run this in Supabase SQL Editor AFTER step 03
--
-- Strategy: Enable RLS on all v2 tables with NO permissive policies.
-- The service role key automatically bypasses RLS, so server-side
-- code works normally. The anon and authenticated roles have zero
-- access to v2_ai_schema — no browser-side access whatsoever.
-- ============================================================

-- ─── Enable RLS on LlamaIndex tables ──────────────────────
ALTER TABLE v2_ai_schema.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_ai_schema.embeddings ENABLE ROW LEVEL SECURITY;

-- ─── Enable RLS on LangGraph checkpointer tables ─────────
ALTER TABLE v2_ai_schema.checkpoint_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_ai_schema.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_ai_schema.checkpoint_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_ai_schema.checkpoint_writes ENABLE ROW LEVEL SECURITY;

-- ─── Revoke default grants to be extra safe ───────────────
-- Supabase grants USAGE on public schema to anon/authenticated by default.
-- Explicitly deny access to v2_ai_schema for those roles.
REVOKE ALL ON SCHEMA v2_ai_schema FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA v2_ai_schema FROM anon, authenticated;

-- Grant usage only to service_role (though it bypasses RLS anyway)
GRANT USAGE ON SCHEMA v2_ai_schema TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA v2_ai_schema TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA v2_ai_schema TO service_role;
