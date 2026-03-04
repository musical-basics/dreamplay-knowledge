"use client"

import { useState, useEffect } from "react"
import { getContextChunks, saveContextChunk, toggleContextChunk, deleteContextChunk } from "@/app/actions/context-chunks"
import type { AiKnowledgeChunk, ChunkCategory } from "@/lib/types"
import { Megaphone, Plus, Trash2, Loader2, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const CATEGORY_LABELS: Record<ChunkCategory, { label: string; color: string }> = {
    campaign_push: { label: "Campaign Push", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
    company_info: { label: "Company Info", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    ceo_story: { label: "CEO Story", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
}

export default function ContextPage() {
    const [chunks, setChunks] = useState<AiKnowledgeChunk[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<Partial<AiKnowledgeChunk> | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    useEffect(() => { fetchData() }, [])
    useEffect(() => {
        if (statusMessage) {
            const t = setTimeout(() => setStatusMessage(null), 4000)
            return () => clearTimeout(t)
        }
    }, [statusMessage])

    const fetchData = async () => {
        setLoading(true)
        try { setChunks(await getContextChunks()) }
        catch { setStatusMessage({ type: "error", text: "Failed to load context chunks" }) }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!form?.category || !form?.title || !form?.content) {
            setStatusMessage({ type: "error", text: "Category, title, and content are required." })
            return
        }
        setIsSaving(true)
        try {
            await saveContextChunk(form)
            setStatusMessage({ type: "success", text: "Context chunk saved!" })
            setForm(null)
            fetchData()
        } catch (e: unknown) {
            setStatusMessage({ type: "error", text: `Failed: ${e instanceof Error ? e.message : "Unknown"}` })
        }
        setIsSaving(false)
    }

    const handleToggle = async (id: string, is_active: boolean) => {
        try {
            await toggleContextChunk(id, is_active)
            setChunks(prev => prev.map(c => c.id === id ? { ...c, is_active } : c))
            if (form?.id === id) setForm(prev => prev ? { ...prev, is_active } : prev)
        } catch (e: unknown) {
            setStatusMessage({ type: "error", text: `Toggle failed: ${e instanceof Error ? e.message : "Unknown"}` })
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this context chunk?")) return
        await deleteContextChunk(id)
        setStatusMessage({ type: "success", text: "Context chunk deleted." })
        if (form?.id === id) setForm(null)
        fetchData()
    }

    const activeChunks = chunks.filter(c => c.is_active)
    const inactiveChunks = chunks.filter(c => !c.is_active)

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
                        <Megaphone className="w-6 h-6 text-emerald-500" /> Context Chunks
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Toggle marketing context on/off to control what the AI knows about your brand.</p>
                </div>
                <Button onClick={() => setForm({ category: "company_info", title: "", content: "", is_active: false })} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Chunk
                </Button>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-2 overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                    ) : chunks.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            No context chunks added yet.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mt-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Active ({activeChunks.length})</span>
                                <div className="flex-1 border-t border-green-500/20" />
                            </div>
                            {activeChunks.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-3">No active chunks. Toggle chunks on to inject into AI prompts.</p>
                            ) : (
                                <div className="flex flex-col gap-3 mb-4">
                                    {activeChunks.map(c => (
                                        <Card
                                            key={c.id}
                                            className={`cursor-pointer transition-all hover:border-emerald-500/50 ${form?.id === c.id ? "border-emerald-500 ring-1 ring-emerald-500" : ""}`}
                                            onClick={() => setForm(c)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <Badge variant="outline" className={CATEGORY_LABELS[c.category]?.color}>{CATEGORY_LABELS[c.category]?.label}</Badge>
                                                    <Switch checked={c.is_active} onCheckedChange={(val) => handleToggle(c.id, val)} onClick={e => e.stopPropagation()} />
                                                </div>
                                                <h3 className="font-semibold text-sm">{c.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.content}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 mt-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inactive ({inactiveChunks.length})</span>
                                <div className="flex-1 border-t border-border" />
                            </div>
                            {inactiveChunks.map(c => (
                                <Card
                                    key={c.id}
                                    className={`cursor-pointer transition-all opacity-60 hover:opacity-80 hover:border-border ${form?.id === c.id ? "border-emerald-500 ring-1 ring-emerald-500 opacity-100" : ""}`}
                                    onClick={() => setForm(c)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <Badge variant="outline" className={CATEGORY_LABELS[c.category]?.color}>{CATEGORY_LABELS[c.category]?.label}</Badge>
                                            <Switch checked={c.is_active} onCheckedChange={(val) => handleToggle(c.id, val)} onClick={e => e.stopPropagation()} />
                                        </div>
                                        <h3 className="font-semibold text-sm">{c.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.content}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}
                </div>

                <div className="w-2/3 flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {form ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">{form.id ? "Edit Context Chunk" : "New Context Chunk"}</h3>
                                <div className="flex items-center gap-2">
                                    {form.id && (
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(form.id!)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button onClick={handleSave} disabled={isSaving || !form.category || !form.title || !form.content} size="sm">
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
                                    <Label className="text-xs">Category *</Label>
                                    <div className="flex gap-2">
                                        {(Object.keys(CATEGORY_LABELS) as ChunkCategory[]).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setForm({ ...form, category: cat })}
                                                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${form.category === cat ? CATEGORY_LABELS[cat].color + " border" : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground"}`}
                                            >
                                                {CATEGORY_LABELS[cat].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Title *</Label>
                                    <Input value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} placeholder='e.g. "Spring 2025 Launch Campaign"' />
                                </div>
                                <div className="space-y-1.5 flex flex-col flex-1">
                                    <Label className="text-xs">Content *</Label>
                                    <Textarea
                                        value={form.content || ""}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        className="min-h-[300px] font-mono text-sm resize-none bg-muted/30 p-4"
                                        placeholder="Paste marketing copy, brand context, CEO story, or campaign talking points here..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Megaphone className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a context chunk or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
