// ─── AI Personas ────────────────────────────────────────
export interface AiPersona {
    id: string
    name: string
    prompt_snippet: string
    created_at: string
}

// ─── AI Missions ────────────────────────────────────────
export interface AiMission {
    id: string
    name: string
    objective_prompt: string
    created_at: string
}

// ─── AI Platform Rules ──────────────────────────────────
export type Platform = "email" | "blog" | "global"

export interface AiPlatformRule {
    id: string
    platform: Platform
    rule_text: string
    created_at: string
}

// ─── AI Knowledge Chunks ────────────────────────────────
export type ChunkCategory = "campaign_push" | "company_info" | "ceo_story"

export interface AiKnowledgeChunk {
    id: string
    category: ChunkCategory
    title: string
    content: string
    is_active: boolean
    created_at: string
}

// ─── Research Knowledgebase ─────────────────────────────
export interface ResearchDoc {
    id: string
    title: string
    author: string | null
    year: string | null
    url: string | null
    content: string
    is_active: boolean
    created_at: string
    updated_at?: string
    // Bulk upload fields
    source: string | null
    description: string | null
    r2_key: string | null
    batch: string | null
    file_size_kb: number | null
    download_status: string | null
    // New Agentic RAG fields
    abstract: string | null
    citation_count: number
}

// ─── Research Tags ──────────────────────────────────────
export interface ResearchTag {
    id: string
    name: string
    description: string | null
    created_at: string
}

export interface ResearchTagLink {
    research_id: string
    tag_id: string
}

// ─── Citation Logs ──────────────────────────────────────
export interface CitationLog {
    id: string
    research_id: string
    source_repo: "blog" | "email"
    created_at: string
}
