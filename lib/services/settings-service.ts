import { getSupabaseClient } from "../supabase-client"

// Types
export interface UserSettings {
  id: number
  user_id: number
  auto_refresh: boolean
  theme: string
  notification_enabled: boolean
  created_at: string
  updated_at: string
}

export interface WhitelistedAddress {
  id: number
  user_id: number
  address: string
  name?: string
  created_at: string
}

// Get user settings
export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  try {
    const supabase = getSupabaseClient()

    // Check if settings exist
    const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).single()

    if (error) {
      // If settings don't exist, create default settings
      if (error.code === "PGRST116") {
        return createDefaultSettings(userId)
      }
      throw error
    }

    return data
  } catch (error) {
    console.error("Error getting user settings:", error)
    return null
  }
}

// Create default settings for a user
export async function createDefaultSettings(userId: number): Promise<UserSettings | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("settings")
      .insert({
        user_id: userId,
        auto_refresh: false,
        theme: "dark",
        notification_enabled: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error creating default settings:", error)
    return null
  }
}

// Update user settings
export async function updateUserSettings(
  userId: number,
  settings: Partial<Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at">>,
): Promise<UserSettings | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("settings")
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error updating user settings:", error)
    return null
  }
}

// Add a whitelisted address
export async function addWhitelistedAddress(
  userId: number,
  address: string,
  name?: string,
): Promise<WhitelistedAddress | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("whitelisted_addresses")
      .insert({
        user_id: userId,
        address,
        name,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error adding whitelisted address:", error)
    return null
  }
}

// Get whitelisted addresses for a user
export async function getWhitelistedAddresses(userId: number): Promise<WhitelistedAddress[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("whitelisted_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting whitelisted addresses:", error)
    return []
  }
}

// Remove a whitelisted address
export async function removeWhitelistedAddress(id: number, userId: number): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase.from("whitelisted_addresses").delete().eq("id", id).eq("user_id", userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Error removing whitelisted address:", error)
    return false
  }
}
