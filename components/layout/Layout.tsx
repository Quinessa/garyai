"use client"

import { type ReactNode, useEffect } from "react"
import NavBar from "./NavBar"
import { useTelegram } from "@/contexts/TelegramContext"
import { useUI } from "@/contexts/UIContext"
import { useRouter } from "next/navigation"
import GaryLogo from "@/components/ui/GaryLogo"
import { useWallet } from "@/contexts/WalletContext"

export default function Layout({ children }: { children: ReactNode }) {
  const { webApp, isReady, isAuthenticated } = useTelegram()
  const { activeTab } = useUI()
  const { activeWallet } = useWallet()
  const router = useRouter()

  useEffect(() => {
    // Set the background color to match Telegram's theme
    if (webApp) {
      webApp.setBackgroundColor("#0A0E0B")
      webApp.expand()
    }
  }, [webApp])

  useEffect(() => {
    // Redirect to login if not authenticated
    if (isReady && !isAuthenticated) {
      router.push("/login")
    }
  }, [isReady, isAuthenticated, router])

  // Fix for Telegram WebApp button issues
  useEffect(() => {
    // Ensure Telegram doesn't capture clicks meant for our UI
    if (webApp) {
      // Log that we're applying fixes
      console.log("Applying Telegram WebApp fixes in Layout")

      // Disable Telegram's back button if it's interfering
      if (webApp.BackButton) {
        webApp.BackButton.hide()
      }

      // Ensure the WebApp is expanded
      webApp.expand()
    }
  }, [webApp])

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gary-accent"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 flex justify-between items-center border-b border-gary-border bg-gary-bg bg-opacity-70 backdrop-blur-md">
        <GaryLogo size="lg" />
        {activeWallet ? (
          <div className="gary-button-outline text-sm py-1 px-3 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Wallet Connected
          </div>
        ) : (
          <button className="gary-button-outline text-sm py-1 px-3">Connect Wallet</button>
        )}
      </header>
      <main className="flex-1 content-with-bottom-nav">{children}</main>
      <NavBar />
    </div>
  )
}
