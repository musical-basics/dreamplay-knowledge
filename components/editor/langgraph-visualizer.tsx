"use client"

import { cn } from "@/lib/utils"
import { Brain, Search, PenTool, ShieldCheck, Database, CheckCircle2, Loader2, AlertCircle, Zap } from "lucide-react"

export type NodeStatus = "pending" | "active" | "done" | "error"

interface NodeData {
    id: string
    label: string
    subtitle: string
    icon: React.ElementType
    status: NodeStatus
}

interface LangGraphVisualizerProps {
    currentStatus?: Record<string, NodeStatus>
}

export function LangGraphVisualizer({ currentStatus = {} }: LangGraphVisualizerProps) {
    const nodes: NodeData[] = [
        {
            id: "triage",
            label: "The Dispatcher",
            subtitle: "Decides: simple task or needs research?",
            icon: Brain,
            status: currentStatus["triage"] || "pending",
        },
        {
            id: "researcher",
            label: "The Librarian",
            subtitle: "Searches your knowledge base for context",
            icon: Search,
            status: currentStatus["researcher"] || "pending",
        },
        {
            id: "drafter",
            label: "The Writer",
            subtitle: "Writes the actual HTML draft",
            icon: PenTool,
            status: currentStatus["drafter"] || "pending",
        },
        {
            id: "integrator",
            label: "The Mailroom",
            subtitle: "Finalizes and delivers to your editor",
            icon: Database,
            status: currentStatus["integrator"] || "pending",
        },
        {
            id: "auditor",
            label: "The Proofreader",
            subtitle: "Checks for mistakes before showing you",
            icon: ShieldCheck,
            status: currentStatus["auditor"] || "pending",
        },
    ]

    const fastTrackStatus = currentStatus["fast_track"] || "pending"
    const showFastTrack = fastTrackStatus === "active" || fastTrackStatus === "done"
    const auditLooping = currentStatus["auditor"] === "error"

    const getStatusColor = (status: NodeStatus) => {
        switch (status) {
            case "done": return "text-emerald-500 border-emerald-500/50 bg-emerald-500/10"
            case "active": return "text-amber-400 border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/20"
            case "error": return "text-red-500 border-red-500/50 bg-red-500/10"
            default: return "text-muted-foreground border-border bg-muted/30"
        }
    }

    const getActiveMessage = (id: string) => {
        switch (id) {
            case "triage": return "Reading your prompt..."
            case "researcher": return "Searching your knowledge base..."
            case "drafter": return "Writing the draft..."
            case "integrator": return "Finalizing output..."
            case "auditor": return "Proofreading the draft..."
            default: return "Working..."
        }
    }

    return (
        <div className="relative p-4 rounded-xl border border-border bg-card/50 overflow-hidden font-sans">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assembly Line</h3>
            <p className="text-[10px] text-muted-foreground/60 mb-5">Your prompt moves desk to desk, like a clipboard on a conveyor belt.</p>

            {/* SVG Background for Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {/* Main vertical line */}
                <line x1="32" y1="80" x2="32" y2="370" stroke="currentColor" strokeWidth="2" className="text-border" strokeDasharray="4 4" />

                {/* Fast-track bypass */}
                <path d="M 44 105 C 100 105, 100 70, 160 70" fill="none" stroke="currentColor" strokeWidth="2"
                    className={cn("transition-opacity duration-500", showFastTrack ? "text-emerald-500 opacity-80" : "text-border opacity-30")}
                    strokeDasharray="4 4" />

                {/* Audit loop (Proofreader sends it back to Writer) */}
                <path d="M 20 330 C -30 330, -30 195, 20 195" fill="none" stroke="#f59e0b" strokeWidth="2"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
                <polygon points="20,195 12,190 12,200" fill="#f59e0b"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
            </svg>

            {/* Nodes */}
            <div className="relative z-10 flex flex-col gap-5">
                {nodes.map((node) => {
                    const Icon = node.icon
                    const isDone = node.status === "done"
                    const isActive = node.status === "active"
                    const isError = node.status === "error"

                    return (
                        <div key={node.id} className={cn("flex items-center gap-4 transition-all duration-300", isActive ? "scale-105 origin-left" : "")}>
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shadow-sm shrink-0", getStatusColor(node.status))}>
                                {isActive ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isDone ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : isError ? (
                                    <AlertCircle className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-5 h-5 opacity-50" />
                                )}
                            </div>

                            <div className="flex flex-col min-w-0">
                                <span className={cn("text-sm font-bold", isActive ? "text-amber-400" : isDone ? "text-foreground" : "text-muted-foreground")}>
                                    {node.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 leading-tight">{node.subtitle}</span>

                                {isActive && <span className="text-[10px] text-amber-400/80 animate-pulse mt-0.5">{getActiveMessage(node.id)}</span>}
                                {node.id === "auditor" && isError && (
                                    <span className="text-[10px] text-red-400 mt-0.5">Found a mistake! Sending back to The Writer.</span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {showFastTrack && (
                    <div className="absolute top-0 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Shortcut</span>
                    </div>
                )}
            </div>
        </div>
    )
}
