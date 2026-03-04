import { GoogleGenAI } from "@google/genai"
import Anthropic from "@anthropic-ai/sdk"

/**
 * The 4-Node Deep Pipeline for Agentic Content Generation
 *
 * Node 0: Triage Router (handled in the API route)
 * Node 1: Researcher (gather context + RAG research)
 * Node 2: Drafter (heavy model writes HTML/copy)
 * Node 3: Integrator (technical compliance, link/image injection)
 * Node 4: Auditor (QA review, hallucination check)
 */

export interface ContextPayload {
    userPrompt: string
    currentHtml?: string
    platform: "blog" | "email"
    persona: { name: string; prompt_snippet: string } | null
    mission: { name: string; objective_prompt: string } | null
    rulesBlock: string
    contextBlock: string
    researchBlock: string
    researchDocs: { id: string; title: string; url: string | null }[]
    assets?: Record<string, string>
}

export interface PipelineResult {
    html: string
    explanation: string
    citedResearchIds: string[]
}

type StatusCallback = (status: string, message: string) => void

// ── Node 0: Triage Router ─────────────────────────────────

export async function triageRoute(
    prompt: string,
    currentHtml: string | undefined
): Promise<"FAST_TRACK" | "DEEP_TRACK"> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `Analyze the user request. Is this a simple formatting/text tweak (FAST_TRACK) or does it require writing new copy, adding new sections, or referencing data (DEEP_TRACK)?

User request: "${prompt}"
${currentHtml ? `Current HTML length: ${currentHtml.length} chars` : "No existing HTML"}

Reply ONLY with 'FAST_TRACK' or 'DEEP_TRACK'.`
            }]
        }]
    })

    const text = (response.text || "").trim().toUpperCase()
    return text.includes("FAST_TRACK") ? "FAST_TRACK" : "DEEP_TRACK"
}

// ── Fast Track: Single-shot generation ────────────────────

export async function fastTrack(
    prompt: string,
    currentHtml: string,
    rulesBlock: string,
    onStatus?: StatusCallback
): Promise<PipelineResult> {
    onStatus?.("fast_track", "Applying quick edit...")

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are a precise HTML editor. Apply the following change to the HTML below.

CHANGE REQUESTED: ${prompt}

PLATFORM RULES:
${rulesBlock || "None"}

CURRENT HTML:
${currentHtml}

Output ONLY the complete updated HTML. No explanations, no markdown fence.`
            }]
        }]
    })

    let html = (response.text || "").trim()
    // Remove markdown fences if present
    if (html.startsWith("```html")) html = html.replace(/^```html\n/, "").replace(/\n```$/, "")
    else if (html.startsWith("```")) html = html.replace(/^```\n/, "").replace(/\n```$/, "")

    return {
        html,
        explanation: "Quick edit applied via Fast Track (single-shot).",
        citedResearchIds: [],
    }
}

// ── Deep Pipeline: Nodes 1-4 ─────────────────────────────

// Node 1: Researcher (context is already assembled — this node compiles it)
function compileResearcherOutput(ctx: ContextPayload): string {
    const sections: string[] = []

    if (ctx.persona) {
        sections.push(`## PERSONA: ${ctx.persona.name}\n${ctx.persona.prompt_snippet}`)
    }
    if (ctx.mission) {
        sections.push(`## MISSION: ${ctx.mission.name}\n${ctx.mission.objective_prompt}`)
    }
    if (ctx.rulesBlock) {
        sections.push(`## PLATFORM RULES\n${ctx.rulesBlock}`)
    }
    if (ctx.contextBlock) {
        sections.push(`## BRAND CONTEXT\n${ctx.contextBlock}`)
    }
    if (ctx.researchBlock) {
        sections.push(`## RESEARCH DATA\n${ctx.researchBlock}`)
    }
    if (ctx.assets && Object.keys(ctx.assets).length > 0) {
        const assetList = Object.entries(ctx.assets)
            .map(([key, url]) => `  {{${key}}} → ${url}`)
            .join("\n")
        sections.push(`## AVAILABLE ASSETS\n${assetList}`)
    }

    return sections.join("\n\n")
}

// Node 2: Drafter (Claude heavy model)
async function nodeDrafter(
    ctx: ContextPayload,
    compiledContext: string,
    onStatus?: StatusCallback
): Promise<string> {
    onStatus?.("drafting", "Drafting copy and HTML structure...")

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const systemPrompt = `You are the Drafter. Focus ONLY on writing highly converting, brand-aligned copy and structuring the base HTML.

${ctx.persona ? `PERSONA: ${ctx.persona.prompt_snippet}` : ""}
${ctx.mission ? `MISSION: ${ctx.mission.objective_prompt}` : ""}

Key instructions:
1. Embed psychological triggers required by the Mission (micro-commitments, urgency, social proof)
2. Write compelling, human copy that matches the Persona's tone
3. Place generic placeholders like [IMAGE] or [CITATION_NEEDED] where assets/footnotes will go
4. Structure clean HTML with semantic sections
5. Do NOT worry about exact link syntax, image URLs, or footnotes yet

PLATFORM RULES:
${ctx.rulesBlock || "None"}

BRAND CONTEXT:
${ctx.contextBlock || "None"}

RESEARCH (use this data to support claims):
${ctx.researchBlock || "No research available"}`

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
            role: "user",
            content: `${ctx.userPrompt}${ctx.currentHtml ? `\n\nCURRENT HTML TO MODIFY/EXTEND:\n${ctx.currentHtml}` : ""}\n\nOutput ONLY the HTML. No markdown fences, no explanations.`
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

    return draftHtml
}

// Node 3: Integrator (technical compliance)
async function nodeIntegrator(
    draftHtml: string,
    ctx: ContextPayload,
    onStatus?: StatusCallback
): Promise<string> {
    onStatus?.("integrating", "Applying technical compliance, resolving placeholders...")

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const researchCitations = ctx.researchDocs
        .map((doc, i) => `[${i + 1}] "${doc.title}" — ${doc.url || "No URL available"}`)
        .join("\n")

    const assetMap = ctx.assets
        ? Object.entries(ctx.assets)
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
${ctx.rulesBlock || "None"}

3. Insert specific Shopify discount codes if mentioned in context
4. Map factual claims to the research URLs below, appending standard HTML footnotes:
   <sup><a href='URL'>[1]</a></sup>

AVAILABLE ASSETS:
${assetMap}

RESEARCH CITATIONS:
${researchCitations || "None"}

HTML TO REFINE:
${draftHtml}

Output ONLY the refined HTML. No markdown fences, no explanations.`
            }]
        }]
    })

    let refined = (response.text || "").trim()
    if (refined.startsWith("```html")) refined = refined.replace(/^```html\n/, "").replace(/\n```$/, "")
    else if (refined.startsWith("```")) refined = refined.replace(/^```\n/, "").replace(/\n```$/, "")

    return refined
}

// Node 4: Auditor (QA review)
async function nodeAuditor(
    refinedHtml: string,
    ctx: ContextPayload,
    onStatus?: StatusCallback
): Promise<PipelineResult> {
    onStatus?.("auditing", "Running QA audit...")

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are the QA Auditor. Review this HTML against the chosen Mission and Persona.

MISSION: ${ctx.mission?.name || "Not specified"} — ${ctx.mission?.objective_prompt || ""}
PERSONA: ${ctx.persona?.name || "Not specified"}

Check:
1. Did it hallucinate facts? Are figures/quotes perfectly aligned with the research?
2. Is the tone consistent with the Persona?
3. Does it fulfill the Mission objectives?
4. Are there missing images, links, or unverified claims?

HTML TO AUDIT:
${refinedHtml}

RESEARCH DOCS AVAILABLE:
${ctx.researchDocs.map(d => `- "${d.title}" (${d.url || "no URL"})`).join("\n")}

Output a JSON object with exactly two keys:
{
  "updatedHtml": "...the final HTML with any minor fixes...",
  "explanation": "...brief report summarizing what was done, confirming mission alignment, and calling out any missing items that need human review..."
}

Output ONLY the JSON. No markdown fences.`
            }]
        }]
    })

    const rawText = (response.text || "").trim()

    // Parse the JSON response
    let updatedHtml = refinedHtml
    let explanation = "Audit complete."
    try {
        // Extract JSON from response (handle potential markdown fences)
        let jsonStr = rawText
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "")
        else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "")

        const parsed = JSON.parse(jsonStr)
        if (parsed.updatedHtml) updatedHtml = parsed.updatedHtml
        if (parsed.explanation) explanation = parsed.explanation
    } catch {
        // If JSON parsing fails, use the refined HTML as-is
        explanation = "Audit completed but QA output was not parseable. HTML passed through as-is."
    }

    // Extract cited research IDs from footnote hrefs
    const citedIds = ctx.researchDocs
        .filter(doc => doc.url && updatedHtml.includes(doc.url))
        .map(doc => doc.id)

    return {
        html: updatedHtml,
        explanation,
        citedResearchIds: citedIds,
    }
}

// ── Full Deep Pipeline Orchestrator ───────────────────────

export async function runDeepPipeline(
    ctx: ContextPayload,
    onStatus?: StatusCallback
): Promise<PipelineResult> {
    // Node 1: Researcher (compile all context)
    onStatus?.("researching", "Gathering brand context and research...")
    const compiledContext = compileResearcherOutput(ctx)

    // Node 2: Drafter (Claude)
    const draftHtml = await nodeDrafter(ctx, compiledContext, onStatus)

    // Node 3: Integrator (Gemini Flash)
    const refinedHtml = await nodeIntegrator(draftHtml, ctx, onStatus)

    // Node 4: Auditor (Gemini Flash)
    const result = await nodeAuditor(refinedHtml, ctx, onStatus)

    onStatus?.("complete", "Generation complete.")

    return result
}
