import { GoogleGenAI } from "@google/genai"
import { createClient } from "@/lib/supabase/server"
import type { ContentState } from "../state"

/**
 * V2 Node: Researcher
 *
 * Gathers all context (persona, mission, rules, knowledge chunks) from the DB,
 * then performs LLM-guided RAG to select the most relevant research documents.
 *
 * Logic extracted from:
 *   - pipeline.ts compileResearcherOutput()
 *   - copilot/route.ts deep track context assembly + RAG selection
 *
 * All Supabase queries use the service role key (bypasses RLS).
 */
export async function researcherNode(state: ContentState): Promise<Partial<ContentState>> {
    const supabase = createClient()
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    console.log(`[V2 Researcher] Gathering context for platform: ${state.platform}`)

    // ── Fetch all context in parallel ─────────────────────
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
        supabase.from("ai_platform_rules").select("*").eq("platform", state.platform),
        supabase.from("ai_knowledge_chunks").select("*").eq("is_active", true),
    ])

    // Select persona (use provided or default to first)
    const selectedPersona = state.persona
        ? personas?.find((p: { name: string }) => p.name === state.persona?.name) || state.persona
        : personas?.[0]
            ? { name: personas[0].name, prompt_snippet: personas[0].prompt_snippet }
            : null

    // Select mission (use provided or default to first)
    const selectedMission = state.mission
        ? missions?.find((m: { name: string }) => m.name === state.mission?.name) || state.mission
        : missions?.[0]
            ? { name: missions[0].name, objective_prompt: missions[0].objective_prompt }
            : null

    // Build rules block
    const allRules = [...(globalRules || []), ...(platformRules || [])]
    const rulesBlock = allRules
        .map((r: { platform: string; rule_text: string }) => `[${r.platform.toUpperCase()}] ${r.rule_text}`)
        .join("\n")

    // Build context block from active knowledge chunks
    const contextBlock = (activeChunks || [])
        .map((c: { category: string; title: string; content: string }) =>
            `--- ${c.category.toUpperCase()}: ${c.title} ---\n${c.content}`
        )
        .join("\n\n")

    // ── RAG: LLM-guided research selection ────────────────
    let researchBlock = ""
    let researchDocs: { id: string; title: string; url: string | null }[] = []

    try {
        const { data: candidates } = await supabase
            .from("research_knowledgebase")
            .select("id, title, author, year, url, abstract, citation_count")
            .eq("is_active", true)
            .not("content", "is", null)
            .order("citation_count", { ascending: false })

        if (candidates && candidates.length > 0) {
            // Build directory for LLM review
            const directory = candidates
                .map((doc: { title: string; author: string | null; year: string | null; abstract: string | null; citation_count: number }, i: number) =>
                    `[${i}] "${doc.title}" by ${doc.author || "Unknown"} (${doc.year || "?"})` +
                    `${doc.abstract ? `\n    Abstract: ${doc.abstract}` : ""}` +
                    `\n    Citations: ${doc.citation_count || 0}`
                )
                .join("\n\n")

            const selectionResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Select 1-2 research docs most relevant to: "${state.userPrompt}"\n\nDirectory:\n${directory}\n\nReply ONLY with a JSON array of index numbers, e.g. [0, 3].`
                    }]
                }]
            })

            let selectedIndices: number[] = [0]
            try {
                const match = (selectionResponse.text || "").match(/[\d,\s]+/)
                if (match) selectedIndices = JSON.parse(match[0])
            } catch { /* fallback to [0] */ }

            selectedIndices = selectedIndices
                .filter(i => i >= 0 && i < candidates.length)
                .slice(0, 2)

            const selectedIds = selectedIndices.map(i => candidates[i].id)

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

                console.log(`[V2 Researcher] Selected ${fullDocs.length} research doc(s) via RAG`)
            }
        }
    } catch (ragError) {
        console.error("[V2 Researcher] RAG selection failed:", ragError)
    }

    return {
        persona: selectedPersona,
        mission: selectedMission,
        rulesBlock,
        contextBlock,
        researchBlock,
        researchDocs,
    }
}
