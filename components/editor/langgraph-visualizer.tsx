"use client"

import { cn } from "@/lib/utils"
import { Brain, Search, PenTool, ShieldCheck, Database, CheckCircle2, Loader2, AlertCircle, Zap, ChevronDown } from "lucide-react"

export type NodeStatus = "pending" | "active" | "done" | "error"

// ── Available Models ──────────────────────────────────────
export interface ModelOption {
    id: string
    label: string
    provider: "google" | "anthropic"
    costPer1kInput: number   // $ per 1K input tokens
    costPer1kOutput: number  // $ per 1K output tokens
    estimatedCostPerCall: number // rough estimate for typical call
    color: string
}

export const AVAILABLE_MODELS: ModelOption[] = [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", costPer1kInput: 0.000075, costPer1kOutput: 0.0003, estimatedCostPerCall: 0.001, color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", costPer1kInput: 0.00125, costPer1kOutput: 0.01, estimatedCostPerCall: 0.015, color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
    { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "anthropic", costPer1kInput: 0.003, costPer1kOutput: 0.015, estimatedCostPerCall: 0.03, color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
    { id: "claude-haiku-3.5", label: "Claude Haiku 3.5", provider: "anthropic", costPer1kInput: 0.0008, costPer1kOutput: 0.004, estimatedCostPerCall: 0.004, color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
]

export const DEFAULT_MODEL_ASSIGNMENTS: Record<string, string> = {
    triage: "gemini-2.5-flash",
    researcher: "gemini-2.5-flash",
    drafter: "claude-sonnet-4",
    integrator: "gemini-2.5-flash",
    auditor: "gemini-2.5-flash",
}

// ── Cost History Entry ────────────────────────────────────
export interface CostEntry {
    step: number
    nodeId: string
    nodeLabel: string
    modelLabel: string
    cost: number
}

// ── Node Definition ───────────────────────────────────────
interface NodeData {
    id: string
    label: string
    subtitle: string
    icon: React.ElementType
    status: NodeStatus
}

const NODE_DEFS: Omit<NodeData, "status">[] = [
    { id: "triage", label: "The Dispatcher", subtitle: "Decides: simple task or needs research?", icon: Brain },
    { id: "researcher", label: "The Librarian", subtitle: "Searches your knowledge base for context", icon: Search },
    { id: "drafter", label: "The Writer", subtitle: "Writes the actual HTML draft", icon: PenTool },
    { id: "integrator", label: "The Mailroom", subtitle: "Finalizes and delivers to your editor", icon: Database },
    { id: "auditor", label: "The Proofreader", subtitle: "Checks for mistakes before showing you", icon: ShieldCheck },
]

// ── Props ─────────────────────────────────────────────────
interface LangGraphVisualizerProps {
    currentStatus?: Record<string, NodeStatus>
    modelAssignments: Record<string, string>
    onModelChange: (nodeId: string, modelId: string) => void
}

export function LangGraphVisualizer({ currentStatus = {}, modelAssignments, onModelChange }: LangGraphVisualizerProps) {
    const nodes: NodeData[] = NODE_DEFS.map(n => ({
        ...n,
        status: currentStatus[n.id] || "pending",
    }))

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
            <p className="text-[10px] text-muted-foreground/60 mb-5">Your prompt moves desk to desk. Pick the AI model for each worker.</p>

            {/* SVG Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                <line x1="24" y1="100" x2="24" y2="520" stroke="currentColor" strokeWidth="2" className="text-border" strokeDasharray="4 4" />
                <path d="M 36 125 C 90 125, 90 90, 150 90" fill="none" stroke="currentColor" strokeWidth="2"
                    className={cn("transition-opacity duration-500", showFastTrack ? "text-emerald-500 opacity-80" : "text-border opacity-30")}
                    strokeDasharray="4 4" />
                <path d="M 12 480 C -40 480, -40 280, 12 280" fill="none" stroke="#f59e0b" strokeWidth="2"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
                <polygon points="12,280 4,275 4,285" fill="#f59e0b"
                    className={cn("transition-opacity duration-500", auditLooping ? "opacity-100" : "opacity-20")} />
            </svg>

            {/* Nodes */}
            <div className="relative z-10 flex flex-col gap-5">
                {nodes.map((node) => {
                    const Icon = node.icon
                    const isDone = node.status === "done"
                    const isActive = node.status === "active"
                    const isError = node.status === "error"
                    const selectedModelId = modelAssignments[node.id] || DEFAULT_MODEL_ASSIGNMENTS[node.id]
                    const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0]

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
                                <span className={cn("text-sm font-bold leading-tight", isActive ? "text-amber-400" : isDone ? "text-foreground" : "text-muted-foreground")}>
                                    {node.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 leading-tight">{node.subtitle}</span>

                                {/* Model Selector */}
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="relative">
                                        <select
                                            value={selectedModelId}
                                            onChange={(e) => onModelChange(node.id, e.target.value)}
                                            className={cn(
                                                "appearance-none text-[10px] font-semibold pl-2 pr-5 py-0.5 rounded border cursor-pointer outline-none",
                                                selectedModel.color
                                            )}
                                        >
                                            {AVAILABLE_MODELS.map(m => (
                                                <option key={m.id} value={m.id}>{m.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-50" />
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/40">${selectedModel.estimatedCostPerCall.toFixed(3)}/call</span>
                                </div>

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
