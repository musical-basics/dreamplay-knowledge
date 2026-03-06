-- ============================================================
-- V2 AI Schema — Step 2: Vector extension + LlamaIndex tables
-- Run this in Supabase SQL Editor AFTER step 01
-- ============================================================

-- Enable pgvector extension (Supabase manages this globally)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Document metadata table ───────────────────────────────
-- Links back to public.research_knowledgebase for provenance
CREATE TABLE IF NOT EXISTS v2_ai_schema.documents (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id   UUID REFERENCES public.research_knowledgebase(id),
    title       TEXT NOT NULL,
    author      TEXT,
    year        INTEGER,
    url         TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Embedding chunks table (LlamaIndex PGVectorStore compatible) ──
-- Dimension 768 = Google text-embedding-004
CREATE TABLE IF NOT EXISTS v2_ai_schema.embeddings (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    document_id BIGINT REFERENCES v2_ai_schema.documents(id) ON DELETE CASCADE,
    node_id     VARCHAR NOT NULL,
    text        TEXT NOT NULL,
    metadata_   JSONB DEFAULT '{}',
    embedding   vector(768),
    UNIQUE(node_id)
);

-- ─── Indexes ───────────────────────────────────────────────
-- IVFFlat index for approximate nearest neighbor search
-- lists = 100 is appropriate for ~10k chunks from 170+ documents
CREATE INDEX IF NOT EXISTS idx_v2_embeddings_vector
    ON v2_ai_schema.embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_v2_embeddings_document
    ON v2_ai_schema.embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_v2_embeddings_metadata
    ON v2_ai_schema.embeddings
    USING gin(metadata_);

CREATE INDEX IF NOT EXISTS idx_v2_documents_source
    ON v2_ai_schema.documents(source_id);
