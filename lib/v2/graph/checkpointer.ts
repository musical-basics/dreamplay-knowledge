import pg from "pg"
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"

const { Pool } = pg

/**
 * V2 LangGraph Checkpointer — PostgresSaver
 * 
 * Connects to v2_ai_schema in the shared Supabase Postgres database.
 * Tables are pre-provisioned (migration 20260306_03), so setup() is NOT called.
 */

let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
    if (!_pool) {
        const connString = process.env.SUPABASE_DB_URL
        if (!connString) {
            throw new Error("SUPABASE_DB_URL is not set. Required for LangGraph checkpointer.")
        }
        _pool = new Pool({ connectionString: connString })
    }
    return _pool
}

/**
 * Get a PostgresSaver instance configured for v2_ai_schema.
 * IMPORTANT: Do NOT call .setup() — tables are pre-provisioned.
 */
export function getCheckpointer(): PostgresSaver {
    const pool = getPool()
    return new PostgresSaver(pool, undefined, { schema: "v2_ai_schema" })
}

/**
 * Get the raw pg.Pool for direct database queries.
 * Used by LlamaIndex PGVectorStore and custom queries.
 */
export function getDbPool(): pg.Pool {
    return getPool()
}
