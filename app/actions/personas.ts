"use server"

import { createClient } from "@/lib/supabase/server"
import type { AiPersona } from "@/lib/types"

export async function getPersonas(): Promise<AiPersona[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_personas")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AiPersona[]
}

export async function savePersona(persona: Partial<AiPersona>) {
    const supabase = createClient()

    if (persona.id) {
        const { error } = await supabase
            .from("ai_personas")
            .update({ name: persona.name, prompt_snippet: persona.prompt_snippet })
            .eq("id", persona.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("ai_personas")
            .insert([{ name: persona.name, prompt_snippet: persona.prompt_snippet }])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function deletePersona(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("ai_personas").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}
