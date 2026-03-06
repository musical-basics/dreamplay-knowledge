import { StateGraph, END } from "@langchain/langgraph"
import { ContentGraphState, type ContentState } from "./state"
import { getCheckpointer } from "./checkpointer"
import { triageNode, fastTrackNode } from "./nodes/triage"
import { researcherNode } from "./nodes/researcher"
import { drafterNode } from "./nodes/drafter"
import { integratorNode } from "./nodes/integrator"
import { auditorNode } from "./nodes/auditor"

/**
 * V2 Content Generation Graph
 *
 * Flow:
 *   Triage → [FAST_TRACK] → FastTrackDrafter → END
 *          → [DEEP_TRACK] → Researcher → Drafter → Integrator → Auditor
 *                                          ↑                        │
 *                                          └──── (FAIL, max 2) ─────┘
 *                                                     │
 *                                                  (PASS) → END
 */

const MAX_REVISIONS = 2

function routeAfterTriage(state: ContentState): string {
    if (state.track === "FAST_TRACK" && state.currentHtml) {
        return "fast_track"
    }
    return "researcher"
}

function routeAfterAuditor(state: ContentState): string {
    if (state.critic_feedback === "FAIL" && (state.revision_count || 0) < MAX_REVISIONS) {
        console.log(`[V2 Graph] Auditor FAIL — looping back to Drafter (revision ${state.revision_count})`)
        return "drafter"
    }
    return END
}

/**
 * Build the compiled V2 content generation graph.
 * Checkpointer uses v2_ai_schema (pre-provisioned, no setup()).
 */
export function buildContentGraph() {
    const checkpointer = getCheckpointer()

    const graph = new StateGraph(ContentGraphState)
        // ── Add nodes ────────────────────────────────────
        .addNode("triage", triageNode)
        .addNode("fast_track", fastTrackNode)
        .addNode("researcher", researcherNode)
        .addNode("drafter", drafterNode)
        .addNode("integrator", integratorNode)
        .addNode("auditor", auditorNode)

        // ── Entry point ──────────────────────────────────
        .addEdge("__start__", "triage")

        // ── Conditional routing after triage ─────────────
        .addConditionalEdges("triage", routeAfterTriage, {
            fast_track: "fast_track",
            researcher: "researcher",
        })

        // ── Fast track → END ─────────────────────────────
        .addEdge("fast_track", END)

        // ── Deep track linear flow ───────────────────────
        .addEdge("researcher", "drafter")
        .addEdge("drafter", "integrator")
        .addEdge("integrator", "auditor")

        // ── Auditor → loop or END ────────────────────────
        .addConditionalEdges("auditor", routeAfterAuditor, {
            drafter: "drafter",
            [END]: END,
        })

    return graph.compile({ checkpointer })
}
