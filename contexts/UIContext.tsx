"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

type Tab = "chat" | "wallet" | "send" | "swap" | "history" | "debug" | "settings"

type UIContextType = {
  activeTab: Tab
  isBottomSheetOpen: boolean
  bottomSheetContent: React.ReactNode | null
  activityLogs: string[] // Expose logs directly
  setActiveTab: (tab: Tab) => void
  openBottomSheet: (content: React.ReactNode) => void
  closeBottomSheet: () => void
  showToast: (message: string, type?: "success" | "error" | "info") => void
  logActivity: (message: string) => void
  clearActivityLogs: () => void // Add clear function
}

const UIContext = createContext<UIContextType>({
  activeTab: "chat",
  isBottomSheetOpen: false,
  bottomSheetContent: null,
  activityLogs: [],
  setActiveTab: () => {},
  openBottomSheet: () => {},
  closeBottomSheet: () => {},
  showToast: () => {},
  logActivity: () => {},
  clearActivityLogs: () => {},
})

export const useUI = () => useContext(UIContext)

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<Tab>("chat")
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [bottomSheetContent, setBottomSheetContent] = useState<React.ReactNode | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)
  const [activityLogs, setActivityLogs] = useState<string[]>([])

  // Function to log activity with timestamp
  const logActivity = useCallback((message: string) => {
    const timestamp = new Date().toISOString().substring(11, 19)
    const logEntry = `[${timestamp}] ${message}`
    console.log(`Activity Log: ${logEntry}`)

    // Add to activity log
    setActivityLogs((prev) => {
      // Check if this exact message is already the most recent entry
      if (prev.length > 0 && prev[0].endsWith(message)) {
        return prev // Don't add duplicate consecutive entries
      }
      return [logEntry, ...prev].slice(0, 100) // Keep last 100 entries
    })
  }, [])

  // Function to clear activity logs
  const clearActivityLogs = useCallback(() => {
    setActivityLogs([])
  }, [])

  const handleSetActiveTab = useCallback(
    (tab: Tab) => {
      console.log(`UIContext: Setting active tab from ${activeTab} to ${tab}`)

      // Log the tab change
      logActivity(`Tab changed to: ${tab}`)

      // Close any open bottom sheet when changing tabs
      if (isBottomSheetOpen) {
        setIsBottomSheetOpen(false)
        setTimeout(() => {
          setBottomSheetContent(null)
        }, 300)
      }

      setActiveTab(tab)
    },
    [activeTab, isBottomSheetOpen, logActivity],
  )

  const openBottomSheet = useCallback(
    (content: React.ReactNode) => {
      console.log("Opening bottom sheet")
      logActivity("Bottom sheet opened")
      setBottomSheetContent(content)
      setIsBottomSheetOpen(true)
    },
    [logActivity],
  )

  const closeBottomSheet = useCallback(() => {
    console.log("Closing bottom sheet")
    logActivity("Bottom sheet closed")
    setIsBottomSheetOpen(false)
    setTimeout(() => {
      setBottomSheetContent(null)
    }, 300) // Wait for the animation to complete
  }, [logActivity])

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      logActivity(`Toast shown: ${message} (${type})`)
      setToast({ message, type })
      setTimeout(() => {
        setToast(null)
      }, 3000)
    },
    [logActivity],
  )

  // Log initial tab on mount
  useEffect(() => {
    logActivity(`Initial tab: ${activeTab}`)
  }, [])

  return (
    <UIContext.Provider
      value={{
        activeTab,
        isBottomSheetOpen,
        bottomSheetContent,
        activityLogs,
        setActiveTab: handleSetActiveTab,
        openBottomSheet,
        closeBottomSheet,
        showToast,
        logActivity,
        clearActivityLogs,
      }}
    >
      {children}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-white z-50 ${
            toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-blue-500"
          }`}
        >
          {toast.message}
        </div>
      )}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={closeBottomSheet}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-[var(--telegram-secondary-bg)] rounded-t-xl p-4 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto"
            style={{ maxHeight: "80vh", paddingBottom: "80px" }} // Add extra padding at the bottom
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            {bottomSheetContent}
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}
