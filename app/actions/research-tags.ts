"use server"

import { createClient } from "@/lib/supabase/server"
import type { ResearchTag, ResearchTagLink } from "@/lib/types"

export async function getResearchTags(): Promise<ResearchTag[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_tags_directory")
        .select("*")
        .order("name")

    if (error) throw new Error(error.message)
    return data as ResearchTag[]
}

export async function saveResearchTag(tag: Partial<ResearchTag>) {
    const supabase = createClient()

    if (tag.id) {
        const { error } = await supabase
            .from("research_tags_directory")
            .update({ name: tag.name, description: tag.description })
            .eq("id", tag.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("research_tags_directory")
            .insert([{ name: tag.name, description: tag.description }])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function deleteResearchTag(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("research_tags_directory").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}

// ─── Tag linking ─────────────────────────────────────────

export async function getTagLinks(): Promise<ResearchTagLink[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_tag_links")
        .select("research_id, tag_id")

    if (error) throw new Error(error.message)
    return data as ResearchTagLink[]
}

export async function getTagsForResearch(researchId: string): Promise<string[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_tag_links")
        .select("tag_id")
        .eq("research_id", researchId)

    if (error) throw new Error(error.message)
    return (data || []).map(d => d.tag_id)
}

export async function setResearchTags(researchId: string, tagIds: string[]) {
    const supabase = createClient()

    // Remove existing links
    await supabase
        .from("research_tag_links")
        .delete()
        .eq("research_id", researchId)

    // Insert new links
    if (tagIds.length > 0) {
        const rows = tagIds.map(tagId => ({ research_id: researchId, tag_id: tagId }))
        const { error } = await supabase
            .from("research_tag_links")
            .insert(rows)
        if (error) throw new Error(error.message)
    }

    return { success: true }
}
