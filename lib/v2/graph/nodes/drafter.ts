import Anthropic from "@anthropic-ai/sdk"
import type { ContentState } from "../state"

/**
 * V2 Node: Drafter
 *
 * Uses Claude Sonnet to generate HTML email/blog copy based on the
 * compiled research context, persona, and mission.
 * Logs: what was drafted and key decisions.
 */
export async function drafterNode(state: ContentState): Promise<Partial<ContentState>> {
    const revisionNum = (state.revision_count || 0)
    console.log(`[V2 Drafter] Drafting copy (revision ${revisionNum})...`)

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
${state.researchBlock || "No research available"}

${revisionNum > 0 ? `\nPREVIOUS QA FEEDBACK (fix these issues):\n${state.critic_feedback || "None"}` : ""}`

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

    const changeNote = revisionNum > 0
        ? `Revision ${revisionNum}: Re-drafted HTML based on Proofreader feedback. Output: ${draftHtml.length} chars.`
        : `Drafted initial HTML (${draftHtml.length} chars) using Persona: ${state.persona?.name || "None"}, Mission: ${state.mission?.name || "None"}. Used ${state.researchDocs?.length || 0} research doc(s) for supporting claims.`

    return {
        draftHtml,
        intermediate_changes: [changeNote],
        worker_log: [{
            node: "Writer",
            action: changeNote,
            timestamp: new Date().toISOString(),
        }],
    }
}
