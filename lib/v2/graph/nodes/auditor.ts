import { GoogleGenAI } from "@google/genai"
import type { ContentState, FinalContextReport } from "../state"

/**
 * V2 Node: Auditor
 *
 * QA review — checks hallucination, tone consistency, mission alignment.
 * Can trigger a re-draft loop by setting critic_feedback to "FAIL".
 * On PASS, compiles a final_context_report ("recipe") for future reuse.
 */
export async function auditorNode(state: ContentState): Promise<Partial<ContentState>> {
    const currentRevision = (state.revision_count || 0) + 1
    console.log(`[V2 Auditor] Running QA audit (revision ${currentRevision})...`)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{
                text: `You are the QA Auditor. Review this HTML against the chosen Mission and Persona.

MISSION: ${state.mission?.name || "Not specified"} — ${state.mission?.objective_prompt || ""}
PERSONA: ${state.persona?.name || "Not specified"}

WORKER LEDGER (Changes made so far by other workers):
${state.intermediate_changes?.join("\n") || "None"}

Check:
1. Did it hallucinate facts? Are figures/quotes perfectly aligned with the research?
2. Is the tone consistent with the Persona?
3. Does it fulfill the Mission objectives?
4. Are there missing images, links, or unverified claims?

HTML TO AUDIT:
${state.refinedHtml || ""}

RESEARCH DOCS AVAILABLE:
${(state.researchDocs || []).map(d => `- "${d.title}" (${d.url || "no URL"})`).join("\n")}

Output a JSON object with exactly four keys:
{
  "updatedHtml": "...the final HTML with any minor fixes...",
  "explanation": "...brief report summarizing what was done, confirming mission alignment, and calling out any missing items that need human review...",
  "verdict": "PASS or FAIL — FAIL only if there are critical hallucinations or the HTML fundamentally misses the mission",
  "final_context_report": {
      "background_thinking": "Why this specific copy/structure was chosen — the strategic reasoning",
      "docs_retrieved": ${state.researchDocs?.length || 0},
      "quotes_used": ["list exact quotes or data points used from research"],
      "topics_covered": ["list main topics/themes in the content"],
      "ctas_added": ["list all CTA variables or links added"],
      "styling_used": "Describe the CSS/HTML styling approach used"
  }
}

Output ONLY the JSON. No markdown fences.`
            }]
        }]
    })

    const rawText = (response.text || "").trim()

    let updatedHtml = state.refinedHtml || ""
    let explanation = "Audit complete."
    let verdict: "PASS" | "FAIL" = "PASS"
    let finalReport: FinalContextReport | null = null

    try {
        let jsonStr = rawText
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "")
        else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "")

        const parsed = JSON.parse(jsonStr)
        if (parsed.updatedHtml) updatedHtml = parsed.updatedHtml
        if (parsed.explanation) explanation = parsed.explanation
        if (parsed.verdict === "FAIL") verdict = "FAIL"
        if (parsed.final_context_report) finalReport = parsed.final_context_report
    } catch {
        explanation = "Audit completed but QA output was not parseable. HTML passed through as-is."
    }

    // Extract cited research IDs from footnote hrefs
    const citedIds = (state.researchDocs || [])
        .filter(doc => doc.url && updatedHtml.includes(doc.url))
        .map(doc => doc.id)

    console.log(`[V2 Auditor] Verdict: ${verdict} (revision ${currentRevision})`)

    const changeNote = verdict === "PASS"
        ? `QA audit PASSED (revision ${currentRevision}). ${explanation}`
        : `QA audit FAILED (revision ${currentRevision}). Issues found: ${explanation}`

    return {
        finalHtml: updatedHtml,
        explanation,
        citedResearchIds: citedIds,
        critic_feedback: verdict,
        final_context_report: verdict === "PASS" ? finalReport : null,
        revision_count: 1, // Additive reducer: +1 per audit pass
        intermediate_changes: [changeNote],
        worker_log: [{
            node: "Proofreader",
            action: changeNote,
            timestamp: new Date().toISOString(),
        }],
    }
}
