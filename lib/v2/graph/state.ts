import { Annotation } from "@langchain/langgraph"

/**
 * V2 Content Generation Pipeline — State Definition
 *
 * This state flows through the LangGraph nodes:
 *   Triage → [FastTrack | Researcher → Drafter → Integrator → Auditor] → END
 *
 * Maps to the existing ContextPayload + PipelineResult from pipeline.ts.
 */

// ── Shared Context Types ──────────────────────────────────
export interface WorkerLogEntry {
    node: string
    action: string
    timestamp: string
}

export interface FinalContextReport {
    background_thinking: string
    docs_retrieved: number
    quotes_used: string[]
    topics_covered: string[]
    ctas_added: string[]
    styling_used: string
}

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
    revision_count: Annotation<number>({
        reducer: (current, update) => current + update,
        default: () => 0,
    }),
    critic_feedback: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "",
    }),

    // ── Shared Context Ledger ────────────────────────────
    worker_log: Annotation<WorkerLogEntry[]>({
        reducer: (current, update) => [...current, ...update],
        default: () => [],
    }),
    intermediate_changes: Annotation<string[]>({
        reducer: (current, update) => [...current, ...update],
        default: () => [],
    }),
    final_context_report: Annotation<FinalContextReport | null>({
        reducer: (_current, update) => update,
        default: () => null,
    }),

    // ── Pipeline outputs ─────────────────────────────────
    draftHtml: Annotation<string>,
    refinedHtml: Annotation<string>,
    finalHtml: Annotation<string>,
    explanation: Annotation<string>,
    citedResearchIds: Annotation<string[]>({
        reducer: (_current, update) => update,
        default: () => [],
    }),
})

/**
 * Type alias for the graph state
 */
export type ContentState = typeof ContentGraphState.State
