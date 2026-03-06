import { GoogleGenAI } from "@google/genai"
import type { ContentState } from "../state"

/**
 * V2 Node: Auditor
 *
 * QA review — checks hallucination, tone consistency, mission alignment.
 * Can trigger a re-draft loop by setting critic_feedback to "FAIL".
 *
 * Prompt extracted verbatim from pipeline.ts nodeAuditor().
 */
export async function auditorNode(state: ContentState): Promise<Partial<ContentState>> {
    const revisionCount = (state.revision_count || 0) + 1
    console.log(`[V2 Auditor] Running QA audit (revision ${revisionCount})...`)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are the QA Auditor. Review this HTML against the chosen Mission and Persona.

MISSION: ${state.mission?.name || "Not specified"} — ${state.mission?.objective_prompt || ""}
PERSONA: ${state.persona?.name || "Not specified"}

Check:
1. Did it hallucinate facts? Are figures/quotes perfectly aligned with the research?
2. Is the tone consistent with the Persona?
3. Does it fulfill the Mission objectives?
4. Are there missing images, links, or unverified claims?

HTML TO AUDIT:
${state.refinedHtml || ""}

RESEARCH DOCS AVAILABLE:
${(state.researchDocs || []).map(d => `- "${d.title}" (${d.url || "no URL"})`).join("\n")}

Output a JSON object with exactly three keys:
{
  "updatedHtml": "...the final HTML with any minor fixes...",
  "explanation": "...brief report summarizing what was done, confirming mission alignment, and calling out any missing items that need human review...",
  "verdict": "PASS or FAIL — FAIL only if there are critical hallucinations or the HTML fundamentally misses the mission"
}

Output ONLY the JSON. No markdown fences.`
            }]
        }]
    })

    const rawText = (response.text || "").trim()

    let updatedHtml = state.refinedHtml || ""
    let explanation = "Audit complete."
    let verdict: "PASS" | "FAIL" = "PASS"

    try {
        let jsonStr = rawText
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "")
        else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "")

        const parsed = JSON.parse(jsonStr)
        if (parsed.updatedHtml) updatedHtml = parsed.updatedHtml
        if (parsed.explanation) explanation = parsed.explanation
        if (parsed.verdict === "FAIL") verdict = "FAIL"
    } catch {
        explanation = "Audit completed but QA output was not parseable. HTML passed through as-is."
    }

    // Extract cited research IDs from footnote hrefs
    const citedIds = (state.researchDocs || [])
        .filter(doc => doc.url && updatedHtml.includes(doc.url))
        .map(doc => doc.id)

    console.log(`[V2 Auditor] Verdict: ${verdict} (revision ${revisionCount})`)

    return {
        finalHtml: updatedHtml,
        explanation,
        citedResearchIds: citedIds,
        critic_feedback: verdict,
        revision_count: revisionCount,
    }
}
