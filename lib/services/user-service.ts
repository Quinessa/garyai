import { getSupabaseClient, getSupabaseAdmin } from "@/lib/supabase-client"
import { logActivity } from "@/lib/services/activity-logger" // Import logActivity for debug panel
import type { WebAppUser as TelegramUserType } from "@twa-dev/types"

// Interface for user data stored in your database
export interface DbUser {
  id: number // Changed from string to number to match DB schema
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
  photo_url?: string
  created_at: string
  updated_at: string
  last_login: string // Changed from last_login_at
}

export async function createOrUpdateUser(telegramUser: TelegramUserType): Promise<DbUser | null> {
  // Use both console.log and logActivity for maximum visibility
  console.log("[user-service] createOrUpdateUser: Starting for Telegram user:", JSON.stringify(telegramUser, null, 2))
  logActivity("[user-service] createOrUpdateUser: Starting", { telegramUser })

  if (!telegramUser || !telegramUser.id) {
    const errorMsg = "[user-service] createOrUpdateUser: Invalid or missing Telegram user data or ID."
    console.error(errorMsg)
    logActivity(errorMsg, { telegramUser })
    return null
  }

  // Ensure properties exist on telegramUser before destructuring, providing defaults if necessary
  const {
    id: telegram_id,
    first_name = "",
    last_name = "",
    username = "",
    language_code = "",
    photo_url = "",
  } = telegramUser

  logActivity("[user-service] createOrUpdateUser: Extracted user data", {
    telegram_id,
    first_name,
    last_name,
    username,
    language_code,
    photo_url,
  })

  const supabase = getSupabaseClient()

  // Ensure telegram_id is available for logging even if destructuring happens later or fails
  const currentTelegramIdForLogging = telegramUser?.id || "UNKNOWN_ID"

  try {
    console.log(`[user-service] createOrUpdateUser: Checking for existing user with telegram_id: ${telegram_id}`)
    logActivity("[user-service] createOrUpdateUser: Checking for existing user", { telegram_id })

    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_id)
      .single()

    logActivity("[user-service] createOrUpdateUser: Select query completed", {
      hasExistingUser: !!existingUser,
      selectError: selectError
        ? {
            message: selectError.message,
            code: selectError.code,
            details: selectError.details,
          }
        : null,
    })

    if (selectError && selectError.code !== "PGRST116") {
      const errorMsg = "[user-service] createOrUpdateUser: Error fetching user"
      console.error(errorMsg, JSON.stringify(selectError, null, 2))
      logActivity(errorMsg, { selectError, telegram_id: currentTelegramIdForLogging })
      return null
    }

    if (existingUser) {
      console.log(
        "[user-service] createOrUpdateUser: Found existing user. Updating.",
        JSON.stringify(existingUser, null, 2),
      )
      logActivity("[user-service] createOrUpdateUser: Found existing user, updating", {
        existingUserId: existingUser.id,
      })

      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          last_login: new Date().toISOString(), // Changed from last_login_at
          first_name: first_name || existingUser.first_name,
          last_name: last_name || existingUser.last_name,
          username: username || existingUser.username,
          language_code: language_code || existingUser.language_code,
          photo_url: photo_url || existingUser.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("telegram_id", telegram_id)
        .select()
        .single()

      logActivity("[user-service] createOrUpdateUser: Update query completed", {
        hasUpdatedUser: !!updatedUser,
        updateError: updateError
          ? {
              message: updateError.message,
              code: updateError.code,
              details: updateError.details,
            }
          : null,
      })

      if (updateError) {
        const errorMsg = "[user-service] createOrUpdateUser: Error updating user"
        console.error(errorMsg, JSON.stringify(updateError, null, 2))
        logActivity(errorMsg, { updateError, telegram_id: currentTelegramIdForLogging })
        return null
      }

      console.log("[user-service] createOrUpdateUser: User updated successfully.", JSON.stringify(updatedUser, null, 2))
      logActivity("[user-service] createOrUpdateUser: User updated successfully", { updatedUserId: updatedUser?.id })
      return updatedUser as DbUser
    } else {
      console.log("[user-service] createOrUpdateUser: No existing user found. Creating new user.")
      logActivity("[user-service] createOrUpdateUser: No existing user found, creating new user", { telegram_id })

      const newUserPayload = {
        telegram_id,
        first_name,
        last_name,
        username,
        language_code,
        photo_url,
        last_login: new Date().toISOString(), // Changed from last_login_at
      }

      console.log("[user-service] createOrUpdateUser: New user payload:", JSON.stringify(newUserPayload, null, 2))
      logActivity("[user-service] createOrUpdateUser: New user payload prepared", { newUserPayload })

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert(newUserPayload)
        .select()
        .single()

      logActivity("[user-service] createOrUpdateUser: Insert query completed", {
        hasNewUser: !!newUser,
        insertError: insertError
          ? {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
            }
          : null,
      })

      if (insertError) {
        const errorMsg = "[user-service] createOrUpdateUser: Error inserting new user"
        console.error(errorMsg, JSON.stringify(insertError, null, 2))
        logActivity(errorMsg, { insertError, telegram_id, newUserPayload })
        return null
      }

      console.log("[user-service] createOrUpdateUser: New user created successfully.", JSON.stringify(newUser, null, 2))
      logActivity("[user-service] createOrUpdateUser: New user created successfully", { newUserId: newUser?.id })
      return newUser as DbUser
    }
  } catch (error) {
    const errorMsg = "[user-service] createOrUpdateUser: Unexpected error during processing"
    console.error(errorMsg, JSON.stringify(telegramUser, null, 2), error) // Log more context and the error itself

    // More detailed error logging
    const errorData: any = {
      telegramUserAttempted: telegramUser, // Log the input user data
      context: "Outer catch block in createOrUpdateUser",
    }
    if (error instanceof Error) {
      errorData.error_name = error.name
      errorData.error_message = error.message
      errorData.error_stack = error.stack?.substring(0, 500) // Keep stack trace manageable
      if (error.name === "TypeError" && error.message.toLowerCase().includes("failed to fetch")) {
        errorData.suspected_issue =
          "Network error or CORS. Check Supabase URL, network connectivity, and Supabase project CORS settings."
      }
    } else {
      errorData.error_details = String(error)
    }
    logActivity(errorMsg, errorData, "error") // Ensure level is error
    return null
  }
}

export async function getUserByTelegramId(telegramId: number): Promise<DbUser | null> {
  console.log(`[user-service] getUserByTelegramId: Fetching user with telegram_id: ${telegramId}`)
  logActivity("[user-service] getUserByTelegramId: Starting", { telegramId })

  if (!telegramId) {
    const errorMsg = "[user-service] getUserByTelegramId: telegramId is required."
    console.error(errorMsg)
    logActivity(errorMsg)
    return null
  }

  const supabase = getSupabaseClient()

  try {
    const { data, error } = await supabase.from("users").select("*").eq("telegram_id", telegramId).single()

    logActivity("[user-service] getUserByTelegramId: Query completed", {
      hasData: !!data,
      error: error
        ? {
            message: error.message,
            code: error.code,
            details: error.details,
          }
        : null,
    })

    if (error && error.code !== "PGRST116") {
      const errorMsg = `[user-service] getUserByTelegramId: Error fetching user ${telegramId}`
      console.error(errorMsg, JSON.stringify(error, null, 2))
      logActivity(errorMsg, { error, telegramId })
      return null
    }

    if (!data) {
      console.log(`[user-service] getUserByTelegramId: No user found with telegram_id: ${telegramId}`)
      logActivity("[user-service] getUserByTelegramId: No user found", { telegramId })
      return null
    }

    console.log(
      `[user-service] getUserByTelegramId: User ${telegramId} fetched successfully.`,
      JSON.stringify(data, null, 2),
    )
    logActivity("[user-service] getUserByTelegramId: User fetched successfully", { userId: data.id, telegramId })
    return data as DbUser
  } catch (err) {
    const errorMsg = `[user-service] getUserByTelegramId: Unexpected error fetching user ${telegramId}`
    console.error(errorMsg, JSON.stringify(err, null, 2))
    logActivity(errorMsg, {
      error:
        err instanceof Error
          ? {
              message: err.message,
              stack: err.stack,
            }
          : err,
      telegramId,
    })
    return null
  }
}

export async function getAllUsers(): Promise<DbUser[]> {
  const supabase = getSupabaseAdmin()

  try {
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("[user-service] getAllUsers: Error getting all users:", error)
      logActivity("[user-service] getAllUsers: Error", { error })
      throw error
    }
    return (data || []) as DbUser[]
  } catch (error) {
    console.error("[user-service] getAllUsers: Unexpected error:", error)
    logActivity("[user-service] getAllUsers: Unexpected error", { error })
    return []
  }
}
