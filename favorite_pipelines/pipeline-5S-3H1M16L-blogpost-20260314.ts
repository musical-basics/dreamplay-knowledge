#!/usr/bin/env tsx
/**
 * Pipeline: 5S-3H1M16L — Blog Post from Single PDF
 *
 * Architecture: 5 roles, 3 models
 *   1. Architect (Opus) — defines 4-section blog structure + extraction targets
 *   2. Workers (Haiku ×16) — parallel extraction swarm, section-tagged
 *   3. Outliner (Opus) — organizes into storytelling outline
 *   4. Writer (Opus) — writes conversational prose from outline
 *   5. Formatter (Sonnet) — converts prose into styled HTML
 *
 * Generated output: v3-pipeline-output-2026-03-14T14-14-58-206Z.html
 *
 * Usage:
 * npx tsx favorite_pipelines/pipeline-5S-3H1M16L-blogpost-20260314.ts --pdf <path/to/file.pdf>
 * npx tsx favorite_pipelines/pipeline-5S-3H1M16L-blogpost-20260314.ts <supabase_doc_id>
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
const HIGH_MODEL = "claude-opus-4-6"
const HIGH_COST_IN = 15.00
const HIGH_COST_OUT = 75.00

const MID_MODEL = "claude-sonnet-4-20250514"
const MID_COST_IN = 3.00
const MID_COST_OUT = 15.00

const LOW_MODEL = "claude-haiku-4-5-20251001"
const LOW_COST_IN = 1.00
const LOW_COST_OUT = 5.00

// Target Topic
const TARGET_TOPIC = "Synthesize a heavily sourced argument about the ergonomic challenges pianists face when playing standard-sized keyboards that don't match their hand size, and how narrower key alternatives can prevent injury and improve performance. Aim to convert readers to our newsletter."

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Helpers ──────────────────────────────────────────────
function calcCost(model: string, inputTokens: number, outputTokens: number) {
    let costIn = LOW_COST_IN, costOut = LOW_COST_OUT
    if (model === HIGH_MODEL) { costIn = HIGH_COST_IN; costOut = HIGH_COST_OUT }
    else if (model === MID_MODEL) { costIn = MID_COST_IN; costOut = MID_COST_OUT }
    return ((inputTokens / 1000000) * costIn) + ((outputTokens / 1000000) * costOut)
}

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
    let totalCost = 0
    let totalInput = 0
    let totalOutput = 0

    // ── Parse args ──
    const isPdf = process.argv[2] === "--pdf"
    if (isPdf) {
        const pdfPath = process.argv[3]
        if (!pdfPath) { console.error("❌ Usage: npx tsx pipeline.ts --pdf <path>"); process.exit(1) }
        const resolvedPath = path.resolve(pdfPath)
        console.log(`\nReading local PDF: ${resolvedPath}...`)
        const pdfBuffer = fs.readFileSync(resolvedPath)
        const pdfData = await pdfParse(pdfBuffer)
        docTitle = path.basename(pdfPath, ".pdf")
        docContent = pdfData.text
    } else {
        const docId = process.argv[2]
        if (!docId) { console.error("❌ Usage: npx tsx pipeline.ts <id> or --pdf <path>"); process.exit(1) }
        console.log(`\nFetching document ${docId} from Supabase...`)
        const { data: doc, error } = await supabase.from("research_knowledgebase").select("title, content").eq("id", docId).single()
        if (error || !doc?.content) throw new Error("Document not found.")
        docTitle = doc.title
        docContent = doc.content
    }

    console.log(`✅ Loaded: "${docTitle}" (${docContent.length} characters)`)
    console.log("═══════════════════════════════════════════════════")
    console.log("  5S-3H1M16L Pipeline (conversational)")
    console.log("═══════════════════════════════════════════════════\n")

    const startTime = Date.now()

    // ====================================================================
    // STEP 1: ARCHITECT (Opus) — Define blog structure + extraction targets
    // ====================================================================
    console.log("[1/5] Architect (Opus) defining blog structure...")
    const architectRes = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 600,
        system: `You are the editorial director of a popular lifestyle magazine. NOT an academic journal. You plan blog posts that feel like a great conversation with a smart friend. Warm, relatable, story-driven. You hate jargon and data dumps.`,
        messages: [{
            role: "user",
            content: `We're writing a blog post about: "${TARGET_TOPIC}"

Define EXACTLY 4 sections. No more. For each section, give:
1. A catchy, conversational section title (not academic)
2. The emotional job of this section (1 sentence)
3. MAX 2 specific things the research team should extract, pick only the most surprising or emotionally compelling data points

Format:

SECTION 1: [Title]
EMOTION: [What the reader should feel]
EXTRACT: [1-2 specific things to find]

Keep it tight. The blog should flow like: hook, "wait, really?", proof, hope + action.
Do NOT ask for exhaustive data. We want a focused, punchy article, not a literature review.`
        }]
    })

    const architectPlan = architectRes.content[0].type === "text" ? architectRes.content[0].text : ""
    totalInput += architectRes.usage.input_tokens
    totalOutput += architectRes.usage.output_tokens
    totalCost += calcCost(HIGH_MODEL, architectRes.usage.input_tokens, architectRes.usage.output_tokens)
    console.log(`   Cost: $${calcCost(HIGH_MODEL, architectRes.usage.input_tokens, architectRes.usage.output_tokens).toFixed(4)}`)
    console.log(`   Plan:\n${architectPlan.split("\n").map(l => "   │ " + l).join("\n")}\n`)

    // ====================================================================
    // STEP 2: WORKERS (Haiku swarm) — Extract data tagged by section
    // ====================================================================
    console.log("[2/5] Workers (Haiku) extracting data from chunks...")
    const chunks = chunkText(docContent)
    console.log(`   Split document into ${chunks.length} chunks.`)

    const workerPromises = chunks.map((chunk) => {
        return anthropic.messages.create({
            model: LOW_MODEL,
            max_tokens: 800,
            system: `You are a research assistant. Extract ONLY the specific items requested. Be very concise — just the stat/quote and its source. If nothing matches in your chunk, output only "N/A". Do NOT elaborate or add commentary.`,
            messages: [{
                role: "user",
                content: `WHAT TO FIND:\n${architectPlan}\n\n---\n\nTEXT:\n${chunk}\n\n---\n\nExtract matching data, tagged by section number. Be brief.`
            }]
        })
    })

    const workerResponses = await Promise.all(workerPromises)
    let aggregatedData = ""
    let haikuCost = 0

    workerResponses.forEach((res, i) => {
        const text = res.content[0].type === "text" ? res.content[0].text : ""
        if (text.trim() !== "N/A" && text.trim().length > 10) {
            aggregatedData += `\n--- Chunk ${i + 1} Extractions ---\n${text}`
        }
        totalInput += res.usage.input_tokens
        totalOutput += res.usage.output_tokens
        const chunkCost = calcCost(LOW_MODEL, res.usage.input_tokens, res.usage.output_tokens)
        haikuCost += chunkCost
        totalCost += chunkCost
    })
    console.log(`   Haiku swarm cost: $${haikuCost.toFixed(4)}\n`)

    // ====================================================================
    // STEP 3: OUTLINER (Opus) — Organize extractions into linear narrative
    // ====================================================================
    console.log("[3/5] Outliner (Opus) organizing into storytelling outline...")
    const outlinerRes = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 1500,
        system: `You are a magazine editor who turns raw research into compelling stories. Your outlines read like a story pitch, not a table of contents. You ruthlessly cut anything that doesn't serve the emotional arc.`,
        messages: [{
            role: "user",
            content: `EDITORIAL PLAN:\n${architectPlan}\n\n---\n\nEXTRACTED DATA:\n${aggregatedData}\n\n---\n\nCreate a TIGHT storytelling outline for the writer. Rules:
- Keep only the 1-2 BEST data points per section. Cut the rest.
- For each section, write a 1-sentence "lede" the writer can riff on
- Pick at most 2 direct quotes for the entire article (the most emotionally powerful ones)
- Suggest a natural transition sentence between each section
- The total outline should fit in ~400 words. If it's longer, you're including too much.`
        }]
    })

    const outline = outlinerRes.content[0].type === "text" ? outlinerRes.content[0].text : ""
    totalInput += outlinerRes.usage.input_tokens
    totalOutput += outlinerRes.usage.output_tokens
    totalCost += calcCost(HIGH_MODEL, outlinerRes.usage.input_tokens, outlinerRes.usage.output_tokens)
    console.log(`   Cost: $${calcCost(HIGH_MODEL, outlinerRes.usage.input_tokens, outlinerRes.usage.output_tokens).toFixed(4)}\n`)

    // ====================================================================
    // STEP 4: WRITER (Opus) — Write prose from outline (plain text only)
    // ====================================================================
    console.log("[4/5] Writer (Opus) writing article prose...")
    const writerRes = await anthropic.messages.create({
        model: HIGH_MODEL,
        max_tokens: 4000,
        system: `You are an expert copywriter who writes for a modern lifestyle/wellness audience.

WRITING STYLE:
- Write like a great magazine article, warm, conversational, pulls the reader in
- Use short paragraphs, punchy sentences, and natural transitions
- Sprinkle in data to support the story, don't lead with it
- When using statistics, frame them in human terms ("imagine a concert hall of 100 pianists, 87 of the women are playing an instrument that doesn't fit their hands")
- Max 2 direct blockquotes in the whole article
- End with a hopeful, forward-looking call to action
- ABSOLUTELY NO EM DASHES anywhere. Use commas, periods, colons, semicolons, or restructure the sentence instead.
- Do NOT generalize or reinterpret the research. Use the exact framing from the source data.

OUTPUT FORMAT:
- Output the article as clean markdown with section headers (## for sections)
- Include image placement markers like [IMAGE: description of what image should go here]
- Do NOT output any HTML. Just the prose in markdown.
- Focus entirely on writing quality. Formatting will be handled separately.`,
        messages: [{
            role: "user",
            content: `Write the blog article following this outline. Magazine-style, not academic. Keep it tight and compelling.\n\n${outline}`
        }]
    })

    const articleProse = writerRes.content[0].type === "text" ? writerRes.content[0].text : ""
    totalInput += writerRes.usage.input_tokens
    totalOutput += writerRes.usage.output_tokens
    totalCost += calcCost(HIGH_MODEL, writerRes.usage.input_tokens, writerRes.usage.output_tokens)
    const writerCost = calcCost(HIGH_MODEL, writerRes.usage.input_tokens, writerRes.usage.output_tokens)
    console.log(`   Cost: $${writerCost.toFixed(4)}`)

    // ====================================================================
    // STEP 5: FORMATTER (Sonnet) — Convert prose to styled HTML
    // ====================================================================
    console.log("[5/5] Formatter (Sonnet) styling into HTML...")
    const formatterRes = await anthropic.messages.create({
        model: MID_MODEL,
        max_tokens: 12000,
        system: `You are an expert web developer and designer. You take written article prose and convert it into beautifully styled, publication-ready HTML.

You must NOT alter, rewrite, or paraphrase the prose. Your job is strictly formatting and styling. Keep every word exactly as provided.

IMAGE RULES:
- Convert any [IMAGE: description] markers into <img> tags using Mustache variable syntax: e.g. <img src="{{hero_image}}" />, <img src="{{section_2_image}}" />, <img src="{{section_3_image}}" />
- Give each image a descriptive alt tag based on the marker description
- Style images responsively with rounded corners and appropriate spacing
- Include 1-3 images total

DESIGN BRIEF:
- Complete, standalone HTML with Tailwind CSS via CDN
- Serif headers (Playfair Display from Google Fonts) paired with clean sans-serif body text (Inter)
- Elegant section dividers (decorative, not just horizontal rules)
- Stat callout cards with dark backgrounds and light text for key numbers
- Blockquotes with colored left borders on subtle background panels
- Generous whitespace and vertical rhythm between sections
- A refined, warm color palette (ivory/cream backgrounds, deep navy or charcoal text, one accent color like burgundy or warm gold)
- Drop caps on the opening paragraph of each section
- Section labels (e.g. "PART ONE") in small caps above headings
- Responsive and mobile-friendly

Output ONLY the HTML, no markdown, no code fences.`,
        messages: [{
            role: "user",
            content: `Convert the following article into a beautifully styled HTML blog post. Do NOT change any of the words, just format and style it.\n\n${articleProse}`
        }]
    })

    const finalHtml = formatterRes.content[0].type === "text" ? formatterRes.content[0].text : ""
    totalInput += formatterRes.usage.input_tokens
    totalOutput += formatterRes.usage.output_tokens
    totalCost += calcCost(MID_MODEL, formatterRes.usage.input_tokens, formatterRes.usage.output_tokens)
    const formatterCost = calcCost(MID_MODEL, formatterRes.usage.input_tokens, formatterRes.usage.output_tokens)
    console.log(`   Cost: $${formatterCost.toFixed(4)}`)

    const totalTime = (Date.now() - startTime) / 1000

    // ====================================================================
    // RESULTS
    // ====================================================================
    console.log("\n═══════════════════════════════════════════════════")
    console.log("📊 5S-3H1M16L PIPELINE RESULTS")
    console.log("───────────────────────────────────────────────────")
    console.log(`   Architect:    $${calcCost(HIGH_MODEL, architectRes.usage.input_tokens, architectRes.usage.output_tokens).toFixed(4)}  [Opus]`)
    console.log(`   Haiku swarm:  $${haikuCost.toFixed(4)}  [Haiku x${chunks.length}]`)
    console.log(`   Outliner:     $${calcCost(HIGH_MODEL, outlinerRes.usage.input_tokens, outlinerRes.usage.output_tokens).toFixed(4)}  [Opus]`)
    console.log(`   Writer:       $${writerCost.toFixed(4)}  [Opus]`)
    console.log(`   Formatter:    $${formatterCost.toFixed(4)}  [Sonnet]`)
    console.log(`   ─────────────────────────`)
    console.log(`   TOTAL COST:   $${totalCost.toFixed(4)}`)
    console.log(`   TOTAL TIME:   ${totalTime.toFixed(1)}s`)
    console.log(`   TOTAL TOKENS: ${totalInput + totalOutput}`)
    console.log("═══════════════════════════════════════════════════\n")

    // ── Save output ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outDir = path.resolve(process.cwd(), "scripts")
    const htmlPath = path.resolve(outDir, `5S-3H1M16L-output-${timestamp}.html`)
    fs.writeFileSync(htmlPath, finalHtml)
    console.log(`📄 HTML: ${htmlPath}`)

    // Save the prose for reference
    const prosePath = path.resolve(outDir, `5S-3H1M16L-prose-${timestamp}.md`)
    fs.writeFileSync(prosePath, articleProse)
    console.log(`📄 Prose: ${prosePath}`)

    // Save the outline for reference
    const outlinePath = path.resolve(outDir, `5S-3H1M16L-outline-${timestamp}.md`)
    fs.writeFileSync(outlinePath, `# 5S-3H1M16L Pipeline Outline\n\n## Architect Plan\n${architectPlan}\n\n## Organized Outline\n${outline}\n`)
    console.log(`📄 Outline: ${outlinePath}`)
}

main().catch(console.error)
