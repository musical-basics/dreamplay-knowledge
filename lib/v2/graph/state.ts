import { Annotation } from "@langchain/langgraph"

/**
 * V2 Content Generation Pipeline — State Definition
 *
 * This state flows through the LangGraph nodes:
 *   Triage → [FastTrack | Researcher → Drafter → Integrator → Auditor] → END
 *
 * Maps to the existing ContextPayload + PipelineResult from pipeline.ts.
 */

export const ContentGraphState = Annotation.Root({
    // ── Input fields ─────────────────────────────────────
    userPrompt: Annotation<string>,
    currentHtml: Annotation<string | undefined>,
    platform: Annotation<"blog" | "email">,

    // ── Context fields (populated by Researcher node) ────
    persona: Annotation<{ name: string; prompt_snippet: string } | null>,
    mission: Annotation<{ name: string; objective_prompt: string } | null>,
    rulesBlock: Annotation<string>,
    contextBlock: Annotation<string>,
    researchBlock: Annotation<string>,
    researchDocs: Annotation<{ id: string; title: string; url: string | null }[]>,
    assets: Annotation<Record<string, string> | undefined>,

    // ── Pipeline control ─────────────────────────────────
    track: Annotation<"FAST_TRACK" | "DEEP_TRACK">,
    revision_count: Annotation<number>,
    critic_feedback: Annotation<"PASS" | "FAIL" | "">,

    // ── Pipeline outputs ─────────────────────────────────
    draftHtml: Annotation<string>,
    refinedHtml: Annotation<string>,
    finalHtml: Annotation<string>,
    explanation: Annotation<string>,
    citedResearchIds: Annotation<string[]>,
})

/**
 * Type alias for the graph state
 */
export type ContentState = typeof ContentGraphState.State
