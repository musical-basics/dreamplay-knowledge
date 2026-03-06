#!/usr/bin/env tsx
/**
 * V2 Search Test Script
 *
 * Sends a mock query to the LlamaIndex semantic search endpoint
 * and logs the results.
 *
 * Usage:
 *   npx tsx scripts/v2-test-search.ts
 *
 * Requires the dev server to be running on port 3004.
 */

import "dotenv/config"

const BASE_URL = "http://localhost:3004"
const ENDPOINT = `${BASE_URL}/api/v2/knowledge/llamaindex-search`

async function main() {
    console.log("═══════════════════════════════════════════════════")
    console.log("  V2 Search Endpoint Test")
    console.log("═══════════════════════════════════════════════════\n")

    const testQueries = [
        "How does piano practice improve cognitive function in children?",
        "What are the best methods for teaching music to beginners?",
        "Benefits of music education on academic performance",
    ]

    for (const query of testQueries) {
        console.log(`Query: "${query}"`)
        console.log("─".repeat(60))

        try {
            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-internal-api-secret": process.env.INTERNAL_API_SECRET || "",
                },
                body: JSON.stringify({ query, topK: 3 }),
            })

            if (!response.ok) {
                const errorBody = await response.text()
                console.log(`  ✗ HTTP ${response.status}: ${errorBody}\n`)
                continue
            }

            const data = await response.json()
            console.log(`  ✓ Found ${data.count} results:\n`)

            for (const result of data.results) {
                console.log(`  [Score: ${result.score.toFixed(4)}] ${result.metadata.title}`)
                console.log(`    Author: ${result.metadata.author} | Year: ${result.metadata.year}`)
                console.log(`    Chunk: "${result.text.substring(0, 120)}..."`)
                console.log("")
            }
        } catch (error) {
            console.log(`  ✗ Error: ${error}\n`)
        }

        console.log("")
    }

    console.log("═══════════════════════════════════════════════════")
    console.log("  Test complete!")
    console.log("═══════════════════════════════════════════════════\n")
}

main().catch(console.error)
