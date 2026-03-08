"use client"

import { useState, useCallback } from "react"
import { LangGraphVisualizer, AVAILABLE_MODELS, DEFAULT_MODEL_ASSIGNMENTS, type NodeStatus, type CostEntry } from "@/components/editor/langgraph-visualizer"
import { Play, RotateCcw, SkipForward, MessageSquareText, Lightbulb, DollarSign, History } from "lucide-react"

// ── Node Labels ───────────────────────────────────────────
const NODE_LABELS: Record<string, string> = {
    triage: "The Dispatcher",
    researcher: "The Librarian",
    drafter: "The Writer",
    integrator: "The Mailroom",
    auditor: "The Proofreader",
    fast_track: "The Shortcut",
}

// ── Scenario Step ─────────────────────────────────────────
interface ScenarioStep {
    status: Record<string, NodeStatus>
    narration: string
    /** Which node just became "active" or "done" at this step (for cost logging) */
    activeNode?: string
}

const DEEP_TRACK_SEQUENCE: ScenarioStep[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt lands on the Dispatcher's desk. Reading it to decide what to do...", activeNode: "triage" },
    { status: { triage: "done", researcher: "active" }, narration: "🔍 The Dispatcher says: \"This needs research.\" Clipboard moves to the Librarian...", activeNode: "researcher" },
    { status: { triage: "done", researcher: "done", drafter: "active" }, narration: "✍️ The Librarian found relevant context. The Writer is now drafting your HTML...", activeNode: "drafter" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active" }, narration: "📦 Draft is written! The Mailroom is finalizing everything...", activeNode: "integrator" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 Almost done! The Proofreader is checking for mistakes...", activeNode: "auditor" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" }, narration: "✅ All clear! The Proofreader approved it. Your email is ready." },
]

const AUDIT_LOOP_SEQUENCE: ScenarioStep[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt lands on the Dispatcher's desk...", activeNode: "triage" },
    { status: { triage: "done", researcher: "active" }, narration: "🔍 Sent to the Librarian for research...", activeNode: "researcher" },
    { status: { triage: "done", researcher: "done", drafter: "active" }, narration: "✍️ The Writer is drafting your email...", activeNode: "drafter" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active" }, narration: "📦 Draft done. The Mailroom is preparing the output...", activeNode: "integrator" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 The Proofreader is checking... wait, something looks wrong...", activeNode: "auditor" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "error" }, narration: "🚨 Mistake found! The Writer forgot the {{main_cta_url}} button variable. Sending the clipboard BACK!" },
    { status: { triage: "done", researcher: "done", drafter: "active", integrator: "pending", auditor: "pending" }, narration: "✍️ The Writer reads the Proofreader's note: \"Add the button variable!\" — fixing now... (2nd pass)", activeNode: "drafter" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active", auditor: "pending" }, narration: "📦 Fixed! Back through the Mailroom... (2nd pass)", activeNode: "integrator" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 The Proofreader checks again... (2nd pass)", activeNode: "auditor" },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" }, narration: "✅ Passed! The button variable is there. Email is ready." },
]

const FAST_TRACK_SEQUENCE: ScenarioStep[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt: \"Change the background color to black.\" The Dispatcher reads this...", activeNode: "triage" },
    { status: { triage: "done", fast_track: "active" }, narration: "⚡ \"This is super simple — skip the Librarian, go straight!\" Taking the shortcut...", activeNode: "fast_track" },
    { status: { triage: "done", fast_track: "done" }, narration: "✅ Done in seconds! Simple edits don't need research, saving you time and money." },
]

const EXAMPLE_PROMPTS: Record<string, string> = {
    deep_track: "\"Write an email offering a $50 discount on summer piano lessons, and include our teaching philosophy.\"",
    audit_loop: "\"Write a promo email for the spring recital.\"  (but the Writer forgets the button variable)",
    fast_track: "\"Change the background color to black.\"",
}

// ── Component ─────────────────────────────────────────────
export default function TestingPage() {
    const [currentStatus, setCurrentStatus] = useState<Record<string, NodeStatus>>({})
    const [stepIndex, setStepIndex] = useState(-1)
    const [activeSequence, setActiveSequence] = useState<ScenarioStep[]>(DEEP_TRACK_SEQUENCE)
    const [sequenceName, setSequenceName] = useState("deep_track")
    const [isPlaying, setIsPlaying] = useState(false)
    const [narration, setNarration] = useState("")
    const [modelAssignments, setModelAssignments] = useState<Record<string, string>>({ ...DEFAULT_MODEL_ASSIGNMENTS })
    const [costHistory, setCostHistory] = useState<CostEntry[]>([])

    const getModelCost = useCallback((nodeId: string) => {
        const modelId = modelAssignments[nodeId] || DEFAULT_MODEL_ASSIGNMENTS[nodeId]
        const model = AVAILABLE_MODELS.find(m => m.id === modelId)
        return {
            cost: model?.estimatedCostPerCall || 0,
            label: model?.label || "Unknown",
        }
    }, [modelAssignments])

    const logCost = useCallback((nodeId: string, stepNum: number) => {
        const { cost, label } = getModelCost(nodeId)
        const nodeLabel = NODE_LABELS[nodeId] || nodeId
        setCostHistory(prev => [...prev, { step: stepNum, nodeId, nodeLabel, modelLabel: label, cost }])
    }, [getModelCost])

    const reset = () => {
        setCurrentStatus({})
        setStepIndex(-1)
        setIsPlaying(false)
        setNarration("")
        setCostHistory([])
    }

    const stepForward = () => {
        const nextIndex = stepIndex + 1
        if (nextIndex < activeSequence.length) {
            setStepIndex(nextIndex)
            setCurrentStatus(activeSequence[nextIndex].status)
            setNarration(activeSequence[nextIndex].narration)
            const activeNode = activeSequence[nextIndex].activeNode
            if (activeNode) logCost(activeNode, nextIndex + 1)
        }
    }

    const playAll = async () => {
        setIsPlaying(true)
        setCurrentStatus({})
        setStepIndex(-1)
        setNarration("")
        setCostHistory([])
        for (let i = 0; i < activeSequence.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1200))
            setStepIndex(i)
            setCurrentStatus(activeSequence[i].status)
            setNarration(activeSequence[i].narration)
            const activeNode = activeSequence[i].activeNode
            if (activeNode) {
                const { cost, label } = getModelCost(activeNode)
                setCostHistory(prev => [...prev, {
                    step: i + 1,
                    nodeId: activeNode,
                    nodeLabel: NODE_LABELS[activeNode] || activeNode,
                    modelLabel: label,
                    cost,
                }])
            }
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

    const handleModelChange = (nodeId: string, modelId: string) => {
        setModelAssignments(prev => ({ ...prev, [nodeId]: modelId }))
    }

    const totalCost = costHistory.reduce((sum, e) => sum + e.cost, 0)

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Testing Editor</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    See how your prompt travels through the AI assembly line — from your instruction to a finished email.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                {/* Left Panel */}
                <div className="space-y-5">

                    {/* How It Works */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-amber-400 mb-1">How does this work?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Think of it as an <strong className="text-foreground">office assembly line</strong>. You write an instruction on
                                    a <strong className="text-foreground">clipboard</strong> and put it on a conveyor belt. It moves from desk to desk.
                                    Each worker does their job and passes it along. You can change <strong className="text-foreground">which AI model</strong> sits
                                    at each desk using the dropdowns on the right.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scenario Picker */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-1">Pick a Scenario</h2>
                        <p className="text-[11px] text-muted-foreground mb-3">Choose a situation to simulate, then hit Play to watch it happen.</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: "deep_track", label: "Full Pipeline", desc: "All desks, happy path" },
                                { id: "audit_loop", label: "Mistake Caught", desc: "Proofreader sends it back" },
                                { id: "fast_track", label: "Quick Shortcut", desc: "Simple task, skip research" },
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => selectSequence(s.id)}
                                    className={`px-3 py-2 text-left rounded-lg border transition-colors ${sequenceName === s.id
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                        }`}
                                >
                                    <span className="text-xs font-semibold block">{s.label}</span>
                                    <span className="text-[10px] opacity-70">{s.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Example Prompt */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-start gap-3">
                            <MessageSquareText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Example Prompt</h2>
                                <p className="text-sm text-foreground italic">{EXAMPLE_PROMPTS[sequenceName]}</p>
                            </div>
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-3">Playback</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={playAll}
                                disabled={isPlaying}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                            >
                                <Play className="w-3.5 h-3.5" />
                                Play All
                            </button>
                            <button
                                onClick={stepForward}
                                disabled={isPlaying || stepIndex >= activeSequence.length - 1}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 disabled:opacity-50 transition-colors"
                            >
                                <SkipForward className="w-3.5 h-3.5" />
                                Next Desk
                            </button>
                            <button
                                onClick={reset}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                            <div className="ml-auto text-xs text-muted-foreground">
                                Desk {Math.max(stepIndex + 1, 0)} of {activeSequence.length}
                            </div>
                        </div>
                    </div>

                    {/* Live Narration */}
                    {narration && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in duration-300">
                            <p className="text-sm text-foreground leading-relaxed">{narration}</p>
                        </div>
                    )}

                    {/* ── Cost History ───────────────────────────── */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-muted-foreground" />
                                <h2 className="text-sm font-semibold">Cost History</h2>
                            </div>
                            {totalCost > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-sm font-bold text-emerald-400">${totalCost.toFixed(4)}</span>
                                    <span className="text-[10px] text-emerald-400/60 ml-0.5">total</span>
                                </div>
                            )}
                        </div>

                        {costHistory.length === 0 ? (
                            <p className="text-xs text-muted-foreground/50 py-4 text-center">Hit Play or Step to see costs appear here as each worker runs.</p>
                        ) : (
                            <div className="space-y-0">
                                {/* Table Header */}
                                <div className="grid grid-cols-[28px_1fr_1fr_70px] gap-2 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                                    <span>#</span>
                                    <span>Worker</span>
                                    <span>Model</span>
                                    <span className="text-right">Cost</span>
                                </div>

                                {/* Rows */}
                                {costHistory.map((entry, i) => {
                                    const model = AVAILABLE_MODELS.find(m => m.label === entry.modelLabel)
                                    return (
                                        <div key={i} className="grid grid-cols-[28px_1fr_1fr_70px] gap-2 px-2 py-1.5 text-xs border-b border-border/50 last:border-0 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <span className="text-muted-foreground/40 font-mono">{entry.step}</span>
                                            <span className="text-foreground font-medium truncate">{entry.nodeLabel}</span>
                                            <span className={`text-[10px] font-semibold truncate ${model?.color?.split(" ")[0] || "text-muted-foreground"}`}>
                                                {entry.modelLabel}
                                            </span>
                                            <span className="text-right font-mono text-muted-foreground">${entry.cost.toFixed(3)}</span>
                                        </div>
                                    )
                                })}

                                {/* Total Row */}
                                <div className="grid grid-cols-[28px_1fr_1fr_70px] gap-2 px-2 py-2 text-xs font-bold border-t-2 border-border mt-1">
                                    <span></span>
                                    <span className="text-foreground">{costHistory.length} API call{costHistory.length !== 1 ? "s" : ""}</span>
                                    <span></span>
                                    <span className="text-right font-mono text-emerald-400">${totalCost.toFixed(3)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Visualizer */}
                <div className="space-y-3">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        The Assembly Line
                    </div>
                    <LangGraphVisualizer
                        currentStatus={currentStatus}
                        modelAssignments={modelAssignments}
                        onModelChange={handleModelChange}
                    />
                </div>
            </div>
        </div>
    )
}
