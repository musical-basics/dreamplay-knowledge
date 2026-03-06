import { GoogleGenAI } from "@google/genai"
import pg from "pg"
import { EMBED_MODEL, EMBED_DIM } from "./llamaindex-config"

const { Pool } = pg

/**
 * V2 Semantic Search Retriever
 *
 * Performs vector similarity search against v2_ai_schema.embeddings
 * using Google text-embedding-004 embeddings.
 *
 * Returns text chunks with full citation metadata.
 */

export interface SearchResult {
    text: string
    score: number
    metadata: {
        source_id: string
        title: string
        author: string
        year: string
        url: string
        chunk_index: number
        total_chunks: number
    }
}

let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
    if (!_pool) {
        const connString = process.env.SUPABASE_DB_URL
        if (!connString) {
            throw new Error("SUPABASE_DB_URL is not set. Required for vector search.")
        }
        _pool = new Pool({ connectionString: connString })
    }
    return _pool
}

/**
 * Perform semantic search against the v2_ai_schema embeddings.
 *
 * @param query - The search query text
 * @param topK - Number of results to return (default: 5)
 * @returns Array of SearchResult with text, score, and metadata
 */
export async function semanticSearch(query: string, topK = 5): Promise<SearchResult[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const pool = getPool()

    // Generate embedding for the query
    const embeddingResponse = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: [query],
    })

    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values
    if (!queryEmbedding || queryEmbedding.length !== EMBED_DIM) {
        throw new Error("Failed to generate query embedding")
    }

    const embeddingStr = `[${queryEmbedding.join(",")}]`

    // Vector similarity search using cosine distance
    const result = await pool.query(
        `SELECT
            e.text,
            e.metadata_,
            1 - (e.embedding <=> $1::vector) AS score
         FROM v2_ai_schema.embeddings e
         ORDER BY e.embedding <=> $1::vector
         LIMIT $2`,
        [embeddingStr, topK]
    )

    return result.rows.map(row => ({
        text: row.text,
        score: parseFloat(row.score),
        metadata: row.metadata_ as SearchResult["metadata"],
    }))
}
