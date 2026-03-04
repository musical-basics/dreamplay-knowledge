"use server"

import { createClient } from "@/lib/supabase/server"
import type { AiPlatformRule, Platform } from "@/lib/types"

export async function getRules(): Promise<AiPlatformRule[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_platform_rules")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AiPlatformRule[]
}

export async function getRulesByPlatform(platform: Platform): Promise<AiPlatformRule[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("ai_platform_rules")
        .select("*")
        .eq("platform", platform)
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as AiPlatformRule[]
}

export async function saveRule(rule: Partial<AiPlatformRule>) {
    const supabase = createClient()

    if (rule.id) {
        const { error } = await supabase
            .from("ai_platform_rules")
            .update({ platform: rule.platform, rule_text: rule.rule_text })
            .eq("id", rule.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("ai_platform_rules")
            .insert([{ platform: rule.platform, rule_text: rule.rule_text }])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function deleteRule(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("ai_platform_rules").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}
