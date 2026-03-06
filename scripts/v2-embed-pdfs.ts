#!/usr/bin/env tsx
/**
 * V2 PDF Embedding Script
 *
 * Reads all active research documents from public.research_knowledgebase,
 * chunks them via LlamaIndex SentenceSplitter, generates embeddings
 * via Google text-embedding-004, and stores them in v2_ai_schema.
 *
 * Usage:
 *   npx tsx scripts/v2-embed-pdfs.ts
 *
 * Requires:
 *   - SUPABASE_DB_URL (direct Postgres connection)
 *   - GEMINI_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY (for reading research_knowledgebase)
 */

import "dotenv/config"
import { GoogleGenAI } from "@google/genai"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import pg from "pg"
import { Document, SentenceSplitter } from "llamaindex"

const { Pool } = pg

// ── Config ────────────────────────────────────────────
const EMBED_MODEL = "text-embedding-004"
const EMBED_DIM = 768
const CHUNK_SIZE = 512
const CHUNK_OVERLAP = 50
const BATCH_SIZE = 5 // Embed N chunks at a time to avoid rate limits

// ── Clients ───────────────────────────────────────────
const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL! })

// ── Main ──────────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════════════════════")
    console.log("  V2 PDF Embedding Pipeline")
    console.log("═══════════════════════════════════════════════════")
    console.log("")

    // 1. Fetch all active research docs
    console.log("[1/4] Fetching active research documents...")
    const { data: docs, error } = await supabase
        .from("research_knowledgebase")
        .select("id, title, author, year, url, content")
        .eq("is_active", true)
        .not("content", "is", null)

    if (error) throw new Error(`Supabase error: ${error.message}`)
    if (!docs || docs.length === 0) {
        console.log("No active documents found. Exiting.")
        process.exit(0)
    }
    console.log(`  Found ${docs.length} active documents.\n`)

    // 2. Chunk all documents
    console.log("[2/4] Chunking documents...")
    const splitter = new SentenceSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
    })

    interface ChunkWithMeta {
        sourceId: string
        title: string
        author: string | null
        year: string | null
        url: string | null
        text: string
        nodeId: string
        metadata: Record<string, unknown>
    }

    const allChunks: ChunkWithMeta[] = []

    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        if (!doc.content || doc.content.trim().length === 0) {
            console.log(`  [${i + 1}/${docs.length}] SKIP: "${doc.title}" — empty content`)
            continue
        }

        const llamaDoc = new Document({
            text: doc.content,
            metadata: {
                source_id: doc.id,
                title: doc.title,
                author: doc.author || "Unknown",
                year: doc.year || "Unknown",
                url: doc.url || "",
            },
        })

        const nodes = splitter.getNodesFromDocuments([llamaDoc])

        for (let j = 0; j < nodes.length; j++) {
            allChunks.push({
                sourceId: doc.id,
                title: doc.title,
                author: doc.author,
                year: doc.year,
                url: doc.url,
                text: nodes[j].getContent(),
                nodeId: `${doc.id}_chunk_${j}`,
                metadata: {
                    source_id: doc.id,
                    title: doc.title,
                    author: doc.author || "Unknown",
                    year: doc.year || "Unknown",
                    chunk_index: j,
                    total_chunks: nodes.length,
                },
            })
        }

        console.log(`  [${i + 1}/${docs.length}] "${doc.title}" → ${nodes.length} chunks`)
    }

    console.log(`  Total: ${allChunks.length} chunks from ${docs.length} documents.\n`)

    // 3. Insert document metadata + generate embeddings
    console.log("[3/4] Inserting documents and generating embeddings...")

    const client = await pool.connect()
    try {
        // Track which source_ids we've inserted
        const insertedDocIds = new Map<string, number>() // source_id -> v2 documents.id

        for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
            const batch = allChunks.slice(i, i + BATCH_SIZE)
            const batchTexts = batch.map(c => c.text)

            // Ensure document metadata row exists
            for (const chunk of batch) {
                if (!insertedDocIds.has(chunk.sourceId)) {
                    const result = await client.query(
                        `INSERT INTO v2_ai_schema.documents (source_id, title, author, year, url)
                         VALUES ($1, $2, $3, $4::integer, $5)
                         ON CONFLICT DO NOTHING
                         RETURNING id`,
                        [chunk.sourceId, chunk.title, chunk.author, chunk.year ? parseInt(chunk.year) : null, chunk.url]
                    )
                    if (result.rows.length > 0) {
                        insertedDocIds.set(chunk.sourceId, result.rows[0].id)
                    } else {
                        // Already exists, fetch the id
                        const existing = await client.query(
                            `SELECT id FROM v2_ai_schema.documents WHERE source_id = $1`,
                            [chunk.sourceId]
                        )
                        if (existing.rows.length > 0) {
                            insertedDocIds.set(chunk.sourceId, existing.rows[0].id)
                        }
                    }
                }
            }

            // Generate embeddings for the batch
            let embeddings: number[][] = []
            try {
                const embeddingResponse = await ai.models.embedContent({
                    model: EMBED_MODEL,
                    contents: batchTexts,
                })

                if (embeddingResponse.embeddings) {
                    embeddings = embeddingResponse.embeddings.map(e => e.values || [])
                }
            } catch (embError) {
                console.error(`  [ERROR] Embedding batch ${i}-${i + batch.length}: ${embError}`)
                continue
            }

            // Insert chunk + embedding into v2_ai_schema.embeddings
            for (let j = 0; j < batch.length; j++) {
                const chunk = batch[j]
                const embedding = embeddings[j]
                if (!embedding || embedding.length !== EMBED_DIM) {
                    console.error(`  [ERROR] Bad embedding for chunk ${chunk.nodeId}`)
                    continue
                }

                const docId = insertedDocIds.get(chunk.sourceId)
                const embeddingStr = `[${embedding.join(",")}]`

                await client.query(
                    `INSERT INTO v2_ai_schema.embeddings (document_id, node_id, text, metadata_, embedding)
                     VALUES ($1, $2, $3, $4, $5::vector)
                     ON CONFLICT (node_id) DO UPDATE SET
                       text = EXCLUDED.text,
                       metadata_ = EXCLUDED.metadata_,
                       embedding = EXCLUDED.embedding`,
                    [docId, chunk.nodeId, chunk.text, JSON.stringify(chunk.metadata), embeddingStr]
                )
            }

            const progress = Math.min(i + BATCH_SIZE, allChunks.length)
            console.log(`  [${progress}/${allChunks.length}] Embedded and stored`)
        }
    } finally {
        client.release()
    }

    // 4. Verify
    console.log("\n[4/4] Verifying...")
    const docCount = await pool.query("SELECT COUNT(*) FROM v2_ai_schema.documents")
    const embCount = await pool.query("SELECT COUNT(*) FROM v2_ai_schema.embeddings")

    console.log(`  Documents: ${docCount.rows[0].count}`)
    console.log(`  Embeddings: ${embCount.rows[0].count}`)

    console.log("\n═══════════════════════════════════════════════════")
    console.log("  ✓ Embedding pipeline complete!")
    console.log("═══════════════════════════════════════════════════\n")

    await pool.end()
    process.exit(0)
}

main().catch(err => {
    console.error("Fatal error:", err)
    process.exit(1)
})
