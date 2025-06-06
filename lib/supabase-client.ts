import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let clientInstance: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (clientInstance) {
    return clientInstance
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key is missing. Check environment variables.")
    // Log this error to your activity logger as well if available globally
    // For now, throwing an error might be too disruptive if called early.
    // Consider a more graceful way to handle this, perhaps returning a dummy client
    // or a specific state that the UI can react to.
    // For debugging, we'll proceed to create, but it will likely fail.
    throw new Error(
      "Supabase client-side URL or Anon Key is missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    )
  }

  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey)
    // console.log("[SupabaseClient] Client initialized successfully with URL:", supabaseUrl.substring(0,20) + "...");
  } catch (error) {
    console.error("[SupabaseClient] Error initializing Supabase client:", error)
    throw error // Re-throw after logging if initialization itself fails
  }
  return clientInstance
}

export const getSupabaseAdmin = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL // Admin client also needs the URL

  if (!adminSupabaseUrl || !supabaseServiceKey) {
    console.error("Supabase Admin URL or Service Key is missing. Check environment variables.")
    throw new Error(
      "Supabase admin URL or Service Key is missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    )
  }
  // Note: Supabase admin client should typically be a singleton too if used frequently server-side,
  // but for now, we create it on demand.
  return createClient(adminSupabaseUrl, supabaseServiceKey)
}

// Export this new function
export const getSupabaseClientInitializationInfo = () => {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    clientInitialized: !!clientInstance, // Check if the singleton instance has been created
  }
}
