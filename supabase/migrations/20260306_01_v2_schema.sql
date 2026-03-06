-- ============================================================
-- V2 AI Schema — Step 1: Create isolated schema
-- Run this in Supabase SQL Editor FIRST
-- ============================================================

CREATE SCHEMA IF NOT EXISTS v2_ai_schema;

COMMENT ON SCHEMA v2_ai_schema IS
  'Isolated schema for V2 AI infrastructure (LangGraph checkpointer + LlamaIndex vector store). DO NOT touch public schema.';
