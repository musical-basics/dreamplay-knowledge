import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Platform } from "@/lib/types"

/**
 * GET /api/knowledge
 * Assembles the full context payload for a given platform.
 * Called by blog/email repos before generation.
 *
 * Query params:
 *   - platform: "blog" | "email" (defaults to "blog")
 *   - persona_id: optional UUID to select a specific persona
 *   - mission_id: optional UUID to select a specific mission
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const platform = (searchParams.get("platform") || "blog") as Platform
        const personaId = searchParams.get("persona_id")
        const missionId = searchParams.get("mission_id")

        const supabase = createClient()

        // All fetches in parallel
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

        // Select persona (specific or first)
        const selectedPersona = personaId
            ? personas?.find(p => p.id === personaId)
            : personas?.[0] || null

        // Select mission (specific or first)
        const selectedMission = missionId
            ? missions?.find(m => m.id === missionId)
            : missions?.[0] || null

        // Combine global + platform rules
        const allRules = [...(globalRules || []), ...(platformRules || [])]

        // Format context blocks
        const contextBlock = (activeChunks || [])
            .map(c => `--- ${c.category.toUpperCase()}: ${c.title} ---\n${c.content}`)
            .join("\n\n")

        const rulesBlock = allRules
            .map(r => `[${r.platform.toUpperCase()}] ${r.rule_text}`)
            .join("\n")

        return NextResponse.json({
            persona: selectedPersona,
            mission: selectedMission,
            rules: allRules,
            rulesBlock,
            contextChunks: activeChunks || [],
            contextBlock,
            availablePersonas: personas || [],
            availableMissions: missions || [],
        })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        console.error("[Knowledge API] Error:", msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
