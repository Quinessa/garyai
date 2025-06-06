import crypto from "crypto"

/**
 * Server-side utilities for Telegram Mini App authentication
 * This file should only be imported in server components or API routes
 */

// Validate Telegram WebApp data on the server
export function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  if (!initData) {
    return false
  }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")

    if (!hash) {
      console.error("No hash in initData")
      return false
    }

    params.delete("hash")

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest()

    const signature = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

    return signature === hash
  } catch (error) {
    console.error("Error validating Telegram data:", error)
    return false
  }
}

// Extract user data from initData
export function extractUserFromInitData(initDataString: string): any | null {
  if (!initDataString) return null

  try {
    const params = new URLSearchParams(initDataString)
    const userString = params.get("user")

    if (!userString) {
      console.warn("No user data in initData")
      return null
    }

    try {
      return JSON.parse(userString)
    } catch (e) {
      console.error("Failed to parse user data:", e)
      return null
    }
  } catch (error) {
    console.error("Failed to extract user data:", error)
    return null
  }
}
