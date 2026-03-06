import { Document, SentenceSplitter } from "llamaindex"
import { createClient } from "@/lib/supabase/server"

/**
 * V2 Chunker
 *
 * Fetches all active research documents from public.research_knowledgebase
 * and splits them into LlamaIndex Document nodes using SentenceSplitter.
 *
 * Each chunk carries metadata for downstream citation (title, author, year, source_id).
 */

export interface ChunkedDocument {
    sourceId: string
    title: string
    author: string | null
    year: string | null
    url: string | null
    chunks: Document[]
}

/**
 * Fetch all active research documents and split into chunks.
 *
 * @param chunkSize - Number of characters per chunk (default: 512)
 * @param chunkOverlap - Overlap between chunks (default: 50)
 * @returns Array of ChunkedDocument, each with its parsed chunks
 */
export async function chunkAllDocuments(
    chunkSize = 512,
    chunkOverlap = 50
): Promise<ChunkedDocument[]> {
    const supabase = createClient()

    // Fetch all active research docs with content
    const { data: docs, error } = await supabase
        .from("research_knowledgebase")
        .select("id, title, author, year, url, content")
        .eq("is_active", true)
        .not("content", "is", null)

    if (error) throw new Error(`Failed to fetch research docs: ${error.message}`)
    if (!docs || docs.length === 0) {
        console.log("[V2 Chunker] No active research documents found.")
        return []
    }

    console.log(`[V2 Chunker] Processing ${docs.length} documents...`)

    const splitter = new SentenceSplitter({
        chunkSize,
        chunkOverlap,
    })

    const results: ChunkedDocument[] = []

    for (const doc of docs) {
        if (!doc.content || doc.content.trim().length === 0) {
            console.log(`  [SKIP] "${doc.title}" — empty content`)
            continue
        }

        // Create a LlamaIndex Document from the full content
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

        // Split into chunks
        const nodes = splitter.getNodesFromDocuments([llamaDoc])
        const chunks = nodes.map(node => new Document({
            text: node.getContent(),
            metadata: {
                ...node.metadata,
                source_id: doc.id,
                title: doc.title,
                author: doc.author || "Unknown",
                year: doc.year || "Unknown",
                url: doc.url || "",
            },
        }))

        results.push({
            sourceId: doc.id,
            title: doc.title,
            author: doc.author,
            year: doc.year,
            url: doc.url,
            chunks,
        })

        console.log(`  [OK] "${doc.title}" → ${chunks.length} chunks`)
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunks.length, 0)
    console.log(`[V2 Chunker] Done: ${results.length} docs → ${totalChunks} total chunks`)

    return results
}
