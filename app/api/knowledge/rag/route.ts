import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"

/**
 * POST /api/knowledge/rag
 * Agentic RAG — given a query, reviews abstracts, selects best research,
 * deep-fetches full content, returns compiled research payload.
 *
 * Body:
 *   - query: string (the user's prompt / generation goal)
 *   - limit?: number (max docs to return, default 2)
 *   - tag_filter?: string[] (optional tag IDs to narrow search)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { query, limit = 2, tag_filter } = body

        if (!query) {
            return NextResponse.json({ error: "query is required" }, { status: 400 })
        }

        const supabase = createClient()
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

        // ── Step 1: Get active research docs with abstracts ───
        let docsQuery = supabase
            .from("research_knowledgebase")
            .select("id, title, author, year, url, abstract, citation_count, source")
            .eq("is_active", true)
            .not("content", "is", null)
            .order("citation_count", { ascending: false })

        const { data: candidates, error: queryError } = await docsQuery

        if (queryError) throw new Error(queryError.message)
        if (!candidates || candidates.length === 0) {
            return NextResponse.json({
                research: [],
                message: "No active research documents available.",
            })
        }

        // ── Step 2: Tag filtering (if provided) ─────────────
        let filteredCandidates = candidates
        if (tag_filter && tag_filter.length > 0) {
            const { data: tagLinks } = await supabase
                .from("research_tag_links")
                .select("research_id")
                .in("tag_id", tag_filter)

            if (tagLinks && tagLinks.length > 0) {
                const taggedIds = new Set(tagLinks.map(l => l.research_id))
                filteredCandidates = candidates.filter(c => taggedIds.has(c.id))
            }
        }

        // ── Step 3: LLM-guided selection via abstract review ─
        // Build a directory for the LLM to review
        const directory = filteredCandidates.map((doc, i) => (
            `[${i}] "${doc.title}" by ${doc.author || "Unknown"} (${doc.year || "?"})` +
            `${doc.abstract ? `\n    Abstract: ${doc.abstract}` : ""}` +
            `\n    Citations: ${doc.citation_count || 0}`
        )).join("\n\n")

        const selectionResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{
                        text: `You are a research librarian. A content writer needs research to support the following generation task:

"${query}"

Below is a directory of available active research documents:

${directory}

Select the ${Math.min(limit, filteredCandidates.length)} most relevant documents for this task. Consider:
1. How directly the abstract addresses the query topic
2. Citation popularity (higher = more trusted)
3. Diversity of perspectives

Reply ONLY with a JSON array of the index numbers, e.g. [0, 3]. No other text.`
                    }]
                }
            ]
        })

        let selectedIndices: number[] = []
        try {
            const raw = (selectionResponse.text || "").trim()
            // Extract JSON array from response
            const match = raw.match(/\[[\d,\s]+\]/)
            if (match) {
                selectedIndices = JSON.parse(match[0])
            }
        } catch {
            // Fallback: just take top N by citation count
            selectedIndices = filteredCandidates.slice(0, limit).map((_, i) => i)
        }

        // Clamp to valid indices
        selectedIndices = selectedIndices
            .filter(i => i >= 0 && i < filteredCandidates.length)
            .slice(0, limit)

        if (selectedIndices.length === 0) {
            selectedIndices = [0]
        }

        const selectedDocs = selectedIndices.map(i => filteredCandidates[i])

        // ── Step 4: Deep fetch — get full content for selected docs ─
        const { data: fullDocs, error: fetchError } = await supabase
            .from("research_knowledgebase")
            .select("id, title, author, year, url, content, abstract, citation_count")
            .in("id", selectedDocs.map(d => d.id))

        if (fetchError) throw new Error(fetchError.message)

        // Format into a research payload
        const researchPayload = (fullDocs || []).map(doc => ({
            id: doc.id,
            title: doc.title,
            author: doc.author,
            year: doc.year,
            url: doc.url,
            abstract: doc.abstract,
            citation_count: doc.citation_count,
            content: doc.content,
        }))

        const researchBlock = researchPayload
            .map(doc =>
                `--- SOURCE: ${doc.title} ${doc.author ? `(by ${doc.author})` : ""} ---\n${doc.content}`
            )
            .join("\n\n")

        return NextResponse.json({
            research: researchPayload,
            researchBlock,
            selectedCount: researchPayload.length,
            totalCandidates: filteredCandidates.length,
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        console.error("[RAG API] Error:", msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
