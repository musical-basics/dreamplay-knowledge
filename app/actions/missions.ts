"use server"

import { createClient } from "@/lib/supabase/server"
import type { AiMission } from "@/lib/types"

export async function getMissions(): Promise<AiMission[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_missions")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AiMission[]
}

export async function saveMission(mission: Partial<AiMission>) {
    const supabase = createClient()

    if (mission.id) {
        const { error } = await supabase
            .from("ai_missions")
            .update({ name: mission.name, objective_prompt: mission.objective_prompt })
            .eq("id", mission.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("ai_missions")
            .insert([{ name: mission.name, objective_prompt: mission.objective_prompt }])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function deleteMission(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("ai_missions").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}
