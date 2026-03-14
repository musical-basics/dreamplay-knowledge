# Blog Generation Pipeline Architecture

## Current Pipeline (v3) — Single PDF, Full Article

**6 steps, 3 models, ~$0.56–0.62 per article**

```
┌─────────────────────────────────────────────────────────────────┐
│  USER PROMPT: "Write a blog post about X using this PDF"       │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. ABSTRACT (Sonnet) — if no cached abstract exists           │
│     Reads first 15K chars, generates 300-word structured       │
│     abstract, caches as .abstract.md for future reuse          │
│     Cost: ~$0.02 (first run only, free on repeat)              │
├─────────────────────────────────────────────────────────────────┤
│  2. RESEARCHER (Opus) — cross-refs abstract with prompt        │
│     Fit score, key data points, blind spots, cautions          │
│     Cost: ~$0.05                                               │
├─────────────────────────────────────────────────────────────────┤
│  3. ARCHITECT (Opus) — designs 4-section blog structure        │
│     Uses research brief to stay in-lane, adds caution notes    │
│     Cost: ~$0.06                                               │
├─────────────────────────────────────────────────────────────────┤
│  4. WORKERS (Haiku ×16) — parallel extraction swarm            │
│     Section-tagged data extraction from PDF chunks             │
│     Cost: ~$0.11                                               │
├─────────────────────────────────────────────────────────────────┤
│  5. OUTLINER (Opus) — storytelling outline from extractions    │
│     Deduplicates, picks best 1-2 data points per section       │
│     Cost: ~$0.15                                               │
├─────────────────────────────────────────────────────────────────┤
│  6. WRITER (Opus) — markdown prose with [Author, Year] cites   │
│     Data-driven, no em dashes, references section              │
│     Cost: ~$0.15                                               │
├─────────────────────────────────────────────────────────────────┤
│  7. FORMATTER (Sonnet) — styled HTML with Tailwind             │
│     Superscript footnotes, bibliography, strategic bolding,    │
│     mustache image placeholders, premium editorial design      │
│     Cost: ~$0.07                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scaled Pipeline — Proposed Architecture

### Problem Statement

The current pipeline assumes:
- **One PDF** as the source
- **Full article** is about that research
- **All 6 steps always fire**

Real-world use cases break these assumptions:
1. **Multi-PDF**: "Write an article using these 5 research papers"
2. **Mixed prompt**: "Write about X, but in paragraph 3, cite research from Y"
3. **Proportional effort**: If research is 2-3 sentences, don't spin up 16 workers

### Solution: Add a Dispatcher (Step 0)

A new **Dispatcher** step (Sonnet) analyzes the user's prompt BEFORE anything else and determines:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 0: DISPATCHER (Sonnet)                                   │
│                                                                 │
│  Inputs:                                                       │
│    - User's full prompt                                        │
│    - List of available PDFs (titles + cached abstracts)         │
│                                                                 │
│  Outputs:                                                       │
│    - research_scope: "full" | "section" | "paragraph" | "none" │
│    - relevant_pdfs: which PDFs to use (by ID/path)             │
│    - research_placement: where research goes in the article    │
│    - non_research_sections: parts that are pure editorial      │
│    - estimated_research_tokens: rough output size needed        │
└─────────────────────────────────────────────────────────────────┘
```

### Routing Logic Based on `research_scope`

| Scope | Pipeline | Cost Est. |
|-------|----------|-----------|
| `"full"` | Current 6-step pipeline (all PDFs) | $0.56–0.80 |
| `"section"` | Researcher → 4 workers (targeted chunks only) → Writer (section only) | $0.10–0.20 |
| `"paragraph"` | Researcher → 1-2 workers (abstract + best chunk) → Writer (2-3 sentences) | $0.03–0.05 |
| `"none"` | Skip research pipeline entirely, go straight to Writer | $0.02–0.05 |

### Multi-PDF Handling

When multiple PDFs are provided:

```
PDFs → [Abstract for each (cached)] → Dispatcher picks relevant ones
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
              Researcher(PDF1)      Researcher(PDF2)       Researcher(PDF3)
                    │                      │                      │
                    └──────────┬───────────┘                      │
                               ▼                            (not relevant,
                     Merged Research Brief                    dropped)
                               │
                               ▼
                     Architect (informed by all relevant sources)
                               │
                               ▼
                  Workers ×N (chunked across all relevant PDFs)
                               │
                               ▼
                        [rest of pipeline]
```

Key decisions:
- **Researcher runs per-PDF** (parallel, cheap) → each gets a FIT SCORE
- **Dispatcher threshold**: only PDFs with FIT SCORE ≥ 6 proceed to workers
- **Workers chunk ALL relevant PDFs** together, not separately
- **Writer gets a merged outline** that cites sources by PDF

### Mixed Prompt Architecture

For prompts like: *"Write an article about piano history. In section 3, cite the Boyle research on hand sizes."*

```
Dispatcher output:
  research_scope: "section"
  relevant_pdfs: ["BoyleBoyle.pdf"]
  research_placement: "section_3"
  non_research_sections: ["section_1", "section_2", "section_4"]

Pipeline:
  1. Non-research sections → Writer (Opus) with no research context
  2. Section 3 only → Miniature pipeline:
     - Researcher (on Boyle abstract)
     - 4 workers (targeted chunks with Architect guidance)
     - Writer (section 3 prose only, with citations)
  3. Combine all sections → Formatter
```

### Guardrails for Proportional Effort

| Signal | Gate | Action |
|--------|------|--------|
| `research_scope = "paragraph"` | Skip Architect + Outliner | Researcher → 1-2 Workers → Writer (direct) |
| `research_scope = "none"` | Skip entire research pipeline | Writer only |
| FIT SCORE < 4 on all PDFs | Warn user | "None of your sources strongly support this topic" |
| FIT SCORE 4-5 on a PDF | Conditional | Include with caveat to Writer |
| Prompt mentions specific section | Limit workers | Only chunk relevant portions |
| Token estimate < 200 | Cap workers at 2 | Don't spin up 16 for 2 sentences |

### Implementation Priority

1. **Dispatcher** — the routing brain. Everything else depends on this.
2. **Multi-PDF abstract caching** — scan all PDFs, generate/cache abstracts
3. **Scope-based routing** — different pipelines for full/section/paragraph
4. **Parallel researchers** — run researcher on all PDFs simultaneously
5. **Section-level composition** — stitch research + non-research sections
