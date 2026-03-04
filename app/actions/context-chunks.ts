"use server"

import { createClient } from "@/lib/supabase/server"
import type { AiKnowledgeChunk } from "@/lib/types"

export async function getContextChunks(): Promise<AiKnowledgeChunk[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_knowledge_chunks")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AiKnowledgeChunk[]
}

export async function getActiveContextChunks(): Promise<AiKnowledgeChunk[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_knowledge_chunks")
        .select("*")
        .eq("is_active", true)

    if (error) throw new Error(error.message)
    return data as AiKnowledgeChunk[]
}

export async function saveContextChunk(chunk: Partial<AiKnowledgeChunk>) {
    const supabase = createClient()

    if (chunk.id) {
        const { error } = await supabase
            .from("ai_knowledge_chunks")
            .update({
                category: chunk.category,
                title: chunk.title,
                content: chunk.content,
                is_active: chunk.is_active,
            })
            .eq("id", chunk.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("ai_knowledge_chunks")
            .insert([{
                category: chunk.category,
                title: chunk.title,
                content: chunk.content,
                is_active: chunk.is_active ?? false,
            }])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function toggleContextChunk(id: string, is_active: boolean) {
    const supabase = createClient()
    const { error } = await supabase
        .from("ai_knowledge_chunks")
        .update({ is_active })
        .eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}

export async function deleteContextChunk(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("ai_knowledge_chunks").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}
