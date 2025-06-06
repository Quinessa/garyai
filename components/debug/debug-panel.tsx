"use client"

import { useState, useEffect, useRef } from "react"
import { Copy, RefreshCw, Check } from "lucide-react"
import { useWallet } from "@/contexts/wallet-context"
import { useTelegram } from "@/contexts/telegram-context"
import { getActivityLogs, subscribeToActivityLogs } from "@/lib/services/activity-logger"
import { useUI } from "@/contexts/UIContext"

export function DebugPanel() {
  const { wallet, balanceCheckStats, refreshBalances, swapQuote, transactions, tokens, activeWallet } = useWallet()
  const { webApp, user, isReady, isAuthenticated, isTelegramEnvironment, debugInfo } = useTelegram()
  const { activeTab, logActivity, activityLogs, clearActivityLogs } = useUI()

  const [activeTabLocal, setActiveTabLocal] = useState("general")
  const [logs, setLogs] = useState<any[]>([])
  const [showSwapDetails, setShowSwapDetails] = useState(false)
  const [userAgent, setUserAgent] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCopied, setIsCopied] = useState(false)
  const [showTransactions, setShowTransactions] = useState(false)
  const debugPanelRef = useRef<HTMLDivElement>(null)
  // Add a new state to track whether to show swap debug info
  const [showSwapDebug, setShowSwapDebug] = useState(false)
  const [swapLogs, setSwapLogs] = useState<any[]>([])

  // Subscribe to activity logs
  useEffect(() => {
    // Get initial logs
    const allLogs = getActivityLogs()
    setLogs(allLogs)

    // Filter swap logs
    setSwapLogs(
      allLogs.filter(
        (log) => log.action.toLowerCase().includes("swap") || (log.data && log.data.fromToken && log.data.toToken),
      ),
    )

    // Subscribe to new logs
    const unsubscribe = subscribeToActivityLogs((entry) => {
      setLogs((prev) => [entry, ...prev])

      // Update swap logs if relevant
      if (entry.action.toLowerCase().includes("swap") || (entry.data && entry.data.fromToken && entry.data.toToken)) {
        setSwapLogs((prev) => [entry, ...prev])
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent)
    }

    // Add initial log
    logActivity("Debug panel initialized")

    // Get activity logs
    const logs = getActivityLogs()
    setSwapLogs(
      logs.filter(
        (log) => log.action.toLowerCase().includes("swap") || (log.data && (log.data.fromToken || log.data.toToken)),
      ),
    )

    // Subscribe to new logs
    const unsubscribe = subscribeToActivityLogs((entry) => {
      if (entry.action.toLowerCase().includes("swap") || (entry.data && (entry.data.fromToken || entry.data.toToken))) {
        setSwapLogs((prev) => [entry, ...prev])
      }
    })

    return () => unsubscribe()
  }, [logActivity])

  // Refresh debug info
  const refreshDebugInfo = () => {
    logActivity("Debug info refreshed")
    setRefreshKey((prev) => prev + 1)
    refreshBalances()
  }

  // Clear logs
  const clearLogs = () => {
    clearActivityLogs()
    logActivity("Logs cleared")
  }

  // Update the copyDebugInfo function to include swap debug information
  const copyDebugInfo = () => {
    if (!debugPanelRef.current) return

    try {
      // Gather all debug information
      const telegramEnv = `
Telegram Environment:
Is Telegram Environment: ${isTelegramEnvironment ? "Yes" : "No"}
Is Ready: ${isReady ? "Yes" : "No"}
Is Authenticated: ${isAuthenticated ? "Yes" : "No"}
      `

      const userInfo = `
User Info:
${user ? JSON.stringify(user, null, 2) : "No user data"}
      `

      const webAppInfo = `
WebApp Properties:
${
  webApp
    ? JSON.stringify(
        {
          version: webApp.version,
          colorScheme: webApp.colorScheme,
          themeParams: webApp.themeParams,
          isExpanded: webApp.isExpanded,
          viewportHeight: webApp.viewportHeight,
          viewportStableHeight: webApp.viewportStableHeight,
        },
        null,
        2,
      )
    : "WebApp not available"
}
      `

      const windowInfo = `
Window Information:
${
  typeof window !== "undefined"
    ? `window.Telegram exists: ${!!window.Telegram}
window.Telegram.WebApp exists: ${!!(window.Telegram && window.Telegram.WebApp)}`
    : "Window not available"
}
      `

      const userAgentInfo = `
User Agent:
${userAgent || "User agent not available"}
      `

      const walletInfo = `
Wallet Info:
${
  activeWallet
    ? `Active Wallet: ${activeWallet.address}
Tokens: ${tokens.map((t) => `${t.symbol}: ${t.balance || "0"}`).join(", ")}`
    : "No active wallet"
}
      `

      const balanceCheckInfo = `
Balance Check Stats:
Last Check: ${balanceCheckStats?.lastCheck ? new Date(balanceCheckStats.lastCheck).toLocaleTimeString() : "Never"}
Total Checks: ${balanceCheckStats?.totalChecks || 0}
Successful: ${balanceCheckStats?.successfulChecks || 0}
Failed: ${balanceCheckStats?.failedChecks || 0}
Last Response: ${balanceCheckStats?.lastResponse || "N/A"}
Last Error: ${balanceCheckStats?.lastError || "None"}
      `

      const transactionInfo = `
Transactions:
${
  transactions.length > 0
    ? `Count: ${transactions.length}
Latest: ${transactions[0]?.txHash || "None"}
Status: ${transactions[0]?.status || "N/A"}`
    : "No transactions"
}
      `

      // Add swap debug information
      const swapDebugInfo = `
Swap Debug Information:
${
  swapQuote
    ? `Current Quote: 
  From: ${swapQuote.fromToken.address} (${swapQuote.fromToken.amount})
  To: ${swapQuote.toToken.address} (${swapQuote.toToken.amount})
  Min Amount: ${swapQuote.toToken.minAmount}
  Execution Price: ${swapQuote.executionPrice}
  Price Impact: ${swapQuote.priceImpact}`
    : "No active swap quote"
}

Swap Transactions:
${
  transactions.filter((tx) => tx.txType === "swap").length > 0
    ? transactions
        .filter((tx) => tx.txType === "swap")
        .map(
          (tx) =>
            `- Hash: ${tx.txHash}
  Status: ${tx.status}
  Tokens: ${tx.tokenSymbol}
  Amount: ${tx.amount}
  Time: ${tx.timestamp.toLocaleTimeString()}`,
        )
        .join("\n")
    : "No swap transactions found"
}

Swap Configuration:
RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Uniswap Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
WETH Address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
Default Slippage: 0.5%
Swap Deadline: 20 minutes
      `

      const blockchainInfo = `
Blockchain Connection:
RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Network: Ethereum Mainnet
      `

      const logInfo = `
Activity Log:
${activityLogs.join("\n")}
      `

      const localStorageInfo = `
Local Storage:
${
  typeof window !== "undefined"
    ? Object.keys(localStorage)
        .map((key) => `${key}: ${localStorage.getItem(key)}`)
        .join("\n")
    : "Local Storage not available"
}
      `

      // Combine all info
      const allDebugInfo = `=== GaryAI Wallet Debug Info ===
${telegramEnv}
${userInfo}
${webAppInfo}
${windowInfo}
${userAgentInfo}
${walletInfo}
${balanceCheckInfo}
${transactionInfo}
${swapDebugInfo}
${blockchainInfo}
${logInfo}
${localStorageInfo}
      `

      // Copy to clipboard
      navigator.clipboard.writeText(allDebugInfo)

      // Show success state
      setIsCopied(true)
      logActivity("Debug info copied to clipboard")

      // Reset copy state after 2 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch (error) {
      console.error("Failed to copy debug info:", error)
      logActivity("Failed to copy debug info")
    }
  }

  const toggleSwapDebug = () => {
    setShowSwapDebug(!showSwapDebug)
    logActivity(`${!showSwapDebug ? "Showing" : "Hiding"} swap debug information`)
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => alert("Copied to clipboard"))
      .catch((err) => console.error("Failed to copy: ", err))
  }

  const handleRefreshNow = () => {
    refreshBalances()
  }

  const handleClearLogs = () => {
    if (typeof window !== "undefined") {
      window.activityLogs = []
      setLogs([])
      setSwapLogs([])
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4" ref={debugPanelRef}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Debug Information</h2>
        <div className="flex space-x-2">
          <button onClick={copyDebugInfo} className="p-2 bg-gray-700 rounded-full" aria-label="Copy debug info">
            {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
          <button onClick={refreshDebugInfo} className="p-2 bg-gray-700 rounded-full" aria-label="Refresh debug info">
            <RefreshCw size={16} />
          </button>
          <button onClick={clearLogs} className="px-2 py-1 bg-gray-700 rounded text-xs">
            Clear Logs
          </button>
        </div>
      </div>

      {/* Blockchain Connection */}
      <div className="tg-card">
        <h3 className="font-semibold mb-2">Blockchain Connection</h3>
        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
          {`RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Network: Ethereum Mainnet
Encryption Key: ${process.env.ENCRYPTION_KEY ? "Configured" : "Not configured"}`}
        </pre>
      </div>

      {/* Wallet Info */}
      <div className="tg-card">
        <h3 className="font-semibold mb-2">Wallet Info</h3>
        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
          {activeWallet
            ? `Active Wallet: ${activeWallet.address}
Tokens: ${tokens.map((t) => `${t.symbol}: ${t.balance || "0"}`).join(", ")}`
            : "No active wallet"}
        </pre>
      </div>

      {/* Balance Check Stats */}
      <div className="tg-card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Balance Check Stats</h3>
          <button onClick={refreshBalances} className="px-2 py-1 bg-gray-700 rounded text-xs flex items-center">
            <RefreshCw size={12} className="mr-1" /> Refresh Now
          </button>
        </div>
        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
          {`Last Check: ${balanceCheckStats?.lastCheck ? new Date(balanceCheckStats.lastCheck).toLocaleTimeString() : "Never"}
Total Checks: ${balanceCheckStats?.totalChecks || 0}
Successful: ${balanceCheckStats?.successfulChecks || 0}
Failed: ${balanceCheckStats?.failedChecks || 0}
Last Response: ${balanceCheckStats?.lastResponse || "N/A"}
Last Error: ${balanceCheckStats?.lastError || "None"}`}
        </pre>
      </div>

      {/* Swap Debug Information */}
      <div className="tg-card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Swap Debug Information</h3>
          <button onClick={toggleSwapDebug} className="text-xs bg-gray-700 px-2 py-1 rounded">
            {showSwapDebug ? "Hide" : "Show"}
          </button>
        </div>

        {showSwapDebug ? (
          <div className="space-y-2">
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1">Current Swap Quote:</h4>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40">
                {swapQuote ? JSON.stringify(swapQuote, null, 2) : "No active swap quote"}
              </pre>
            </div>

            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1">Swap-Related Transactions:</h4>
              {transactions.filter((tx) => tx.txType === "swap").length > 0 ? (
                <div className="space-y-1">
                  {transactions
                    .filter((tx) => tx.txType === "swap")
                    .map((tx) => (
                      <div key={tx.id} className="text-xs p-1 border-b border-gray-800">
                        <div className="flex justify-between">
                          <span>Hash:</span>
                          <span className="truncate max-w-[180px]">{tx.txHash}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span
                            className={`
                            ${tx.status === "confirmed" ? "text-green-500" : ""}
                            ${tx.status === "pending" ? "text-yellow-500" : ""}
                            ${tx.status === "failed" ? "text-red-500" : ""}
                          `}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tokens:</span>
                          <span>{tx.tokenSymbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Amount:</span>
                          <span>{tx.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Time:</span>
                          <span>{tx.timestamp.toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-xs text-gary-text-secondary">No swap transactions found</div>
              )}
            </div>

            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1">Swap Activity Logs:</h4>
              <div className="max-h-40 overflow-auto">
                {swapLogs.length > 0 ? (
                  swapLogs.map((log, index) => (
                    <div key={index} className="text-xs p-1 border-b border-gray-800">
                      <div className="font-semibold">
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.action}
                      </div>
                      {log.data && (
                        <div className="pl-2 text-gary-text-secondary">{JSON.stringify(log.data, null, 2)}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gary-text-secondary">No swap logs found</div>
                )}
              </div>
            </div>

            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1">Swap Configuration:</h4>
              <pre className="text-xs whitespace-pre-wrap">
                {`RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Uniswap Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
WETH Address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
Default Slippage: 0.5%
Swap Deadline: 20 minutes`}
              </pre>
            </div>
          </div>
        ) : (
          <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
            {swapQuote
              ? `Active Quote: ${swapQuote.fromToken.amount} → ${swapQuote.toToken.amount}
Rate: 1 = ${swapQuote.executionPrice}
Impact: ${swapQuote.priceImpact}`
              : "No active swap quote"}
            {transactions.filter((tx) => tx.txType === "swap").length > 0
              ? `
Swap Transactions: ${transactions.filter((tx) => tx.txType === "swap").length}
Latest: ${transactions.filter((tx) => tx.txType === "swap")[0]?.status || "N/A"}`
              : "\nNo swap transactions"}
          </pre>
        )}
      </div>

      {/* Transactions */}
      <div className="tg-card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Transactions</h3>
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="text-xs bg-gray-700 px-2 py-1 rounded"
          >
            {showTransactions ? "Hide" : "Show"}
          </button>
        </div>

        {showTransactions ? (
          <div className="text-xs">
            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-gray-900 p-2 rounded">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="capitalize">{tx.txType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hash:</span>
                      <span className="truncate max-w-[180px]">{tx.txHash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span
                        className={`
                        ${tx.status === "confirmed" ? "text-green-500" : ""}
                        ${tx.status === "pending" ? "text-yellow-500" : ""}
                        ${tx.status === "failed" ? "text-red-500" : ""}
                      `}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>
                        {tx.amount} {tx.tokenSymbol}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-gary-text-secondary">No transactions</div>
            )}
          </div>
        ) : (
          <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
            {transactions.length > 0
              ? `Count: ${transactions.length}
Latest: ${transactions[0]?.txHash || "None"}
Status: ${transactions[0]?.status || "N/A"}`
              : "No transactions"}
          </pre>
        )}
      </div>

      {/* Telegram Environment */}
      <div className="tg-card">
        <h3 className="font-semibold mb-2">Telegram Environment</h3>
        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded">
          {`Is Telegram Environment: ${isTelegramEnvironment ? "Yes" : "No"}
Is Ready: ${isReady ? "Yes" : "No"}
Is Authenticated: ${isAuthenticated ? "Yes" : "No"}`}
        </pre>
      </div>

      {/* Activity Log */}
      <div className="tg-card">
        <h3 className="font-semibold mb-2">Activity Log</h3>
        <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-64 bg-gray-900 p-2 rounded">
          {activityLogs.length > 0 ? activityLogs.join("\n") : "No activity logged yet"}
        </pre>
      </div>
    </div>
  )
}
