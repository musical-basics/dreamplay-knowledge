"use client"

import { useState, useEffect } from "react"
import { getMissions, saveMission, deleteMission } from "@/app/actions/missions"
import type { AiMission } from "@/lib/types"
import { Target, Plus, Trash2, Loader2, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

export default function MissionsPage() {
    const [missions, setMissions] = useState<AiMission[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<Partial<AiMission> | null>(null)
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
        try { setMissions(await getMissions()) }
        catch { setStatusMessage({ type: "error", text: "Failed to load missions" }) }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!form?.name || !form?.objective_prompt) {
            setStatusMessage({ type: "error", text: "Name and objective prompt are required." })
            return
        }
        setIsSaving(true)
        try {
            await saveMission(form)
            setStatusMessage({ type: "success", text: "Mission saved!" })
            setForm(null)
            fetchData()
        } catch (e: unknown) {
            setStatusMessage({ type: "error", text: `Failed: ${e instanceof Error ? e.message : "Unknown"}` })
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this mission?")) return
        await deleteMission(id)
        setStatusMessage({ type: "success", text: "Mission deleted." })
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
                        <Target className="w-6 h-6 text-amber-500" /> AI Missions
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Define generation goals, CTR optimization strategies, and psychological objectives.</p>
                </div>
                <Button onClick={() => setForm({ name: "", objective_prompt: "" })} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Mission
                </Button>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                    ) : missions.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            No missions added yet.
                        </div>
                    ) : missions.map(m => (
                        <Card
                            key={m.id}
                            className={`cursor-pointer transition-all hover:border-amber-500/50 ${form?.id === m.id ? "border-amber-500 ring-1 ring-amber-500" : ""}`}
                            onClick={() => setForm(m)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <h3 className="font-semibold text-sm">{m.name}</h3>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(m.id) }} className="text-muted-foreground hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.objective_prompt}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="w-2/3 flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {form ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">{form.id ? "Edit Mission" : "New Mission"}</h3>
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleSave} disabled={isSaving || !form.name || !form.objective_prompt} size="sm">
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
                                    <Label className="text-xs">Mission Name *</Label>
                                    <Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Educate", "Hard Sell", "Keep Warm"' />
                                </div>
                                <div className="space-y-1.5 flex flex-col flex-1">
                                    <Label className="text-xs">Objective Prompt *</Label>
                                    <Textarea
                                        value={form.objective_prompt || ""}
                                        onChange={e => setForm({ ...form, objective_prompt: e.target.value })}
                                        className="min-h-[300px] font-mono text-sm resize-none bg-muted/30 p-4"
                                        placeholder="Your primary goal is to educate the reader with actionable insights while subtly building trust in the DreamPlay brand. Use micro-commitments, cite research, and always end with a clear next step..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Target className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a mission or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
