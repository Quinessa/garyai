"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTelegram } from "@/contexts/TelegramContext"
import Image from "next/image"
import { detectTelegramWebApp } from "@/lib/telegram-detector"

export default function Login() {
  const { isReady, isAuthenticated, isTelegramEnvironment } = useTelegram()
  const [showDebug, setShowDebug] = useState(false)
  const [userAgent, setUserAgent] = useState("")
  const [manualDetection, setManualDetection] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // If authenticated, redirect to home
    if (isReady && isAuthenticated) {
      router.push("/")
    }

    // Get user agent for debugging
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent)
    }

    // Run manual detection
    const result = detectTelegramWebApp()
    setManualDetection(result)
  }, [isReady, isAuthenticated, router])

  // Get the bot username from environment variable or use default
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "garyai_bot"
  const botLink = `https://t.me/${botUsername}`

  const bypassLogin = () => {
    localStorage.setItem("bypassAuth", "true")
    window.location.reload()
  }

  const toggleDebug = () => {
    setShowDebug(!showDebug)
  }

  const forceDetectTelegram = () => {
    localStorage.setItem("forceTelegramDetection", "true")
    window.location.reload()
  }

  const openInTelegram = () => {
    // Try to open in Telegram app
    window.location.href = botLink
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="gary-card max-w-md w-full text-center border border-gary-border backdrop-blur-md bg-opacity-70 bg-gary-bg">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4 w-32 h-32 flex items-center justify-center">
            <Image
              src="/images/gary-logo.png"
              alt="GaryAI Logo"
              width={120}
              height={120}
              className="object-contain"
              style={{ background: "transparent" }}
            />
          </div>
          <h1 className="text-2xl font-light text-gary-text">Welcome to GaryAI Wallet</h1>
        </div>

        <p className="mb-6 text-gary-text-secondary">
          {isTelegramEnvironment
            ? "Initializing Telegram Mini App..."
            : "Please open this app from Telegram to continue."}
        </p>

        <div className="gary-card mb-6 border border-gary-border backdrop-blur-md bg-opacity-50 bg-gary-bg">
          <p className="text-sm text-gary-text-secondary">
            This app is designed to work as a Telegram Mini App. Please open it from the Telegram bot:{" "}
            <a href={botLink} className="gary-link">
              @{botUsername}
            </a>
          </p>
        </div>

        <button onClick={openInTelegram} className="gary-button inline-block mb-4">
          Open in Telegram
        </button>

        <div className="mt-4 space-y-2">
          <button onClick={bypassLogin} className="text-xs gary-link block">
            Bypass Login (Development Only)
          </button>

          <button onClick={forceDetectTelegram} className="text-xs gary-link block">
            Force Telegram Detection
          </button>
        </div>

        <button onClick={toggleDebug} className="text-xs text-gary-text-secondary underline mt-4">
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </button>

        {showDebug && (
          <div className="mt-4 p-4 gary-card border border-gary-border text-left backdrop-blur-md bg-opacity-50 bg-gary-bg">
            <h3 className="text-sm font-semibold mb-2">Debug Information:</h3>

            <div className="mb-2">
              <h4 className="text-xs font-semibold">Telegram Environment:</h4>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-20 bg-gary-bg bg-opacity-70 p-2 rounded">
                {`Is Telegram Environment: ${isTelegramEnvironment ? "Yes" : "No"}
Is Ready: ${isReady ? "Yes" : "No"}
Is Authenticated: ${isAuthenticated ? "Yes" : "No"}
Manual Detection: ${manualDetection === null ? "Not run" : manualDetection ? "Yes" : "No"}`}
              </pre>
            </div>

            <div className="mb-2">
              <h4 className="text-xs font-semibold">Window Information:</h4>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-20 bg-gary-bg bg-opacity-70 p-2 rounded">
                {typeof window !== "undefined"
                  ? `window.Telegram exists: ${!!window.Telegram}
window.Telegram.WebApp exists: ${!!(window.Telegram && window.Telegram.WebApp)}
In iframe: ${window !== window.parent ? "Yes" : "No"}`
                  : "Window not available"}
              </pre>
            </div>

            <div className="mb-2">
              <h4 className="text-xs font-semibold">User Agent:</h4>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-20 bg-gary-bg bg-opacity-70 p-2 rounded">
                {userAgent || "User agent not available"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
