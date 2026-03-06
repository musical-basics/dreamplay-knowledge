import { PGVectorStore } from "@llamaindex/postgres"
import { Settings } from "llamaindex"

/**
 * V2 LlamaIndex Configuration
 *
 * Configures PGVectorStore to use v2_ai_schema for vector storage.
 * Embedding model: Google text-embedding-004 (768 dimensions).
 *
 * Tables are pre-provisioned (migration 20260306_02), so performSetup is false.
 */

// ── Embedding model configuration ──────────────────────
const EMBED_MODEL = "text-embedding-004"
const EMBED_DIM = 768

/**
 * Get a configured PGVectorStore instance for v2_ai_schema.
 */
export async function getVectorStore(): Promise<PGVectorStore> {
    const connString = process.env.SUPABASE_DB_URL
    if (!connString) {
        throw new Error("SUPABASE_DB_URL is not set. Required for LlamaIndex PGVectorStore.")
    }

    const vectorStore = new PGVectorStore({
        clientConfig: {
            connectionString: connString,
        },
        schemaName: "v2_ai_schema",
        tableName: "embeddings",
        dimensions: EMBED_DIM,
        performSetup: false, // Tables are pre-provisioned via migration 20260306_02
    })

    return vectorStore
}

/**
 * Configure LlamaIndex global settings.
 * Call this once at app startup or script initialization.
 */
export function configureLlamaIndex() {
    // Set chunk size and overlap for SentenceSplitter
    Settings.chunkSize = 512
    Settings.chunkOverlap = 50
}

export { EMBED_MODEL, EMBED_DIM }

