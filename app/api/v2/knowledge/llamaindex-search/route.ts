import { NextResponse } from "next/server"
import { semanticSearch } from "@/lib/v2/retriever"

/**
 * POST /api/v2/knowledge/llamaindex-search
 *
 * Semantic search endpoint for cross-repo use.
 * Accepts a query and returns ranked text chunks with citation metadata.
 *
 * Body:
 *   - query: string (required)
 *   - topK?: number (default: 5)
 *
 * Headers:
 *   - x-internal-api-secret: must match INTERNAL_API_SECRET env var
 *
 * Returns:
 *   - results: SearchResult[] with text, score, and metadata
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    "http://localhost:3001", // dreamplay-email-testing
    "http://localhost:4001",
    "http://localhost:3003", // dreamplay-blog-testing
    "http://localhost:4003",
]

function getCorsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-internal-api-secret",
    }

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin
    }

    return headers
}

// Handle CORS preflight
export async function OPTIONS(request: Request) {
    const origin = request.headers.get("origin")
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
    })
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin")
    const corsHeaders = getCorsHeaders(origin)

    try {
        // ── Auth check ────────────────────────────────────
        const secret = request.headers.get("x-internal-api-secret")
        const expectedSecret = process.env.INTERNAL_API_SECRET

        if (expectedSecret && secret !== expectedSecret) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: corsHeaders }
            )
        }

        // ── Parse body ────────────────────────────────────
        const body = await request.json()
        const { query, topK = 5 } = body

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "query is required and must be a string" },
                { status: 400, headers: corsHeaders }
            )
        }

        // ── Search ────────────────────────────────────────
        const results = await semanticSearch(query, topK)

        return NextResponse.json(
            {
                results,
                count: results.length,
                query,
            },
            { headers: corsHeaders }
        )
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        console.error("[V2 LlamaIndex Search] Error:", msg)
        return NextResponse.json(
            { error: msg },
            { status: 500, headers: corsHeaders }
        )
    }
}
