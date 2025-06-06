/**
 * Detects if the app is running inside a Telegram WebApp environment
 */
export const detectTelegramWebApp = () => {
  if (typeof window === "undefined") return false

  // Log detection attempt
  console.log("Detecting Telegram WebApp...")

  // Check if Telegram WebApp exists
  const hasTelegram = !!window.Telegram
  const hasWebApp = !!(window.Telegram && window.Telegram.WebApp)

  console.log("Telegram object exists:", hasTelegram)
  console.log("WebApp object exists:", hasWebApp)

  // Force detection if requested (for development/testing)
  const forceDetection = localStorage.getItem("forceTelegramDetection") === "true"
  if (forceDetection) {
    console.log("Forcing Telegram WebApp detection")
    return true
  }

  // Additional checks to verify we're in a real Telegram environment
  let isInIframe = false
  try {
    isInIframe = window !== window.parent
  } catch (e) {
    // If we can't access parent, we're likely in an iframe
    isInIframe = true
  }

  // Check URL parameters for Telegram's tgWebAppData
  const hasWebAppData = window.location.search.includes("tgWebAppData") || window.location.hash.includes("tgWebAppData")

  // Check if we're in Telegram's user agent
  const userAgent = navigator.userAgent.toLowerCase()
  const isTelegramUserAgent =
    userAgent.includes("telegram") || userAgent.includes("tgweb") || userAgent.includes("webview")

  // Combined check - we need WebApp object and at least one additional indicator
  const isTelegramEnvironment = hasWebApp && (isInIframe || hasWebAppData || isTelegramUserAgent)

  console.log("Additional detection checks:", {
    isInIframe,
    hasWebAppData,
    isTelegramUserAgent,
    isTelegramEnvironment,
  })

  if (hasWebApp) {
    // Log WebApp properties
    console.log("WebApp properties:", {
      initDataUnsafe: window.Telegram.WebApp.initDataUnsafe,
      initData: window.Telegram.WebApp.initData,
      version: window.Telegram.WebApp.version,
      platform: window.Telegram.WebApp.platform,
      colorScheme: window.Telegram.WebApp.colorScheme,
    })

    // Call ready method
    try {
      window.Telegram.WebApp.ready()
      console.log("WebApp.ready() called successfully")
    } catch (e) {
      console.error("Error calling WebApp.ready():", e)
    }
  }

  return isTelegramEnvironment || hasWebApp
}
