import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"
import {
    triageRoute,
    fastTrack,
    runDeepPipeline,
    type ContextPayload,
} from "@/lib/pipeline"

/**
 * POST /api/copilot
 * The main Agentic Content Generation endpoint.
 * Uses SSE to stream progress events back to the client.
 *
 * Body:
 *   - prompt: string (user's generation request)
 *   - currentHtml?: string (existing HTML to modify)
 *   - platform: "blog" | "email"
 *   - persona_id?: string
 *   - mission_id?: string
 *   - assets?: Record<string, string>
 *   - tag_filter?: string[]
 *   - force_deep?: boolean (skip triage, force deep pipeline)
 */
export async function POST(request: Request) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (status: string, message: string, data?: Record<string, unknown>) => {
                const event = JSON.stringify({ status, message, ...data })
                controller.enqueue(encoder.encode(`data: ${event}\n\n`))
            }

            try {
                const body = await request.json()
                const {
                    prompt,
                    currentHtml,
                    platform = "blog",
                    persona_id,
                    mission_id,
                    assets,
                    tag_filter,
                    force_deep = false,
                } = body

                if (!prompt) {
                    sendEvent("error", "prompt is required")
                    controller.close()
                    return
                }

                const supabase = createClient()

                // ── Step 0: Triage ─────────────────────────
                sendEvent("triaging", "Analyzing request complexity...")

                let track: "FAST_TRACK" | "DEEP_TRACK" = "DEEP_TRACK"
                if (!force_deep) {
                    try {
                        track = await triageRoute(prompt, currentHtml)
                    } catch (e) {
                        console.error("[Triage] Error, defaulting to DEEP_TRACK:", e)
                    }
                }

                sendEvent("routed", `Routed to ${track}`, { track })

                // ── FAST TRACK ─────────────────────────────
                if (track === "FAST_TRACK" && currentHtml) {
                    // Fetch just the rules for the platform
                    const [{ data: globalRules }, { data: platformRules }] = await Promise.all([
                        supabase.from("ai_platform_rules").select("rule_text").eq("platform", "global"),
                        supabase.from("ai_platform_rules").select("rule_text").eq("platform", platform),
                    ])

                    const rulesBlock = [...(globalRules || []), ...(platformRules || [])]
                        .map(r => r.rule_text)
                        .join("\n")

                    const result = await fastTrack(prompt, currentHtml, rulesBlock, sendEvent)

                    sendEvent("complete", result.explanation, {
                        html: result.html,
                        track: "FAST_TRACK",
                        citedResearchIds: [],
                    })

                    controller.close()
                    return
                }

                // ── DEEP TRACK: Full Pipeline ──────────────
                // Node 1: Gather all context
                sendEvent("researching", "Gathering brand context and research...")

                // Fetch context in parallel
                const [
                    { data: personas },
                    { data: missions },
                    { data: globalRules },
                    { data: platformRules },
                    { data: activeChunks },
                ] = await Promise.all([
                    supabase.from("ai_personas").select("*").order("created_at"),
                    supabase.from("ai_missions").select("*").order("created_at"),
                    supabase.from("ai_platform_rules").select("*").eq("platform", "global"),
                    supabase.from("ai_platform_rules").select("*").eq("platform", platform),
                    supabase.from("ai_knowledge_chunks").select("*").eq("is_active", true),
                ])

                // Select persona
                const selectedPersona = persona_id
                    ? personas?.find((p: { id: string }) => p.id === persona_id)
                    : personas?.[0] || null

                // Select mission
                const selectedMission = mission_id
                    ? missions?.find((m: { id: string }) => m.id === mission_id)
                    : missions?.[0] || null

                // Build rules block
                const allRules = [...(globalRules || []), ...(platformRules || [])]
                const rulesBlock = allRules.map((r: { platform: string; rule_text: string }) => `[${r.platform.toUpperCase()}] ${r.rule_text}`).join("\n")

                // Build context block
                const contextBlock = (activeChunks || [])
                    .map((c: { category: string; title: string; content: string }) => `--- ${c.category.toUpperCase()}: ${c.title} ---\n${c.content}`)
                    .join("\n\n")

                // ── RAG: Select and fetch research ─────────
                sendEvent("researching", "Selecting relevant research via RAG...")

                let researchBlock = ""
                let researchDocs: { id: string; title: string; url: string | null }[] = []

                try {
                    // Get active research with abstracts
                    const { data: candidates } = await supabase
                        .from("research_knowledgebase")
                        .select("id, title, author, year, url, abstract, citation_count")
                        .eq("is_active", true)
                        .not("content", "is", null)
                        .order("citation_count", { ascending: false })

                    if (candidates && candidates.length > 0) {
                        let filteredCandidates = candidates

                        // Tag filter
                        if (tag_filter && tag_filter.length > 0) {
                            const { data: tagLinks } = await supabase
                                .from("research_tag_links")
                                .select("research_id")
                                .in("tag_id", tag_filter)
                            if (tagLinks && tagLinks.length > 0) {
                                const taggedIds = new Set(tagLinks.map((l: { research_id: string }) => l.research_id))
                                filteredCandidates = candidates.filter((c: { id: string }) => taggedIds.has(c.id))
                            }
                        }

                        // LLM-guided selection
                        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
                        const directory = filteredCandidates.map((doc: { title: string; author: string | null; year: string | null; abstract: string | null; citation_count: number }, i: number) => (
                            `[${i}] "${doc.title}" by ${doc.author || "Unknown"} (${doc.year || "?"})` +
                            `${doc.abstract ? `\n    Abstract: ${doc.abstract}` : ""}` +
                            `\n    Citations: ${doc.citation_count || 0}`
                        )).join("\n\n")

                        const selectionResponse = await ai.models.generateContent({
                            model: "gemini-2.5-flash",
                            contents: [{
                                role: "user",
                                parts: [{
                                    text: `Select 1-2 research docs most relevant to: "${prompt}"\n\nDirectory:\n${directory}\n\nReply ONLY with a JSON array of index numbers, e.g. [0, 3].`
                                }]
                            }]
                        })

                        let selectedIndices: number[] = [0]
                        try {
                            const match = (selectionResponse.text || "").match(/\[[\d,\s]+\]/)
                            if (match) selectedIndices = JSON.parse(match[0])
                        } catch { /* fallback to [0] */ }

                        selectedIndices = selectedIndices
                            .filter(i => i >= 0 && i < filteredCandidates.length)
                            .slice(0, 2)

                        const selectedIds = selectedIndices.map(i => filteredCandidates[i].id)

                        // Deep fetch full content
                        const { data: fullDocs } = await supabase
                            .from("research_knowledgebase")
                            .select("id, title, author, year, url, content")
                            .in("id", selectedIds)

                        if (fullDocs && fullDocs.length > 0) {
                            researchBlock = fullDocs
                                .map((doc: { title: string; author: string | null; content: string }) =>
                                    `--- SOURCE: ${doc.title} ${doc.author ? `(by ${doc.author})` : ""} ---\n${doc.content}`
                                )
                                .join("\n\n")

                            researchDocs = fullDocs.map((doc: { id: string; title: string; url: string | null }) => ({
                                id: doc.id,
                                title: doc.title,
                                url: doc.url,
                            }))

                            sendEvent("researching", `Selected ${fullDocs.length} research document(s) via RAG`)
                        }
                    }
                } catch (ragError) {
                    console.error("[RAG] Error:", ragError)
                    sendEvent("researching", "RAG selection failed, continuing without research")
                }

                // ── Assemble Context Payload ───────────────
                const ctx: ContextPayload = {
                    userPrompt: prompt,
                    currentHtml,
                    platform,
                    persona: selectedPersona
                        ? { name: selectedPersona.name, prompt_snippet: selectedPersona.prompt_snippet }
                        : null,
                    mission: selectedMission
                        ? { name: selectedMission.name, objective_prompt: selectedMission.objective_prompt }
                        : null,
                    rulesBlock,
                    contextBlock,
                    researchBlock,
                    researchDocs,
                    assets,
                }

                // ── Run Deep Pipeline (Nodes 2-4) ──────────
                const result = await runDeepPipeline(ctx, sendEvent)

                // ── Log citations ──────────────────────────
                if (result.citedResearchIds.length > 0) {
                    try {
                        const rows = result.citedResearchIds.map(research_id => ({
                            research_id,
                            source_repo: platform,
                        }))
                        await supabase.from("citation_logs").insert(rows)

                        for (const researchId of result.citedResearchIds) {
                            const { data: doc } = await supabase
                                .from("research_knowledgebase")
                                .select("citation_count")
                                .eq("id", researchId)
                                .single()
                            await supabase
                                .from("research_knowledgebase")
                                .update({ citation_count: (doc?.citation_count || 0) + 1 })
                                .eq("id", researchId)
                        }
                    } catch (citationError) {
                        console.error("[Citation] Error logging:", citationError)
                    }
                }

                // ── Final response ─────────────────────────
                sendEvent("complete", result.explanation, {
                    html: result.html,
                    track: "DEEP_TRACK",
                    persona: selectedPersona?.name || null,
                    mission: selectedMission?.name || null,
                    citedResearchIds: result.citedResearchIds,
                    researchDocs: researchDocs.map(d => d.title),
                })

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : "Unknown error"
                console.error("[Copilot] Pipeline error:", msg)
                sendEvent("error", msg)
            } finally {
                controller.close()
            }
        }
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    })
}
