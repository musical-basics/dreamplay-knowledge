import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

/**
 * Server-side Supabase client using the service role key.
 * This bypasses RLS and is suitable for server actions and API routes.
 */
export function createClient() {
    return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}
