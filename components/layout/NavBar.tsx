"use client"

import { useUI } from "@/contexts/UIContext"
import { MessageSquare, Wallet, Send, RefreshCw, Clock, Bug } from "lucide-react"
import { useTelegram } from "@/contexts/TelegramContext"
import { useEffect, useRef, useState, useCallback } from "react"

export default function NavBar() {
  const { activeTab, setActiveTab, logActivity } = useUI()
  const { hapticFeedback, webApp } = useTelegram()
  const navRef = useRef<HTMLElement>(null)
  const [mounted, setMounted] = useState(false)

  const tabs = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "send", icon: Send, label: "Send" },
    { id: "swap", icon: RefreshCw, label: "Swap" },
    { id: "history", icon: Clock, label: "History" },
    { id: "debug", icon: Bug, label: "Debug" },
  ] as const

  // Handle tab change with React's event system
  const handleTabChange = useCallback(
    (tabId: (typeof tabs)[number]["id"]) => {
      console.log(`Tab clicked in React handler: ${tabId}`)

      // Log the tab change explicitly here
      logActivity(`User clicked on tab: ${tabId}`)

      // Provide haptic feedback
      try {
        hapticFeedback("selection")
      } catch (err) {
        console.error("Haptic feedback error:", err)
      }

      // Update the active tab state
      setActiveTab(tabId)
    },
    [hapticFeedback, setActiveTab, logActivity],
  )

  // Fix for Telegram WebApp button click issues - without breaking React
  useEffect(() => {
    if (!navRef.current || mounted) return

    // Mark as mounted to prevent multiple applications
    setMounted(true)

    // Ensure the nav bar is above Telegram's UI
    navRef.current.style.zIndex = "9999"
    console.log("Applying Telegram WebApp button fixes (React-friendly version)")

    // Add a global click handler to help with Telegram's event issues
    const handleGlobalClick = (e: MouseEvent) => {
      // Find the closest button
      const button = (e.target as HTMLElement).closest("button[data-tab-id]")
      if (button && navRef.current?.contains(button)) {
        const tabId = button.getAttribute("data-tab-id")
        if (tabId) {
          console.log(`Global click handler detected tab: ${tabId}`)
          // Log the tab change here too to ensure it's captured
          logActivity(`User clicked on tab (global handler): ${tabId}`)
          // Use setTimeout to break out of Telegram's event handling
          setTimeout(() => {
            setActiveTab(tabId as any)
          }, 0)
        }
      }
    }

    // Add the global click handler
    document.addEventListener("click", handleGlobalClick, true)

    // Clean up
    return () => {
      document.removeEventListener("click", handleGlobalClick, true)
    }
  }, [setActiveTab, mounted, logActivity])

  // Log initial mount
  useEffect(() => {
    logActivity("Navigation bar initialized")
  }, [logActivity])

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 bg-gary-bg bg-opacity-70 backdrop-blur-md border-t border-gary-border z-50"
    >
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${
              activeTab === tab.id ? "text-gary-accent gary-glow" : "text-gary-text-secondary"
            }`}
            style={{ touchAction: "manipulation" }}
            onClick={() => handleTabChange(tab.id)}
          >
            <tab.icon size={20} className={activeTab === tab.id ? "gary-glow" : ""} />
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
