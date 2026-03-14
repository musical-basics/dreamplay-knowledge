#!/usr/bin/env tsx
/**
 * A/B Test: Zero-Shot Opus vs. High-Low-High (Map-Reduce)
 *
 * Usage:
 * npx tsx scripts/ab-test-orchestrator.ts <research_doc_id>       # from Supabase
 * npx tsx scripts/ab-test-orchestrator.ts --pdf <path/to/file.pdf> # from local file
 */

import dotenv from "dotenv"
import path from "path"
import fs from "fs"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse")

// ── Models & Pricing (Per 1M tokens) ──────────────────────
// HIGH model: Claude Opus 4 (latest, best quality)
const HIGH_MODEL = "claude-opus-4-6"
const HIGH_COST_IN = 15.00
const HIGH_COST_OUT = 75.00

// LOW model: Claude Haiku 4.5 (cheapest available)
const LOW_MODEL = "claude-haiku-4-5-20251001"
const LOW_COST_IN = 1.00
const LOW_COST_OUT = 5.00

// Target Topic for the generation
const TARGET_TOPIC = "Synthesize a heavily sourced argument about the ergonomic challenges pianists face when playing standard-sized keyboards that don't match their hand size, and how narrower key alternatives can prevent injury and improve performance. Aim to convert readers to our newsletter."

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Helper: Calculate Cost ───────────────────────────────
function calcCost(model: string, inputTokens: number, outputTokens: number) {
    const costIn = model === HIGH_MODEL ? HIGH_COST_IN : LOW_COST_IN
    const costOut = model === HIGH_MODEL ? HIGH_COST_OUT : LOW_COST_OUT
    return ((inputTokens / 1000000) * costIn) + ((outputTokens / 1000000) * costOut)
}

// ── Helper: Chunk Text ───────────────────────────────────
function chunkText(text: string, maxChars = 12000): string[] {
    const chunks: string[] = []
    let currentIdx = 0
    while (currentIdx < text.length) {
        chunks.push(text.slice(currentIdx, currentIdx + maxChars))
        currentIdx += maxChars
    }
    return chunks
}

async function main() {
    let docTitle: string
    let docContent: string

    // ── Parse args: either --pdf <path> or <supabase_id> ──
    const isPdf = process.argv[2] === "--pdf"

    if (isPdf) {
        const pdfPath = process.argv[3]
        if (!pdfPath) {
            console.error("❌ Please provide a PDF file path.")
            console.log("Usage: npx tsx scripts/ab-test-orchestrator.ts --pdf <path/to/file.pdf>")
            process.exit(1)
        }
        const resolvedPath = path.resolve(pdfPath)
        console.log(`\nReading local PDF: ${resolvedPath}...`)
        const pdfBuffer = fs.readFileSync(resolvedPath)
        const pdfData = await pdfParse(pdfBuffer)
        docTitle = path.basename(pdfPath, ".pdf")
        docContent = pdfData.text
    } else {
        const docId = process.argv[2]
        if (!docId) {
            console.error("❌ Please provide a research_knowledgebase ID or --pdf <path>.")
            console.log("Usage: npx tsx scripts/ab-test-orchestrator.ts <id>")
            console.log("       npx tsx scripts/ab-test-orchestrator.ts --pdf <path/to/file.pdf>")
            process.exit(1)
        }
        console.log(`\nFetching document ${docId} from Supabase...`)
        const { data: doc, error } = await supabase
            .from("research_knowledgebase")
            .select("title, content")
            .eq("id", docId)
            .single()
        if (error || !doc?.content) throw new Error("Document not found or has no content.")
        docTitle = doc.title
        docContent = doc.content
    }

    console.log(`✅ Loaded: "${docTitle}" (${docContent.length} characters)`)
    console.log("═══════════════════════════════════════════════════\n")

    // ====================================================================
    // TEST A: ZERO-SHOT OPUS
    // ====================================================================
    console.log("🚀 STARTING TEST A: Zero-Shot Opus...")

    const startTimeA = Date.now()
    const responseA = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 8000,
        system: "You are an expert copywriter and web developer. You output complete, standalone HTML files with beautiful blog post styling using Tailwind CSS (via CDN). The HTML should be elegant, modern, and publication-ready with proper typography, spacing, and responsive design. Include the Tailwind CDN link in the head. Use a clean color palette. Output ONLY the HTML — no markdown, no code fences.",
        messages: [{
            role: "user",
            content: `Write a beautifully styled HTML blog post about: ${TARGET_TOPIC}\n\nUse the following research document as your source material. Cite specific data points, statistics, and findings from it.\n\nDocument Title: ${docTitle}\n\nDocument Text:\n${docContent}`
        }]
    })

    const timeA = (Date.now() - startTimeA) / 1000
    const usageA = responseA.usage
    const costA = calcCost(HIGH_MODEL, usageA.input_tokens, usageA.output_tokens)

    console.log(`⏱️  Time: ${timeA}s`)
    console.log(`   Input tokens:  ${usageA.input_tokens}`)
    console.log(`   Output tokens: ${usageA.output_tokens}`)
    console.log(`💰 Cost: $${costA.toFixed(4)}`)
    console.log("═══════════════════════════════════════════════════\n")


    // ====================================================================
    // TEST B: HIGH -> LOW -> HIGH (Map-Reduce)
    // ====================================================================
    console.log("🚀 STARTING TEST B: High-Low-High Architecture...")
    let totalCostB = 0
    let totalInputB = 0
    let totalOutputB = 0
    const startTimeB = Date.now()

    // 1. HIGH (Architect - Opus)
    console.log("  [1/3] Architect (Opus) planning extraction...")
    const architectRes = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 500,
        system: "You are a research director setting extraction instructions for junior analysts.",
        messages: [{
            role: "user",
            content: `We need to write a blog post about: "${TARGET_TOPIC}". Based on this goal, write a strict bulleted list of 4 specific data points, statistics, or thematic quotes the junior analysts should extract from the raw text. Do not write the blog post. Just output the extraction instructions.`
        }]
    })

    const architectInstructions = architectRes.content[0].type === "text" ? architectRes.content[0].text : ""
    totalInputB += architectRes.usage.input_tokens
    totalOutputB += architectRes.usage.output_tokens
    totalCostB += calcCost(HIGH_MODEL, architectRes.usage.input_tokens, architectRes.usage.output_tokens)
    console.log(`        Architect cost: $${calcCost(HIGH_MODEL, architectRes.usage.input_tokens, architectRes.usage.output_tokens).toFixed(4)}`)

    // 2. LOW (Workers - Haiku Swarm)
    console.log("  [2/3] Workers (Haiku) processing chunks in parallel...")
    const chunks = chunkText(docContent)
    console.log(`        Split document into ${chunks.length} chunks.`)

    const workerPromises = chunks.map((chunk, i) => {
        return anthropic.messages.create({
            model: LOW_MODEL,
            max_tokens: 1000,
            system: "You are a data extraction worker. Follow the director's instructions exactly. If the data is not in your chunk, output 'N/A'. Keep it concise.",
            messages: [{
                role: "user",
                content: `DIRECTOR INSTRUCTIONS:\n${architectInstructions}\n\nYOUR TEXT CHUNK:\n${chunk}`
            }]
        })
    })

    const workerResponses = await Promise.all(workerPromises)
    let aggregatedData = ""
    let haikuCost = 0

    workerResponses.forEach((res, i) => {
        aggregatedData += `\n--- Chunk ${i + 1} Data ---\n` + (res.content[0].type === "text" ? res.content[0].text : "")
        totalInputB += res.usage.input_tokens
        totalOutputB += res.usage.output_tokens
        const chunkCost = calcCost(LOW_MODEL, res.usage.input_tokens, res.usage.output_tokens)
        haikuCost += chunkCost
        totalCostB += chunkCost
    })
    console.log(`        Haiku swarm cost: $${haikuCost.toFixed(4)} (${chunks.length} chunks)`)

    // 3. HIGH (Synthesizer - Opus)
    console.log("  [3/3] Synthesizer (Opus) writing final output...")
    const synthesizerRes = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 8000,
        system: "You are an expert copywriter and web developer. You output complete, standalone HTML files with beautiful blog post styling using Tailwind CSS (via CDN). The HTML should be elegant, modern, and publication-ready with proper typography, spacing, and responsive design. Include the Tailwind CDN link in the head. Use a clean color palette. Output ONLY the HTML — no markdown, no code fences.",
        messages: [{
            role: "user",
            content: `Write a beautifully styled HTML blog post about: ${TARGET_TOPIC}\n\nHere is the compressed, extracted research data. Cite specific data points and statistics:\n\n${aggregatedData}`
        }]
    })

    totalInputB += synthesizerRes.usage.input_tokens
    totalOutputB += synthesizerRes.usage.output_tokens
    totalCostB += calcCost(HIGH_MODEL, synthesizerRes.usage.input_tokens, synthesizerRes.usage.output_tokens)
    console.log(`        Synthesizer cost: $${calcCost(HIGH_MODEL, synthesizerRes.usage.input_tokens, synthesizerRes.usage.output_tokens).toFixed(4)}`)

    const timeB = (Date.now() - startTimeB) / 1000

    console.log(`\n⏱️  Time: ${timeB}s`)
    console.log(`   Total input tokens:  ${totalInputB}`)
    console.log(`   Total output tokens: ${totalOutputB}`)
    console.log(`💰 Total Cost: $${totalCostB.toFixed(4)}`)
    console.log("═══════════════════════════════════════════════════\n")

    // ====================================================================
    // RESULTS SUMMARY
    // ====================================================================
    const outputA = responseA.content[0].type === "text" ? responseA.content[0].text : ""
    const outputB = synthesizerRes.content[0].type === "text" ? synthesizerRes.content[0].text : ""

    console.log("📊 THE VERDICT")
    console.log("---------------------------------------------------")
    console.log(`Test A (Zero-Shot Opus) : $${costA.toFixed(4)} | ${timeA.toFixed(1)}s | ${usageA.input_tokens + usageA.output_tokens} total tokens`)
    console.log(`Test B (High-Low-High)  : $${totalCostB.toFixed(4)} | ${timeB.toFixed(1)}s | ${totalInputB + totalOutputB} total tokens`)

    const diff = ((costA - totalCostB) / costA) * 100
    if (totalCostB < costA) {
        console.log(`\n🏆 Architecture B saved ${diff.toFixed(1)}% on costs!`)
    } else {
        console.log(`\n⚠️  Architecture B was more expensive by ${Math.abs(diff).toFixed(1)}%.`)
    }

    // ── Write outputs to files ──────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outDir = path.resolve(process.cwd(), "scripts")

    // Save HTML files
    const htmlA = path.resolve(outDir, `ab-test-A-zero-shot-${timestamp}.html`)
    const htmlB = path.resolve(outDir, `ab-test-B-high-low-high-${timestamp}.html`)
    fs.writeFileSync(htmlA, outputA)
    fs.writeFileSync(htmlB, outputB)
    console.log(`\n📄 Test A HTML: ${htmlA}`)
    console.log(`📄 Test B HTML: ${htmlB}`)

    // Save summary
    const summaryPath = path.resolve(outDir, `ab-test-summary-${timestamp}.md`)
    const summary = `# A/B Test Results\n**Date:** ${new Date().toISOString()}\n**Document:** ${docTitle} (${docContent.length} characters)\n**Models:** HIGH=${HIGH_MODEL}, LOW=${LOW_MODEL}\n\n## Summary\n| Metric | Test A (Zero-Shot Opus) | Test B (High→Low→High) |\n|--------|------------------------|------------------------|\n| Cost | $${costA.toFixed(4)} | $${totalCostB.toFixed(4)} |\n| Time | ${timeA.toFixed(1)}s | ${timeB.toFixed(1)}s |\n| Input Tokens | ${usageA.input_tokens} | ${totalInputB} |\n| Output Tokens | ${usageA.output_tokens} | ${totalOutputB} |\n| Total Tokens | ${usageA.input_tokens + usageA.output_tokens} | ${totalInputB + totalOutputB} |\n\n**Winner:** ${totalCostB < costA ? `Architecture B saved ${diff.toFixed(1)}% on costs` : `Architecture A was ${Math.abs(diff).toFixed(1)}% cheaper`}\n\n## Output Files\n- Test A: ${path.basename(htmlA)}\n- Test B: ${path.basename(htmlB)}\n`
    fs.writeFileSync(summaryPath, summary)
    console.log(`📄 Summary: ${summaryPath}`)
}

main().catch(console.error)
