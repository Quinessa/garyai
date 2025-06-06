"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getTelegramUser, initializeTelegramWebApp, verifyTelegramWebAppData } from "@/lib/telegram-auth"
import { createOrUpdateUser, type DbUser as DBTelegramUser } from "@/lib/services/user-service" // Corrected type import
import { detectTelegramWebApp } from "@/lib/telegram-detector"

// Define the WebApp type based on Telegram's Mini App API
declare global {
  interface Window {
    Telegram: {
      WebApp: any
    }
  }
}

type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

type TelegramContextType = {
  user: TelegramUser | null
  dbUser: DBTelegramUser | null
  dbUserError: string | null // New state for DB user fetching errors
  isReady: boolean
  isAuthenticated: boolean
  webApp: any
  hapticFeedback: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
  isTelegramEnvironment: boolean
  debugInfo: string
}

const TelegramContext = createContext<TelegramContextType>({
  user: null,
  dbUser: null,
  dbUserError: null, // Default value
  isReady: false,
  isAuthenticated: false,
  webApp: null,
  hapticFeedback: () => {},
  isTelegramEnvironment: false,
  debugInfo: "",
})

export const useTelegram = () => useContext(TelegramContext)

export const TelegramProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [dbUser, setDbUser] = useState<DBTelegramUser | null>(null)
  const [dbUserError, setDbUserError] = useState<string | null>(null) // New state
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [webApp, setWebApp] = useState<any>(null)
  const [isTelegramEnvironment, setIsTelegramEnvironment] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const router = useRouter()

  const addDebugLog = (message: string, data?: any, level: "info" | "error" | "warn" = "info") => {
    const timestamp = new Date().toISOString().substring(11, 23) // Increased precision
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ` - Data: ${JSON.stringify(data)}` : ""}`
    setDebugInfo((prev) => `${logEntry}\n${prev}`.slice(0, 15000)) // Keep log under 15k chars
    if (level === "error") console.error(logEntry)
    else if (level === "warn") console.warn(logEntry)
    // else console.log(logEntry); // Avoid excessive console logs for info
  }

  const handleCreateOrUpdateUser = async (userDataToProcess: TelegramUser) => {
    try {
      const dbUserData = await createOrUpdateUser(userDataToProcess)
      if (dbUserData) {
        setDbUser(dbUserData)
        setDbUserError(null) // Clear previous errors
        addDebugLog(`Successfully set dbUser for ${userDataToProcess.id}`, dbUserData)
      } else {
        setDbUser(null)
        const errorMsg = `Failed to create/update user in DB for ${userDataToProcess.id}. createOrUpdateUser returned null. Transactions will likely fail. Check Supabase connection, CORS, and RLS policies.`
        setDbUserError(errorMsg)
        addDebugLog(errorMsg, { telegramUserId: userDataToProcess.id }, "error")
      }
    } catch (err) {
      setDbUser(null)
      const errorMsg = `Error calling createOrUpdateUser for ${userDataToProcess.id}: ${(err as Error).message}. Transactions will likely fail. Check Supabase connection, CORS, and RLS policies.`
      setDbUserError(errorMsg)
      addDebugLog(errorMsg, { telegramUserId: userDataToProcess.id, error: err }, "error")
    }
  }

  useEffect(() => {
    const initTelegram = async () => {
      addDebugLog("Initializing Telegram WebApp...")
      setDbUserError(null) // Clear any previous errors on init

      if (process.env.NODE_ENV === "development" && localStorage.getItem("bypassAuth") === "true") {
        addDebugLog("Development bypass enabled")
        const mockUser = {
          id: 12345,
          first_name: "Dev User",
          username: "dev_user",
        }
        setUser(mockUser)
        setIsAuthenticated(true)
        await handleCreateOrUpdateUser(mockUser)
        setIsReady(true)
        return
      }

      const isTelegram = detectTelegramWebApp()
      setIsTelegramEnvironment(isTelegram)
      addDebugLog(`Telegram environment detected: ${isTelegram}`)

      if (isTelegram) {
        const tgWebApp = initializeTelegramWebApp()
        setWebApp(tgWebApp)
        addDebugLog(`WebApp initialized: ${!!tgWebApp}`)

        const telegramApiUser = getTelegramUser() // from tgWebApp.initDataUnsafe.user
        addDebugLog(`User data retrieved from Telegram API: ${!!telegramApiUser}`, telegramApiUser)

        if (telegramApiUser) {
          let canProceedWithUser = false
          if (process.env.NODE_ENV === "production" && tgWebApp?.initData) {
            addDebugLog("Verifying initData server-side (production mode)")
            const isValid = await verifyTelegramWebAppData(tgWebApp.initData)
            addDebugLog(`initData server-side verification result: ${isValid}`)
            if (isValid) {
              canProceedWithUser = true
            } else {
              addDebugLog("Server-side initData verification failed. User will not be authenticated.", {}, "error")
              setDbUserError("Telegram data verification failed. Cannot authenticate user.")
            }
          } else {
            addDebugLog("Development mode or no initData for server verification: trusting user data from Telegram API")
            canProceedWithUser = true // In dev, or if initData is not available for some reason
          }

          if (canProceedWithUser) {
            setUser(telegramApiUser)
            setIsAuthenticated(true)
            await handleCreateOrUpdateUser(telegramApiUser)
          }
        } else {
          addDebugLog("No user data available from Telegram API initially.", {}, "warn")
          // Potentially try mock user or wait for WebApp object if needed, but primary flow relies on telegramApiUser
          const mockUser = {
            // Fallback for environments like Telegram Desktop if no user data
            id: 99999,
            first_name: "TG Desktop User",
            username: "tg_desktop_user",
          }
          addDebugLog("Using mock user due to no initial Telegram user data.", mockUser, "warn")
          setUser(mockUser)
          setIsAuthenticated(true) // Authenticate mock user for basic UI
          await handleCreateOrUpdateUser(mockUser) // Attempt to save mock user
        }
      } else {
        addDebugLog("Not in Telegram environment")
      }

      setIsReady(true)
      addDebugLog("Initialization attempt complete")
    }

    initTelegram()

    // The delayed initTelegram might be redundant if the first one works or if issues are network-related.
    // Consider removing if it causes confusion or doesn't solve a specific timing problem.
    // const timeoutId = setTimeout(() => {
    //   addDebugLog("Running delayed initialization check");
    //   if (!dbUser && !dbUserError && user) { // Only if dbUser is still not set and no error reported yet
    //      initTelegram();
    //   }
    // }, 2000);
    // return () => clearTimeout(timeoutId);
  }, []) // Removed dependencies that might cause re-runs too often. Let it run once.

  // Watch for WebApp object becoming available (might be redundant if initial getTelegramUser() is reliable)
  useEffect(() => {
    if (isTelegramEnvironment && !webApp && window.Telegram?.WebApp) {
      addDebugLog("WebApp object became available later. Re-evaluating.")
      setWebApp(window.Telegram.WebApp)
      const freshUserData = getTelegramUser()
      if (freshUserData && !user) {
        // If initial user was not set
        addDebugLog("User data found in WebApp later.", freshUserData)
        setUser(freshUserData)
        setIsAuthenticated(true)
        handleCreateOrUpdateUser(freshUserData)
      }
    }
  }, [isTelegramEnvironment, webApp, user]) // React to these specific changes

  const hapticFeedback = (style: "light" | "medium" | "heavy" | "rigid" | "soft") => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred(style)
      addDebugLog(`Haptic feedback: ${style}`)
    }
  }

  return (
    <TelegramContext.Provider
      value={{
        user,
        dbUser,
        dbUserError, // Expose new error state
        isReady,
        isAuthenticated,
        webApp,
        hapticFeedback,
        isTelegramEnvironment,
        debugInfo,
      }}
    >
      {children}
    </TelegramContext.Provider>
  )
}
