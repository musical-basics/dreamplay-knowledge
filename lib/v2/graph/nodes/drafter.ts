import Anthropic from "@anthropic-ai/sdk"
import type { ContentState } from "../state"

/**
 * V2 Node: Drafter
 *
 * Uses Claude Sonnet to generate HTML email/blog copy based on the
 * compiled research context, persona, and mission.
 *
 * Prompt extracted verbatim from pipeline.ts nodeDrafter().
 */
export async function drafterNode(state: ContentState): Promise<Partial<ContentState>> {
    console.log(`[V2 Drafter] Drafting copy (revision ${state.revision_count || 0})...`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const systemPrompt = `You are the Drafter. Focus ONLY on writing highly converting, brand-aligned copy and structuring the base HTML.

${state.persona ? `PERSONA: ${state.persona.prompt_snippet}` : ""}
${state.mission ? `MISSION: ${state.mission.objective_prompt}` : ""}

Key instructions:
1. Embed psychological triggers required by the Mission (micro-commitments, urgency, social proof)
2. Write compelling, human copy that matches the Persona's tone
3. Place generic placeholders like [IMAGE] or [CITATION_NEEDED] where assets/footnotes will go
4. Structure clean HTML with semantic sections
5. Do NOT worry about exact link syntax, image URLs, or footnotes yet

PLATFORM RULES:
${state.rulesBlock || "None"}

BRAND CONTEXT:
${state.contextBlock || "None"}

RESEARCH (use this data to support claims):
${state.researchBlock || "No research available"}`

    const userMessage = `${state.userPrompt}${state.currentHtml ? `\n\nCURRENT HTML TO MODIFY/EXTEND:\n${state.currentHtml}` : ""}\n\nOutput ONLY the HTML. No markdown fences, no explanations.`

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
            role: "user",
            content: userMessage,
        }]
    })

    let draftHtml = ""
    for (const block of response.content) {
        if (block.type === "text") draftHtml += block.text
    }

    // Clean markdown fences
    draftHtml = draftHtml.trim()
    if (draftHtml.startsWith("```html")) draftHtml = draftHtml.replace(/^```html\n/, "").replace(/\n```$/, "")
    else if (draftHtml.startsWith("```")) draftHtml = draftHtml.replace(/^```\n/, "").replace(/\n```$/, "")

    console.log(`[V2 Drafter] Draft complete (${draftHtml.length} chars)`)

    return { draftHtml }
}
