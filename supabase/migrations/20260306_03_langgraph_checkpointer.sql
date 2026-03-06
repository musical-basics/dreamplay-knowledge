-- ============================================================
-- V2 AI Schema — Step 3: LangGraph.js Postgres Checkpointer tables
-- Run this in Supabase SQL Editor AFTER step 02
--
-- These tables mirror EXACTLY what @langchain/langgraph-checkpoint-postgres
-- would create via its setup() method (sourced from migrations.ts).
-- By pre-provisioning them, setup() becomes a safe no-op.
-- ============================================================

-- ─── Migration tracking (LangGraph internal) ──────────────
CREATE TABLE IF NOT EXISTS v2_ai_schema.checkpoint_migrations (
    v INTEGER PRIMARY KEY
);

-- ─── Main checkpoints table ───────────────────────────────
CREATE TABLE IF NOT EXISTS v2_ai_schema.checkpoints (
    thread_id            TEXT NOT NULL,
    checkpoint_ns        TEXT NOT NULL DEFAULT '',
    checkpoint_id        TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type                 TEXT,
    checkpoint           JSONB NOT NULL,
    metadata             JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- ─── Binary blob storage for channel values ───────────────
CREATE TABLE IF NOT EXISTS v2_ai_schema.checkpoint_blobs (
    thread_id     TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel       TEXT NOT NULL,
    version       TEXT NOT NULL,
    type          TEXT NOT NULL,
    blob          BYTEA,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

-- ─── Intermediate write tracking ──────────────────────────
CREATE TABLE IF NOT EXISTS v2_ai_schema.checkpoint_writes (
    thread_id     TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id       TEXT NOT NULL,
    idx           INTEGER NOT NULL,
    channel       TEXT NOT NULL,
    type          TEXT,
    blob          BYTEA NOT NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- ─── Seed migration tracker ───────────────────────────────
-- Marks migrations 0-4 as applied so PostgresSaver.setup() is a no-op.
-- These correspond to the 5 migration steps in LangGraph's migrations.ts:
--   0 = checkpoint_migrations table
--   1 = checkpoints table
--   2 = checkpoint_blobs table
--   3 = checkpoint_writes table
--   4 = ALTER checkpoint_blobs blob DROP NOT NULL (already nullable above)
INSERT INTO v2_ai_schema.checkpoint_migrations (v) VALUES (0), (1), (2), (3), (4)
ON CONFLICT (v) DO NOTHING;
