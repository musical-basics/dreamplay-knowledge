"use client"

import { cn } from "@/lib/utils"
import { Brain, Search, PenTool, ShieldCheck, Database, CheckCircle2, Loader2, AlertCircle, Zap } from "lucide-react"

export type NodeStatus = "pending" | "active" | "done" | "error"

interface NodeData {
    id: string
    label: string
    status: NodeStatus
    icon: React.ElementType
}

interface LangGraphVisualizerProps {
    currentStatus?: Record<string, NodeStatus>
}

export function LangGraphVisualizer({ currentStatus = {} }: LangGraphVisualizerProps) {
    // Maps 1:1 to the actual LangGraph nodes in lib/v2/graph/graph.ts
    const nodes: NodeData[] = [
        { id: "triage", label: "Triage Router", icon: Brain, status: currentStatus["triage"] || "pending" },
        { id: "researcher", label: "RAG Researcher", icon: Search, status: currentStatus["researcher"] || "pending" },
        { id: "drafter", label: "Claude Drafter", icon: PenTool, status: currentStatus["drafter"] || "pending" },
        { id: "integrator", label: "Integrator", icon: Database, status: currentStatus["integrator"] || "pending" },
        { id: "auditor", label: "QA Auditor", icon: ShieldCheck, status: currentStatus["auditor"] || "pending" },
    ]

    // Determine if fast-track path is active/done
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

    return (
        <div className="relative p-4 rounded-xl border border-border bg-card/50 overflow-hidden font-sans">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">Agentic Workflow</h3>

            {/* SVG Background for Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {/* Main vertical line (deep track: triage → researcher → drafter → integrator → auditor) */}
                <line x1="32" y1="60" x2="32" y2="340" stroke="currentColor" strokeWidth="2" className="text-border" strokeDasharray="4 4" />

                {/* Fast-track bypass line (Triage → skip to END) */}
                <path d="M 44 85 C 100 85, 100 50, 160 50" fill="none" stroke="currentColor" strokeWidth="2"
                    className={cn("transition-opacity duration-500", showFastTrack ? "text-emerald-500 opacity-80" : "text-border opacity-30")}
                    strokeDasharray="4 4" />

                {/* The LangGraph CYCLIC LOOP (Auditor back to Drafter) */}
                <path d="M 20 300 C -30 300, -30 175, 20 175" fill="none" stroke="#f59e0b" strokeWidth="2"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />

                {/* Arrow head for the loop */}
                <polygon points="20,175 12,170 12,180" fill="#f59e0b"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
            </svg>

            {/* Nodes */}
            <div className="relative z-10 flex flex-col gap-6">
                {nodes.map((node) => {
                    const Icon = node.icon
                    const isDone = node.status === "done"
                    const isActive = node.status === "active"
                    const isError = node.status === "error"

                    return (
                        <div key={node.id} className={cn("flex items-center gap-4 transition-all duration-300", isActive ? "scale-105 origin-left" : "")}>
                            {/* Node Circle */}
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shadow-sm", getStatusColor(node.status))}>
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

                            {/* Node Label */}
                            <div className="flex flex-col">
                                <span className={cn("text-sm font-bold", isActive ? "text-amber-400" : isDone ? "text-foreground" : "text-muted-foreground")}>
                                    {node.label}
                                </span>

                                {/* Micro-status text */}
                                {isActive && <span className="text-[10px] text-amber-400/80 animate-pulse">Processing state...</span>}
                                {node.id === "auditor" && isError && (
                                    <span className="text-[10px] text-red-400">Failed QA. Routing back to Drafter.</span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {/* Fast-track badge */}
                {showFastTrack && (
                    <div className="absolute top-8 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Fast Track</span>
                    </div>
                )}
            </div>
        </div>
    )
}
