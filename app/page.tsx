"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/layout/Layout"
import ChatInterface from "@/components/chat/ChatInterface"
import WalletPanel from "@/components/wallet/WalletPanel"
import TransactionList from "@/components/transactions/TransactionList"
import SendForm from "@/components/send/SendForm"
import SwapForm from "@/components/swap/SwapForm"
import DebugPanel from "@/components/debug/DebugPanel"
import { useUI } from "@/contexts/UIContext"
import { useTelegram } from "@/contexts/TelegramContext"

export default function Home() {
  const { activeTab } = useUI()
  const { webApp, isReady, isAuthenticated } = useTelegram()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.push("/login")
    }
  }, [isReady, isAuthenticated, router])

  useEffect(() => {
    // Initialize Telegram WebApp
    if (webApp) {
      webApp.ready()
      webApp.expand()
    }
  }, [webApp])

  // Show loading state while checking authentication
  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--telegram-bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--telegram-link)]"></div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="pb-16">
        {activeTab === "chat" && <ChatInterface />}
        {activeTab === "wallet" && <WalletPanel />}
        {activeTab === "send" && <SendForm />}
        {activeTab === "swap" && <SwapForm />}
        {activeTab === "history" && <TransactionList />}
        {activeTab === "debug" && <DebugPanel />}
      </div>
    </Layout>
  )
}
