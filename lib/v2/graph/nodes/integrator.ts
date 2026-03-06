import { GoogleGenAI } from "@google/genai"
import type { ContentState } from "../state"

/**
 * V2 Node: Integrator
 *
 * Technical compliance pass — resolves asset placeholders, injects
 * proper citation footnotes, enforces platform rules.
 *
 * Prompt extracted verbatim from pipeline.ts nodeIntegrator().
 */
export async function integratorNode(state: ContentState): Promise<Partial<ContentState>> {
    console.log(`[V2 Integrator] Applying technical compliance...`)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const researchCitations = (state.researchDocs || [])
        .map((doc, i) => `[${i + 1}] "${doc.title}" — ${doc.url || "No URL available"}`)
        .join("\n")

    const assetMap = state.assets
        ? Object.entries(state.assets)
            .map(([key, url]) => `{{${key}}} → ${url}`)
            .join("\n")
        : "No assets provided"

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are the Integrator. Your job is strict technical compliance.

Review the provided HTML and perform these tasks:
1. Replace [IMAGE] placeholders with exact mustache variables from the asset map, or <img> tags with URLs
2. Ensure Platform Rules are strictly followed:
${state.rulesBlock || "None"}

3. Insert specific Shopify discount codes if mentioned in context
4. Map factual claims to the research URLs below, appending standard HTML footnotes:
   <sup><a href='URL'>[1]</a></sup>

AVAILABLE ASSETS:
${assetMap}

RESEARCH CITATIONS:
${researchCitations || "None"}

HTML TO REFINE:
${state.draftHtml || ""}

Output ONLY the refined HTML. No markdown fences, no explanations.`
            }]
        }]
    })

    let refined = (response.text || "").trim()
    if (refined.startsWith("```html")) refined = refined.replace(/^```html\n/, "").replace(/\n```$/, "")
    else if (refined.startsWith("```")) refined = refined.replace(/^```\n/, "").replace(/\n```$/, "")

    console.log(`[V2 Integrator] Refinement complete (${refined.length} chars)`)

    return { refinedHtml: refined }
}
