"use server"

import { createClient } from "@/lib/supabase/server"
import type { CitationLog } from "@/lib/types"

/**
 * Log citations and increment citation counts.
 * Called by blog/email repos after user approves content.
 * Step 28 & 29 from the master plan.
 */
export async function logCitations(
    researchIds: string[],
    sourceRepo: "blog" | "email"
): Promise<{ success: boolean; logged: number }> {
    const supabase = createClient()

    // Insert citation log entries
    const rows = researchIds.map(research_id => ({
        research_id,
        source_repo: sourceRepo,
    }))

    const { error: insertError } = await supabase
        .from("citation_logs")
        .insert(rows)

    if (insertError) throw new Error(insertError.message)

    // Increment citation_count for each research doc
    for (const researchId of researchIds) {
        const { error } = await supabase.rpc("increment_citation_count", {
            doc_id: researchId,
        })

        // If RPC doesn't exist yet, fall back to manual increment
        if (error) {
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
    }

    return { success: true, logged: researchIds.length }
}

export async function getCitationLogs(limit = 50): Promise<CitationLog[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("citation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw new Error(error.message)
    return data as CitationLog[]
}

export async function getTopCitedResearch(limit = 5) {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_knowledgebase")
        .select("id, title, author, year, citation_count")
        .gt("citation_count", 0)
        .order("citation_count", { ascending: false })
        .limit(limit)

    if (error) throw new Error(error.message)
    return data
}
