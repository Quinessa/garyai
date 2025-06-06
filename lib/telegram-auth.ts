/**
 * Utilities for Telegram Mini App authentication
 * Client-side only - no Node.js modules
 */

// Parse the initData string from Telegram WebApp
export function parseInitData(initDataString: string) {
  if (!initDataString) return null

  try {
    const params = new URLSearchParams(initDataString)
    const result: Record<string, any> = {}

    // Extract all parameters
    for (const [key, value] of params.entries()) {
      if (key === "user") {
        try {
          result[key] = JSON.parse(value)
        } catch (e) {
          result[key] = value
        }
      } else {
        result[key] = value
      }
    }

    return result
  } catch (error) {
    console.error("Failed to parse initData:", error)
    return null
  }
}

// Verify the authenticity of initData (client-side)
export async function verifyTelegramWebAppData(initDataString: string) {
  if (!initDataString) return false

  try {
    // Make a request to the server to verify the hash
    const response = await fetch("/api/auth/telegram/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initData: initDataString }),
    })

    const result = await response.json()
    return result.isValid
  } catch (error) {
    console.error("Failed to verify Telegram data:", error)
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

// Get user data from initDataUnsafe or initData
export function getTelegramUser() {
  if (typeof window === "undefined") return null

  // Try to get from WebApp.initDataUnsafe first (most reliable)
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user
  }

  // Fall back to parsing initData
  if (window.Telegram?.WebApp?.initData) {
    const parsedData = parseInitData(window.Telegram.WebApp.initData)
    return parsedData?.user || null
  }

  return null
}

// Check if we're in a Telegram WebApp environment
export function isTelegramWebApp() {
  if (typeof window === "undefined") return false

  // Check if force detection is enabled
  if (localStorage.getItem("forceTelegramDetection") === "true") {
    console.log("Forcing Telegram detection")
    return true
  }

  // Check for Telegram WebApp object
  const hasTelegramWebApp = !!window.Telegram?.WebApp

  // Check URL parameters (some Telegram clients pass tgWebAppData in URL)
  const urlParams = new URLSearchParams(window.location.search)
  const hasTgWebAppParam = urlParams.has("tgWebAppData") || urlParams.has("tgWebAppStartParam")

  // Check for Telegram in user agent (less reliable)
  const userAgent = navigator.userAgent || ""
  const hasTelegramInUA = userAgent.includes("Telegram") || userAgent.includes("TelegramBot")

  // Check for specific Telegram WebApp methods
  const hasWebAppMethods = !!(window.Telegram?.WebApp?.ready && window.Telegram?.WebApp?.expand)

  // Log detection results
  console.log("Telegram detection:", {
    hasTelegramWebApp,
    hasTgWebAppParam,
    hasTelegramInUA,
    hasWebAppMethods,
  })

  // Return true if any detection method succeeds
  return hasTelegramWebApp || hasTgWebAppParam || (hasTelegramInUA && hasWebAppMethods)
}

// Initialize the Telegram WebApp
export function initializeTelegramWebApp() {
  if (typeof window === "undefined") return null

  // Try to get the WebApp object
  const webApp = window.Telegram?.WebApp

  if (webApp) {
    try {
      // Call ready to tell Telegram the Mini App is ready
      webApp.ready()

      // Expand to full height
      webApp.expand()

      // Return the WebApp object
      return webApp
    } catch (error) {
      console.error("Error initializing Telegram WebApp:", error)
    }
  } else {
    // If WebApp object isn't available but we're in Telegram, try to load it
    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-web-app.js"
    script.async = true
    document.head.appendChild(script)

    console.log("Added Telegram WebApp script dynamically")
  }

  return null
}

// Client-side stub for validateTelegramWebAppData
// This redirects to the server-side implementation via API
export async function validateTelegramWebAppData(initData: string, botToken: string): Promise<boolean> {
  console.warn("Client-side validateTelegramWebAppData called - this should use the API instead")

  try {
    const response = await fetch("/api/auth/telegram/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initData }),
    })

    const result = await response.json()
    return result.isValid
  } catch (error) {
    console.error("Error validating Telegram data:", error)
    return false
  }
}
