"use client"

import { useState, useEffect } from "react"
import { getRules, saveRule, deleteRule } from "@/app/actions/rules"
import type { AiPlatformRule, Platform } from "@/lib/types"
import { ShieldCheck, Plus, Trash2, Loader2, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const PLATFORM_COLORS: Record<Platform, string> = {
    email: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    blog: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    global: "bg-amber-500/10 text-amber-400 border-amber-500/30",
}

export default function RulesPage() {
    const [rules, setRules] = useState<AiPlatformRule[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<Partial<AiPlatformRule> | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all")

    useEffect(() => { fetchData() }, [])
    useEffect(() => {
        if (statusMessage) {
            const t = setTimeout(() => setStatusMessage(null), 4000)
            return () => clearTimeout(t)
        }
    }, [statusMessage])

    const fetchData = async () => {
        setLoading(true)
        try { setRules(await getRules()) }
        catch { setStatusMessage({ type: "error", text: "Failed to load rules" }) }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!form?.platform || !form?.rule_text) {
            setStatusMessage({ type: "error", text: "Platform and rule text are required." })
            return
        }
        setIsSaving(true)
        try {
            await saveRule(form)
            setStatusMessage({ type: "success", text: "Rule saved!" })
            setForm(null)
            fetchData()
        } catch (e: unknown) {
            setStatusMessage({ type: "error", text: `Failed: ${e instanceof Error ? e.message : "Unknown"}` })
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this rule?")) return
        await deleteRule(id)
        setStatusMessage({ type: "success", text: "Rule deleted." })
        if (form?.id === id) setForm(null)
        fetchData()
    }

    const filtered = filterPlatform === "all" ? rules : rules.filter(r => r.platform === filterPlatform)

    return (
        <div className="p-6 max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
            {statusMessage && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in ${statusMessage.type === "error" ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-green-500/10 border border-green-500/30 text-green-400"}`}>
                    {statusMessage.text}
                </div>
            )}

            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-blue-500" /> Platform Rules
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Set strict HTML format constraints per platform.</p>
                </div>
                <Button onClick={() => setForm({ platform: "global", rule_text: "" })} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Rule
                </Button>
            </div>

            {/* Platform Filter Tabs */}
            <div className="flex gap-2 mb-4 shrink-0">
                {(["all", "global", "email", "blog"] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setFilterPlatform(p)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterPlatform === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                        {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                        {p !== "all" && <span className="ml-1.5 opacity-60">({rules.filter(r => r.platform === p).length})</span>}
                    </button>
                ))}
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            No rules found.
                        </div>
                    ) : filtered.map(r => (
                        <Card
                            key={r.id}
                            className={`cursor-pointer transition-all hover:border-blue-500/50 ${form?.id === r.id ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
                            onClick={() => setForm(r)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <Badge variant="outline" className={PLATFORM_COLORS[r.platform]}>{r.platform}</Badge>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(r.id) }} className="text-muted-foreground hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-3">{r.rule_text}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="w-2/3 flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {form ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">{form.id ? "Edit Rule" : "New Rule"}</h3>
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleSave} disabled={isSaving || !form.platform || !form.rule_text} size="sm">
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setForm(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Platform *</Label>
                                    <div className="flex gap-2">
                                        {(["global", "email", "blog"] as Platform[]).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setForm({ ...form, platform: p })}
                                                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${form.platform === p ? PLATFORM_COLORS[p] + " border" : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground"}`}
                                            >
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5 flex flex-col flex-1">
                                    <Label className="text-xs">Rule Text *</Label>
                                    <Textarea
                                        value={form.rule_text || ""}
                                        onChange={e => setForm({ ...form, rule_text: e.target.value })}
                                        className="min-h-[300px] font-mono text-sm resize-none bg-muted/30 p-4"
                                        placeholder='e.g. "Use TABLE-based layout for email compatibility. ALL styles must be INLINE. Max content width: 660px."'
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a rule or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
