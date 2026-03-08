"use client"

import { cn } from "@/lib/utils"
import { Brain, Search, PenTool, ShieldCheck, Database, CheckCircle2, Loader2, AlertCircle, Zap } from "lucide-react"

export type NodeStatus = "pending" | "active" | "done" | "error"

interface NodeData {
    id: string
    label: string
    subtitle: string
    model: string
    modelColor: string
    costEstimate: string
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
            model: "Gemini 2.5 Flash",
            modelColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
            costEstimate: "~$0.001",
            icon: Brain,
            status: currentStatus["triage"] || "pending",
        },
        {
            id: "researcher",
            label: "The Librarian",
            subtitle: "Searches your knowledge base for context",
            model: "Gemini 2.5 Flash + DB",
            modelColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
            costEstimate: "~$0.002",
            icon: Search,
            status: currentStatus["researcher"] || "pending",
        },
        {
            id: "drafter",
            label: "The Writer",
            subtitle: "Writes the actual HTML draft",
            model: "Claude Sonnet 4",
            modelColor: "text-orange-400 bg-orange-500/10 border-orange-500/25",
            costEstimate: "~$0.03",
            icon: PenTool,
            status: currentStatus["drafter"] || "pending",
        },
        {
            id: "integrator",
            label: "The Mailroom",
            subtitle: "Finalizes and delivers to your editor",
            model: "Gemini 2.5 Flash",
            modelColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
            costEstimate: "~$0.002",
            icon: Database,
            status: currentStatus["integrator"] || "pending",
        },
        {
            id: "auditor",
            label: "The Proofreader",
            subtitle: "Checks for mistakes before showing you",
            model: "Gemini 2.5 Flash",
            modelColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
            costEstimate: "~$0.002",
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

    // Calculate total estimated cost for completed nodes
    const completedNodes = nodes.filter(n => n.status === "done")
    const totalCostStr = completedNodes.length > 0
        ? `~$${completedNodes.reduce((sum, n) => sum + parseFloat(n.costEstimate.replace(/[~$]/g, "")), 0).toFixed(3)}`
        : null

    return (
        <div className="relative p-4 rounded-xl border border-border bg-card/50 overflow-hidden font-sans">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assembly Line</h3>
                {totalCostStr && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        Total: {totalCostStr}
                    </span>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mb-5">Your prompt moves desk to desk, like a clipboard on a conveyor belt.</p>

            {/* SVG Background for Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                <line x1="24" y1="90" x2="24" y2="440" stroke="currentColor" strokeWidth="2" className="text-border" strokeDasharray="4 4" />
                <path d="M 36 115 C 90 115, 90 80, 150 80" fill="none" stroke="currentColor" strokeWidth="2"
                    className={cn("transition-opacity duration-500", showFastTrack ? "text-emerald-500 opacity-80" : "text-border opacity-30")}
                    strokeDasharray="4 4" />
                <path d="M 12 400 C -40 400, -40 240, 12 240" fill="none" stroke="#f59e0b" strokeWidth="2"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
                <polygon points="12,240 4,235 4,245" fill="#f59e0b"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
            </svg>

            {/* Nodes */}
            <div className="relative z-10 flex flex-col gap-4">
                {nodes.map((node) => {
                    const Icon = node.icon
                    const isDone = node.status === "done"
                    const isActive = node.status === "active"
                    const isError = node.status === "error"

                    return (
                        <div key={node.id} className={cn("flex items-start gap-3 transition-all duration-300", isActive ? "scale-[1.02] origin-left" : "")}>
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors shadow-sm shrink-0 mt-0.5", getStatusColor(node.status))}>
                                {isActive ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isDone ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : isError ? (
                                    <AlertCircle className="w-4 h-4" />
                                ) : (
                                    <Icon className="w-4 h-4 opacity-50" />
                                )}
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn("text-sm font-bold leading-tight", isActive ? "text-amber-400" : isDone ? "text-foreground" : "text-muted-foreground")}>
                                        {node.label}
                                    </span>
                                    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border leading-none", node.modelColor)}>
                                        {node.model}
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 leading-tight">{node.subtitle}</span>
                                <span className="text-[9px] text-muted-foreground/40 mt-0.5">{node.costEstimate}/call</span>

                                {isActive && <span className="text-[10px] text-amber-400/80 animate-pulse mt-0.5">{getActiveMessage(node.id)}</span>}
                                {node.id === "auditor" && isError && (
                                    <span className="text-[10px] text-red-400 mt-0.5">Found a mistake! Sending back to The Writer.</span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {showFastTrack && (
                    <div className="absolute top-0 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Shortcut</span>
                    </div>
                )}
            </div>
        </div>
    )
}
