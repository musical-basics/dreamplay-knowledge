"use client"

import { useState, useEffect, useRef } from "react"
import { getKnowledgebase, saveResearchDoc, toggleResearchStatus, deleteResearchDoc, extractPdf, extractFromR2, generateAbstract, type ResearchDoc } from "@/app/actions/knowledgebase"
import { BookOpen, UploadCloud, Loader2, Plus, Trash2, X, Save, Zap, FileText, ExternalLink, ArrowUp, ArrowDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function ResearchPage() {
    const [docs, setDocs] = useState<ResearchDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<Partial<ResearchDoc> | null>(null)
    const [isConverting, setIsConverting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [extractingId, setExtractingId] = useState<string | null>(null)
    const [generatingAbstractId, setGeneratingAbstractId] = useState<string | null>(null)
    const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({})
    const [isSavingActivations, setIsSavingActivations] = useState(false)
    const [sortAsc, setSortAsc] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { fetchDocs() }, [])
    useEffect(() => {
        if (statusMessage) {
            const t = setTimeout(() => setStatusMessage(null), 4000)
            return () => clearTimeout(t)
        }
    }, [statusMessage])

    const fetchDocs = async () => {
        setLoading(true)
        try { setDocs(await getKnowledgebase()) }
        catch { setStatusMessage({ type: "error", text: "Failed to load knowledgebase" }) }
        setLoading(false)
    }

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsConverting(true)
        setStatusMessage({ type: "success", text: "Extracting PDF... Gemini is reading the document (~15s)." })
        try {
            const fd = new FormData()
            fd.append("file", file)
            const data = await extractPdf(fd)
            if (data.error) throw new Error(data.error)
            setForm(prev => ({
                ...prev,
                title: prev?.title || file.name.replace(".pdf", ""),
                content: data.markdown
            }))
            setStatusMessage({ type: "success", text: "PDF successfully converted to Markdown!" })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error"
            setStatusMessage({ type: "error", text: `Extraction failed: ${message}` })
        } finally {
            setIsConverting(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleSave = async () => {
        if (!form?.title || !form?.content) {
            setStatusMessage({ type: "error", text: "Title and content are required." })
            return
        }
        setIsSaving(true)
        try {
            await saveResearchDoc(form)
            setStatusMessage({ type: "success", text: "Saved to Knowledgebase!" })
            setForm(null)
            fetchDocs()
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: `Failed to save: ${error instanceof Error ? error.message : "Unknown"}` })
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this source forever?")) return
        await deleteResearchDoc(id)
        setStatusMessage({ type: "success", text: "Source deleted." })
        if (form?.id === id) setForm(null)
        fetchDocs()
    }

    const handleExtractFromR2 = async (id: string) => {
        setExtractingId(id)
        setStatusMessage({ type: "success", text: "Extracting PDF with Gemini... This may take 15-30 seconds." })
        try {
            const result = await extractFromR2(id)
            if (result.error) throw new Error(result.error)
            setStatusMessage({ type: "success", text: "PDF extracted and saved!" })
            fetchDocs()
            if (form?.id === id) {
                const updated = (await getKnowledgebase()).find(d => d.id === id)
                if (updated) setForm(updated)
            }
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: `Extraction failed: ${error instanceof Error ? error.message : "Unknown"}` })
        } finally { setExtractingId(null) }
    }

    const handleGenerateAbstract = async (id: string) => {
        setGeneratingAbstractId(id)
        setStatusMessage({ type: "success", text: "Generating abstract..." })
        try {
            const result = await generateAbstract(id)
            if (result.error) throw new Error(result.error)
            setStatusMessage({ type: "success", text: "Abstract generated!" })
            fetchDocs()
            if (form?.id === id) {
                const updated = (await getKnowledgebase()).find(d => d.id === id)
                if (updated) setForm(updated)
            }
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: `Abstract failed: ${error instanceof Error ? error.message : "Unknown"}` })
        } finally { setGeneratingAbstractId(null) }
    }

    const handleLocalToggle = (docId: string, newVal: boolean) => {
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, is_active: newVal } : d))
        setPendingToggles(prev => ({ ...prev, [docId]: newVal }))
        if (form?.id === docId) setForm(prev => prev ? { ...prev, is_active: newVal } : prev)
    }

    const handleSaveActivations = async () => {
        const entries = Object.entries(pendingToggles)
        if (entries.length === 0) return
        setIsSavingActivations(true)
        try {
            await Promise.all(entries.map(([id, val]) => toggleResearchStatus(id, val)))
            setPendingToggles({})
            setStatusMessage({ type: "success", text: `Saved activation for ${entries.length} source(s).` })
        } catch (error: unknown) {
            setStatusMessage({ type: "error", text: `Failed: ${error instanceof Error ? error.message : "Unknown"}` })
        } finally { setIsSavingActivations(false) }
    }

    const hasPendingToggles = Object.keys(pendingToggles).length > 0

    const sorted = [...docs].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime()
        const timeB = new Date(b.created_at).getTime()
        return sortAsc ? timeA - timeB : timeB - timeA
    })
    const activeDocs = sorted.filter(d => d.is_active)
    const inactiveDocs = sorted.filter(d => !d.is_active)

    const renderCard = (doc: ResearchDoc) => (
        <Card
            key={doc.id}
            className={`cursor-pointer transition-all hover:border-primary/50 ${form?.id === doc.id ? "border-primary ring-1 ring-primary" : ""} ${!doc.is_active ? "opacity-60" : ""}`}
            onClick={() => setForm(doc)}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{doc.title}</h3>
                    <Switch checked={doc.is_active} onCheckedChange={(val) => handleLocalToggle(doc.id, val)} onClick={e => e.stopPropagation()} />
                </div>
                <p className="text-xs text-muted-foreground">
                    {doc.author || doc.source || "Unknown"} {doc.year ? `(${doc.year})` : ""}
                </p>
                <div className="flex items-center gap-2 mt-2">
                    {doc.citation_count > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                            {doc.citation_count} citation{doc.citation_count !== 1 ? "s" : ""}
                        </Badge>
                    )}
                    {doc.abstract && (
                        <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-400 border-violet-500/30">
                            Abstract ✓
                        </Badge>
                    )}
                </div>
                {doc.r2_key && !doc.content && (
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleExtractFromR2(doc.id) }}
                            disabled={extractingId === doc.id}
                            className="flex items-center gap-1 text-[10px] font-medium text-yellow-500 hover:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                        >
                            {extractingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            {extractingId === doc.id ? "Extracting..." : "Extract Now"}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
            {statusMessage && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in ${statusMessage.type === "error" ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-green-500/10 border border-green-500/30 text-green-400"}`}>
                    {statusMessage.text}
                </div>
            )}

            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-rose-500" /> Research Directory
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Upload research PDFs and manage the AI knowledgebase.</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasPendingToggles && (
                        <Button onClick={handleSaveActivations} disabled={isSavingActivations} variant="outline" className="gap-2 border-green-500/30 text-green-500 hover:bg-green-500/10">
                            {isSavingActivations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Activations ({Object.keys(pendingToggles).length})
                        </Button>
                    )}
                    <Button onClick={() => setForm({ title: "", author: "", year: "", url: "", content: "", is_active: true })} className="gap-2">
                        <Plus className="w-4 h-4" /> Add Source
                    </Button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-2 overflow-y-auto pr-2">
                    <button
                        onClick={() => setSortAsc(prev => !prev)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors self-end px-2 py-1 rounded hover:bg-muted"
                    >
                        {sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {sortAsc ? "Oldest first" : "Newest first"}
                    </button>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                    ) : docs.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            No sources added yet.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mt-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Active ({activeDocs.length})</span>
                                <div className="flex-1 border-t border-green-500/20" />
                            </div>
                            {activeDocs.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-3">No active sources.</p>
                            ) : (
                                <div className="flex flex-col gap-3 mb-4">{activeDocs.map(renderCard)}</div>
                            )}

                            <div className="flex items-center gap-2 mt-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inactive ({inactiveDocs.length})</span>
                                <div className="flex-1 border-t border-border" />
                            </div>
                            {inactiveDocs.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-3">All sources are active.</p>
                            ) : (
                                <div className="flex flex-col gap-3">{inactiveDocs.map(renderCard)}</div>
                            )}
                        </>
                    )}
                </div>

                <div className="w-2/3 flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {form ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">{form.id ? "Edit Source" : "New Source"}</h3>
                                <div className="flex items-center gap-2">
                                    {form.id && (
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(form.id!)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    {form.id && form.r2_key && !form.content && (
                                        <Button variant="outline" size="sm" onClick={() => handleExtractFromR2(form.id!)} disabled={extractingId === form.id} className="gap-1 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10">
                                            {extractingId === form.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            {extractingId === form.id ? "Extracting..." : "Extract Now"}
                                        </Button>
                                    )}
                                    {form.id && form.content && !form.abstract && (
                                        <Button variant="outline" size="sm" onClick={() => handleGenerateAbstract(form.id!)} disabled={generatingAbstractId === form.id} className="gap-1 text-violet-500 border-violet-500/30 hover:bg-violet-500/10">
                                            {generatingAbstractId === form.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            {generatingAbstractId === form.id ? "Generating..." : "Generate Abstract"}
                                        </Button>
                                    )}
                                    {form.id && (
                                        <Button variant="outline" size="sm" onClick={() => handleLocalToggle(form.id!, !form.is_active)}
                                            className={`gap-1 ${form.is_active ? "text-green-500 border-green-500/30 hover:bg-green-500/10" : "text-muted-foreground border-border hover:bg-muted"}`}
                                        >
                                            <Switch checked={form.is_active ?? false} className="scale-75" />
                                            {form.is_active ? "Active" : "Inactive"}
                                        </Button>
                                    )}
                                    <Button onClick={handleSave} disabled={isSaving || isConverting || !form.title || !form.content} size="sm">
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setForm(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* PDF Import */}
                                {!form.id && (
                                    <div
                                        className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg p-6 text-center cursor-pointer hover:bg-primary/10 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handlePdfUpload} />
                                        {isConverting ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
                                                <p className="text-sm font-medium text-primary">Extracting PDF layout & text...</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <UploadCloud className="w-6 h-6 text-primary mx-auto mb-3" />
                                                <p className="text-sm font-medium mb-1">Upload PDF</p>
                                                <p className="text-xs text-muted-foreground">AI will automatically extract and format the text into Markdown.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* R2 PDF Link */}
                                {form.r2_key && (
                                    <a
                                        href={`${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || ""}/${form.r2_key}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 w-fit"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        View PDF in R2
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}

                                {/* Abstract (read-only display) */}
                                {form.abstract && (
                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4">
                                        <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Generated Abstract</p>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{form.abstract}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs">Document Title *</Label>
                                        <Input value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Ergonomic Equity in Keyboards" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Author(s)</Label>
                                        <Input value={form.author || ""} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="e.g. Yoshimura & Chesky" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Year</Label>
                                        <Input value={form.year || ""} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2008" />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs">Source / Publisher</Label>
                                        <Input value={form.source || ""} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="e.g. Stanford Report" />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs">Source URL (For hyperlinking citations)</Label>
                                        <Input value={form.url || ""} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs">Description</Label>
                                        <Input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the research content" />
                                    </div>
                                </div>

                                <div className="space-y-1.5 flex flex-col h-[500px]">
                                    <Label className="text-xs">Content (Markdown) *</Label>
                                    <Textarea
                                        value={form.content || ""}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        className="h-full font-mono text-sm resize-none bg-muted/30 p-4"
                                        placeholder="Paste research text here, or use the PDF importer above..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a source from the left, or add a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
