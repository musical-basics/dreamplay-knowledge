"use client"

import { useState } from "react"
import { LangGraphVisualizer, type NodeStatus } from "@/components/editor/langgraph-visualizer"
import { Play, RotateCcw, SkipForward, MessageSquareText, Lightbulb } from "lucide-react"

const NODE_IDS = ["triage", "researcher", "drafter", "integrator", "auditor"] as const
const STATUSES: NodeStatus[] = ["pending", "active", "done", "error"]

const FRIENDLY_NAMES: Record<string, string> = {
    triage: "Dispatcher",
    researcher: "Librarian",
    drafter: "Writer",
    integrator: "Mailroom",
    auditor: "Proofreader",
    fast_track: "Shortcut",
}

// --- Scenario Definitions ---

const DEEP_TRACK_SEQUENCE: { status: Record<string, NodeStatus>; narration: string }[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt lands on the Dispatcher's desk. They're reading it to decide what to do..." },
    { status: { triage: "done", researcher: "active" }, narration: "🔍 The Dispatcher says: \"This needs research.\" The clipboard moves to the Librarian, who's now searching your knowledge base..." },
    { status: { triage: "done", researcher: "done", drafter: "active" }, narration: "✍️ The Librarian found relevant context and wrote it on the clipboard. The Writer is now drafting your HTML..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active" }, narration: "📦 Draft is written! The Mailroom is finalizing everything and preparing to show it to you..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 Almost done! The Proofreader is checking for mistakes — broken links, missing merge tags..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" }, narration: "✅ All clear! The Proofreader approved it. Your finished email is ready." },
]

const AUDIT_LOOP_SEQUENCE: { status: Record<string, NodeStatus>; narration: string }[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt lands on the Dispatcher's desk..." },
    { status: { triage: "done", researcher: "active" }, narration: "🔍 Sent to the Librarian for research..." },
    { status: { triage: "done", researcher: "done", drafter: "active" }, narration: "✍️ The Writer is drafting your email..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active" }, narration: "📦 Draft done. The Mailroom is preparing the output..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 The Proofreader is checking... wait, something looks wrong..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "error" }, narration: "🚨 Mistake found! The Writer forgot the {{main_cta_url}} button variable. Sending the clipboard BACK to the Writer with a red note!" },
    { status: { triage: "done", researcher: "done", drafter: "active", integrator: "pending", auditor: "pending" }, narration: "✍️ The Writer reads the Proofreader's note: \"Add the button variable!\" — fixing the draft now..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "active", auditor: "pending" }, narration: "📦 Fixed! Back through the Mailroom..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "active" }, narration: "🔎 The Proofreader checks again..." },
    { status: { triage: "done", researcher: "done", drafter: "done", integrator: "done", auditor: "done" }, narration: "✅ Passed! The button variable is there. Email is ready." },
]

const FAST_TRACK_SEQUENCE: { status: Record<string, NodeStatus>; narration: string }[] = [
    { status: { triage: "active" }, narration: "📋 Your prompt: \"Change the background color to black.\" The Dispatcher reads this..." },
    { status: { triage: "done", fast_track: "active" }, narration: "⚡ The Dispatcher says: \"This is super simple — skip the Librarian and go straight to the Writer!\" Taking the shortcut..." },
    { status: { triage: "done", fast_track: "done" }, narration: "✅ Done in seconds! Simple edits don't need research, saving you time and API costs." },
]

// --- Example Prompts ---

const EXAMPLE_PROMPTS: Record<string, string> = {
    deep_track: "\"Write an email offering a $50 discount on summer piano lessons, and include our teaching philosophy.\"",
    audit_loop: "\"Write a promo email for the spring recital.\"  (but the Writer forgets the button variable)",
    fast_track: "\"Change the background color to black.\"",
}

export default function TestingPage() {
    const [currentStatus, setCurrentStatus] = useState<Record<string, NodeStatus>>({})
    const [stepIndex, setStepIndex] = useState(-1)
    const [activeSequence, setActiveSequence] = useState(DEEP_TRACK_SEQUENCE)
    const [sequenceName, setSequenceName] = useState("deep_track")
    const [isPlaying, setIsPlaying] = useState(false)
    const [narration, setNarration] = useState("")

    const reset = () => {
        setCurrentStatus({})
        setStepIndex(-1)
        setIsPlaying(false)
        setNarration("")
    }

    const stepForward = () => {
        const nextIndex = stepIndex + 1
        if (nextIndex < activeSequence.length) {
            setStepIndex(nextIndex)
            setCurrentStatus(activeSequence[nextIndex].status)
            setNarration(activeSequence[nextIndex].narration)
        }
    }

    const playAll = async () => {
        setIsPlaying(true)
        setCurrentStatus({})
        setStepIndex(-1)
        setNarration("")
        for (let i = 0; i < activeSequence.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1200))
            setStepIndex(i)
            setCurrentStatus(activeSequence[i].status)
            setNarration(activeSequence[i].narration)
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
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Testing Editor</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    See how your prompt travels through the AI assembly line — from your instruction to a finished email.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
                {/* Left Panel */}
                <div className="space-y-5">

                    {/* How It Works callout */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-amber-400 mb-1">How does this work?</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Think of it as an <strong className="text-foreground">office assembly line</strong>. You write an instruction on
                                    a <strong className="text-foreground">clipboard</strong> and put it on a conveyor belt. It moves from desk to desk.
                                    At each desk sits a specific worker. They read the clipboard, do their job, write their results,
                                    and pass it to the next desk.
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

                    {/* Manual Overrides (collapsed by default for cleanliness) */}
                    <details className="rounded-xl border border-border bg-card overflow-hidden">
                        <summary className="p-4 text-sm font-semibold cursor-pointer hover:bg-muted/50 transition-colors">
                            Advanced: Manual Controls
                        </summary>
                        <div className="p-4 pt-0 border-t border-border mt-0">
                            <p className="text-[11px] text-muted-foreground mb-3">Click any status to manually override a worker&apos;s state.</p>
                            <div className="space-y-2">
                                {[...NODE_IDS, "fast_track" as const].map((nodeId) => (
                                    <div key={nodeId} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-24 truncate">{FRIENDLY_NAMES[nodeId]}</span>
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
                            </div>
                        </div>
                    </details>
                </div>

                {/* Right Panel: Visualizer */}
                <div className="space-y-3">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        The Assembly Line
                    </div>
                    <LangGraphVisualizer currentStatus={currentStatus} />
                </div>
            </div>
        </div>
    )
}
