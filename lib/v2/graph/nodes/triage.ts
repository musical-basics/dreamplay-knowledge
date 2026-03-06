import { GoogleGenAI } from "@google/genai"
import type { ContentState } from "../state"

/**
 * V2 Node: Triage Router
 *
 * Classifies the request as FAST_TRACK (simple edit) or DEEP_TRACK (new content).
 * Prompt extracted verbatim from pipeline.ts triageRoute().
 */
export async function triageNode(state: ContentState): Promise<Partial<ContentState>> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `Analyze the user request. Is this a simple formatting/text tweak (FAST_TRACK) or does it require writing new copy, adding new sections, or referencing data (DEEP_TRACK)?

User request: "${state.userPrompt}"
${state.currentHtml ? `Current HTML length: ${state.currentHtml.length} chars` : "No existing HTML"}

Reply ONLY with 'FAST_TRACK' or 'DEEP_TRACK'.`
            }]
        }]
    })

    const text = (response.text || "").trim().toUpperCase()
    const track = text.includes("FAST_TRACK") ? "FAST_TRACK" as const : "DEEP_TRACK" as const

    console.log(`[V2 Triage] Routed to ${track}`)

    return { track }
}

/**
 * V2 Node: Fast Track Drafter
 *
 * Single-shot edit for simple formatting/text changes.
 * Prompt extracted verbatim from pipeline.ts fastTrack().
 */
export async function fastTrackNode(state: ContentState): Promise<Partial<ContentState>> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are a precise HTML editor. Apply the following change to the HTML below.

CHANGE REQUESTED: ${state.userPrompt}

PLATFORM RULES:
${state.rulesBlock || "None"}

CURRENT HTML:
${state.currentHtml || ""}

Output ONLY the complete updated HTML. No explanations, no markdown fence.`
            }]
        }]
    })

    let html = (response.text || "").trim()
    if (html.startsWith("```html")) html = html.replace(/^```html\n/, "").replace(/\n```$/, "")
    else if (html.startsWith("```")) html = html.replace(/^```\n/, "").replace(/\n```$/, "")

    console.log(`[V2 FastTrack] Quick edit applied`)

    return {
        finalHtml: html,
        explanation: "Quick edit applied via Fast Track (single-shot).",
        citedResearchIds: [],
    }
}
