"use client"

import { useState } from "react"
import { LangGraphVisualizer, type NodeStatus } from "@/components/editor/langgraph-visualizer"
import { Play, RotateCcw, SkipForward, FastForward } from "lucide-react"

const NODE_IDS = ["triage", "researcher", "drafter", "integrator", "auditor"] as const
const STATUSES: NodeStatus[] = ["pending", "active", "done", "error"]

const DEEP_TRACK_SEQUENCE: Record<string, NodeStatus>[] = [
    { triage: "active" },
    { triage: "done", researcher: "active" },
    { triage: "done", researcher: "done", drafter: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" },
]

const AUDIT_LOOP_SEQUENCE: Record<string, NodeStatus>[] = [
    { triage: "active" },
    { triage: "done", researcher: "active" },
    { triage: "done", researcher: "done", drafter: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "error" },
    { triage: "done", researcher: "done", drafter: "active", integrator: "pending", auditor: "pending" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "active", auditor: "pending" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" },
    { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" },
]

const FAST_TRACK_SEQUENCE: Record<string, NodeStatus>[] = [
    { triage: "active" },
    { triage: "done", fast_track: "active" },
    { triage: "done", fast_track: "done" },
]

export default function TestingPage() {
    const [currentStatus, setCurrentStatus] = useState<Record<string, NodeStatus>>({})
    const [stepIndex, setStepIndex] = useState(-1)
    const [activeSequence, setActiveSequence] = useState<Record<string, NodeStatus>[]>(DEEP_TRACK_SEQUENCE)
    const [sequenceName, setSequenceName] = useState("deep_track")
    const [isPlaying, setIsPlaying] = useState(false)

    const reset = () => {
        setCurrentStatus({})
        setStepIndex(-1)
        setIsPlaying(false)
    }

    const stepForward = () => {
        const nextIndex = stepIndex + 1
        if (nextIndex < activeSequence.length) {
            setStepIndex(nextIndex)
            setCurrentStatus(activeSequence[nextIndex])
        }
    }

    const playAll = async () => {
        setIsPlaying(true)
        reset()
        for (let i = 0; i < activeSequence.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 800))
            setStepIndex(i)
            setCurrentStatus(activeSequence[i])
        }
        setIsPlaying(false)
    }

    const selectSequence = (name: string) => {
        setSequenceName(name)
        reset()
        switch (name) {
            case "deep_track": setActiveSequence(DEEP_TRACK_SEQUENCE); break
            case "audit_loop": setActiveSequence(AUDIT_LOOP_SEQUENCE); break
            case "fast_track": setActiveSequence(FAST_TRACK_SEQUENCE); break
        }
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Testing Editor</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Visual testing for the LangGraph content pipeline. Mock node states and simulate flows.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
                {/* Left Panel: Controls */}
                <div className="space-y-6">
                    {/* Scenario Picker */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-3">Scenario</h2>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: "deep_track", label: "Deep Track (happy path)" },
                                { id: "audit_loop", label: "Audit Loop (rejection)" },
                                { id: "fast_track", label: "Fast Track (bypass)" },
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => selectSequence(s.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${sequenceName === s.id
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-3">Playback</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={playAll}
                                disabled={isPlaying}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                            >
                                <Play className="w-3.5 h-3.5" />
                                Play All
                            </button>
                            <button
                                onClick={stepForward}
                                disabled={isPlaying || stepIndex >= activeSequence.length - 1}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 disabled:opacity-50 transition-colors"
                            >
                                <SkipForward className="w-3.5 h-3.5" />
                                Step
                            </button>
                            <button
                                onClick={reset}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                            <div className="ml-auto text-xs text-muted-foreground">
                                Step {stepIndex + 1} / {activeSequence.length}
                            </div>
                        </div>
                    </div>

                    {/* Manual Node Overrides */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-3">Manual Node Override</h2>
                        <div className="space-y-2">
                            {NODE_IDS.map((nodeId) => (
                                <div key={nodeId} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-muted-foreground w-24 truncate">{nodeId}</span>
                                    <div className="flex gap-1">
                                        {STATUSES.map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => setCurrentStatus(prev => ({ ...prev, [nodeId]: status }))}
                                                className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${currentStatus[nodeId] === status
                                                        ? status === "done" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                            : status === "active" ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                                                : status === "error" ? "bg-red-500/20 border-red-500/50 text-red-400"
                                                                    : "bg-muted border-border text-foreground"
                                                        : "bg-transparent border-border/50 text-muted-foreground hover:bg-muted/50"
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {/* Fast track override */}
                            <div className="flex items-center gap-3 border-t border-border pt-2 mt-2">
                                <span className="text-xs font-mono text-muted-foreground w-24 truncate">fast_track</span>
                                <div className="flex gap-1">
                                    {STATUSES.map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setCurrentStatus(prev => ({ ...prev, fast_track: status }))}
                                            className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${currentStatus["fast_track"] === status
                                                    ? status === "done" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                        : status === "active" ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                                            : status === "error" ? "bg-red-500/20 border-red-500/50 text-red-400"
                                                                : "bg-muted border-border text-foreground"
                                                    : "bg-transparent border-border/50 text-muted-foreground hover:bg-muted/50"
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current State JSON */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-3">Current State</h2>
                        <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-auto text-muted-foreground">
                            {JSON.stringify(currentStatus, null, 2) || "{}"}
                        </pre>
                    </div>
                </div>

                {/* Right Panel: Visualizer (simulates sidebar width) */}
                <div className="space-y-4">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Sidebar Preview (350px)
                    </div>
                    <LangGraphVisualizer currentStatus={currentStatus} />
                </div>
            </div>
        </div>
    )
}
