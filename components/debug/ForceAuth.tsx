"use client"

import { useState, useEffect } from "react"

export default function ForceAuth() {
  const [isTelegramAvailable, setIsTelegramAvailable] = useState(false)

  useEffect(() => {
    // Check if Telegram WebApp is available
    setIsTelegramAvailable(!!window.Telegram?.WebApp)

    // Log detection
    console.log("ForceAuth component mounted")
    console.log("Telegram WebApp available:", !!window.Telegram?.WebApp)

    // If Telegram WebApp is available, call ready
    if (window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready()
        console.log("WebApp.ready() called from ForceAuth component")
      } catch (e) {
        console.error("Error calling WebApp.ready():", e)
      }
    }
  }, [])

  const forceAuth = () => {
    // Store a mock user ID
    localStorage.setItem("telegramUserId", "12345")
    // Reload the page
    window.location.reload()
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button onClick={forceAuth} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
        Force Auth
      </button>
      <div className="text-xs mt-1 text-white bg-gray-800 p-1 rounded">
        Telegram: {isTelegramAvailable ? "Available" : "Not Available"}
      </div>
    </div>
  )
}
