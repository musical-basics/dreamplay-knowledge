"use client"

import { useState, useEffect } from "react"
import { getResearchTags, saveResearchTag, deleteResearchTag } from "@/app/actions/research-tags"
import type { ResearchTag } from "@/lib/types"
import { Tags, Plus, Trash2, Loader2, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

export default function ResearchTagsPage() {
    const [tags, setTags] = useState<ResearchTag[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<Partial<ResearchTag> | null>(null)
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
        try { setTags(await getResearchTags()) }
        catch { setStatusMessage({ type: "error", text: "Failed to load tags" }) }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!form?.name) {
            setStatusMessage({ type: "error", text: "Tag name is required." })
            return
        }
        setIsSaving(true)
        try {
            await saveResearchTag(form)
            setStatusMessage({ type: "success", text: "Tag saved!" })
            setForm(null)
            fetchData()
        } catch (e: unknown) {
            setStatusMessage({ type: "error", text: `Failed: ${e instanceof Error ? e.message : "Unknown"}` })
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this tag? It will be removed from all linked research documents.")) return
        await deleteResearchTag(id)
        setStatusMessage({ type: "success", text: "Tag deleted." })
        if (form?.id === id) setForm(null)
        fetchData()
    }

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
                        <Tags className="w-6 h-6 text-cyan-500" /> Research Tags
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage the taxonomy used to classify research documents for Agentic RAG retrieval.</p>
                </div>
                <Button onClick={() => setForm({ name: "", description: "" })} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Tag
                </Button>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                    ) : tags.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            No tags added yet. Tags help the AI find relevant research faster.
                        </div>
                    ) : tags.map(tag => (
                        <Card
                            key={tag.id}
                            className={`cursor-pointer transition-all hover:border-cyan-500/50 ${form?.id === tag.id ? "border-cyan-500 ring-1 ring-cyan-500" : ""}`}
                            onClick={() => setForm(tag)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <h3 className="font-semibold text-sm">{tag.name}</h3>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(tag.id) }} className="text-muted-foreground hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {tag.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tag.description}</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="w-2/3 flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {form ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">{form.id ? "Edit Tag" : "New Tag"}</h3>
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleSave} disabled={isSaving || !form.name} size="sm">
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
                                    <Label className="text-xs">Tag Name *</Label>
                                    <Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Ergonomics", "Piano Pedagogy", "Motor Learning"' />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Description (helps AI understand the tag)</Label>
                                    <Textarea
                                        value={form.description || ""}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="min-h-[150px] font-mono text-sm resize-none bg-muted/30 p-4"
                                        placeholder="Research related to ergonomic design of musical instruments, hand health, repetitive strain injury prevention..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Tags className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a tag or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
