"use server"

import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"
import type { ResearchDoc } from "@/lib/types"

export type { ResearchDoc }

export async function getKnowledgebase(): Promise<ResearchDoc[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_knowledgebase")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data as ResearchDoc[]
}

export async function getActiveKnowledgebase(): Promise<ResearchDoc[]> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("research_knowledgebase")
        .select("*")
        .eq("is_active", true)

    if (error) throw new Error(error.message)
    return data as ResearchDoc[]
}

export async function saveResearchDoc(doc: Partial<ResearchDoc>) {
    const supabase = createClient()

    if (doc.id) {
        const { error } = await supabase
            .from("research_knowledgebase")
            .update({ ...doc, updated_at: new Date().toISOString() })
            .eq("id", doc.id)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from("research_knowledgebase")
            .insert([doc])
        if (error) throw new Error(error.message)
    }

    return { success: true }
}

export async function toggleResearchStatus(id: string, is_active: boolean) {
    const supabase = createClient()
    const { error } = await supabase
        .from("research_knowledgebase")
        .update({ is_active })
        .eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}

export async function deleteResearchDoc(id: string) {
    const supabase = createClient()
    const { error } = await supabase
        .from("research_knowledgebase")
        .delete()
        .eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}

export async function extractPdf(formData: FormData): Promise<{ markdown?: string; error?: string }> {
    try {
        const file = formData.get("file") as File
        if (!file || file.type !== "application/pdf") {
            return { error: "Invalid file. Please upload a PDF." }
        }

        const arrayBuffer = await file.arrayBuffer()
        const base64Data = Buffer.from(arrayBuffer).toString("base64")

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: "application/pdf"
                            }
                        },
                        {
                            text: "Extract the complete text of this research paper and convert it into highly readable Markdown. Preserve all statistics, quotes, headings, and data accurately. Remove any page numbers, headers, footers, or irrelevant publishing stamps. Do not include introductory conversational text, just output the raw Markdown."
                        }
                    ]
                }
            ]
        })

        let markdown = response.text || ""

        if (markdown.startsWith("```markdown")) {
            markdown = markdown.replace(/^```markdown\n/, "").replace(/\n```$/, "")
        } else if (markdown.startsWith("```")) {
            markdown = markdown.replace(/^```\n/, "").replace(/\n```$/, "")
        }

        return { markdown: markdown.trim() }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("PDF Parsing Error:", error)
        return { error: message }
    }
}

export async function extractFromR2(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = createClient()

        const { data: doc, error: fetchError } = await supabase
            .from("research_knowledgebase")
            .select("id, title, author, year, r2_key")
            .eq("id", id)
            .single()

        if (fetchError || !doc) return { error: "Document not found" }
        if (!doc.r2_key) return { error: "No R2 key — this document has no uploaded PDF" }

        const publicDomain = process.env.R2_PUBLIC_DOMAIN!
        const pdfUrl = `${publicDomain}/${doc.r2_key}`
        const res = await fetch(pdfUrl)
        if (!res.ok) return { error: `Failed to download PDF: HTTP ${res.status}` }

        const pdfBuffer = Buffer.from(await res.arrayBuffer())
        const base64Data = pdfBuffer.toString("base64")

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: "application/pdf"
                            }
                        },
                        {
                            text: `Extract the complete text of this document and convert it into highly readable Markdown.

Rules:
1. Preserve all statistics, quotes, headings, and data accurately.
2. Remove any page numbers, headers, footers, or irrelevant publishing stamps.
3. Do not include introductory conversational text — just output the raw Markdown.

After the Markdown content, add a metadata block at the very end in this exact format:
---METADATA---
AUTHOR: [author name(s), comma-separated, or "unknown" if not found]
YEAR: [publication year as 4 digits, or "unknown" if not found]

The document title is: "${doc.title}"`
                        }
                    ]
                }
            ]
        })

        let text = response.text || ""

        let detectedAuthor: string | null = null
        let detectedYear: string | null = null

        const metadataMatch = text.match(/---METADATA---\s*\n\s*AUTHOR:\s*(.+)\s*\n\s*YEAR:\s*(.+)/i)
        if (metadataMatch) {
            const rawAuthor = metadataMatch[1].trim()
            const rawYear = metadataMatch[2].trim()
            if (rawAuthor && rawAuthor.toLowerCase() !== "unknown") detectedAuthor = rawAuthor
            if (rawYear && rawYear.toLowerCase() !== "unknown" && /^\d{4}$/.test(rawYear)) detectedYear = rawYear
            text = text.replace(/---METADATA---[\s\S]*$/, "").trim()
        }

        if (text.startsWith("```markdown")) {
            text = text.replace(/^```markdown\n/, "").replace(/\n```$/, "")
        } else if (text.startsWith("```")) {
            text = text.replace(/^```\n/, "").replace(/\n```$/, "")
        }

        const update: Record<string, unknown> = {
            content: text.trim(),
            updated_at: new Date().toISOString(),
        }
        if ((!doc.author || doc.author === "") && detectedAuthor) update.author = detectedAuthor
        if ((!doc.year || doc.year === "") && detectedYear) update.year = detectedYear

        const { error: updateError } = await supabase
            .from("research_knowledgebase")
            .update(update)
            .eq("id", id)

        if (updateError) return { error: `DB update failed: ${updateError.message}` }

        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("R2 Extraction Error:", error)
        return { error: message }
    }
}

/**
 * Generate an abstract for a research document using Gemini Flash.
 * Step 16 from the master plan.
 */
export async function generateAbstract(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = createClient()

        const { data: doc, error: fetchError } = await supabase
            .from("research_knowledgebase")
            .select("id, title, content")
            .eq("id", id)
            .single()

        if (fetchError || !doc) return { error: "Document not found" }
        if (!doc.content) return { error: "No content — extract the PDF first" }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

        // Use first 8000 chars to avoid hitting token limits on very long docs
        const contentPreview = doc.content.substring(0, 8000)

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `You are a research abstracting specialist. Generate a dense, data-heavy 150-word abstract for this research document. Focus on key findings, statistics, and actionable insights. Do NOT include any preamble or labels like "Abstract:" — just output the abstract text directly.

Title: ${doc.title}

Content:
${contentPreview}`
                        }
                    ]
                }
            ]
        })

        const abstract = (response.text || "").trim()

        const { error: updateError } = await supabase
            .from("research_knowledgebase")
            .update({ abstract, updated_at: new Date().toISOString() })
            .eq("id", id)

        if (updateError) return { error: `DB update failed: ${updateError.message}` }

        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Abstract Generation Error:", error)
        return { error: message }
    }
}
