"use client"

import { useState, useEffect, useRef } from "react"
import { useTelegram } from "@/contexts/TelegramContext"
import { useWallet } from "@/contexts/WalletContext"
import { useUI } from "@/contexts/UIContext"
import { RefreshCw, Copy, Check, AlertTriangle, Key, TestTube, Zap } from "lucide-react"
import { getActivityLogs, subscribeToActivityLogs } from "@/lib/services/activity-logger"
import { getSupabaseClientInitializationInfo } from "@/lib/supabase-client"

const TOKEN_ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48",
}

// Known encrypted values from user's storage
const KNOWN_ENCRYPTED_VALUES = {
  privateKey:
    "U2FsdGVkX1+qAyzmAGviT6tAit8KX8m5gYf/AiGzkez2pfSbcU+siVrngR/nQM9yIZyYEHJB8hFh9WR0Qe/7CrLMv55+hvXsX08+6CotH8AGktEYnpSAAnmirMFqKVgf",
  mnemonic:
    "U2FsdGVkX18pbDmVN/qwSNmb6IPJ+75dmqy1mMP3vpBl5V0jFbPdKR98tq6/TPvzRmaSrlOtVb3U4jvsLyXp+3rBkWe9LB5eafru0QzEagUObjjXspREruvHQ9TrsaP8",
}

export default function DebugPanel() {
  const { webApp, user, dbUser, dbUserError, isReady, isAuthenticated, isTelegramEnvironment, debugInfo } =
    useTelegram()
  const { activeWallet, tokens, transactions, refreshBalances, balanceCheckStats, swapQuote, showToast, wallets } =
    useWallet()
  const {
    activeTab,
    logActivity,
    clearActivityLogs,
    swapFromToken,
    swapToToken,
    swapFromAmount,
    maxAmount,
    slippageTolerance,
  } = useUI()
  const [userAgent, setUserAgent] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCopied, setIsCopied] = useState(false)
  const [showTransactions, setShowTransactions] = useState(false)
  const debugPanelRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [swapLogs, setSwapLogs] = useState<any[]>([])
  const [showSwapDebug, setShowSwapDebug] = useState(false)
  const [transactionContextLogs, setTransactionContextLogs] = useState<any[]>([])
  const [supabaseInitInfo, setSupabaseInitInfo] = useState<string>("Fetching Supabase init info...")

  // New state for encryption testing
  const [encryptionTestResults, setEncryptionTestResults] = useState<any>(null)
  const [isTestingEncryption, setIsTestingEncryption] = useState(false)
  const [showEncryptionTests, setShowEncryptionTests] = useState(true)

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent)
    }
    logActivity("Debug panel initialized")

    const info = getSupabaseClientInitializationInfo()
    setSupabaseInitInfo(
      `URL Configured: ${info.url ? "Yes" : "NO (MISSING NEXT_PUBLIC_SUPABASE_URL)"}
Anon Key Configured: ${info.anonKey ? "Yes" : "NO (MISSING NEXT_PUBLIC_SUPABASE_ANON_KEY)"}
Client Instance Created: ${info.clientInitialized ? "Yes" : "No"}
URL Used (first 20 chars): ${info.url ? info.url.substring(0, 20) + "..." : "N/A"}`,
    )
  }, [logActivity])

  useEffect(() => {
    const allLogsFromService = getActivityLogs()
    setLogs(allLogsFromService)
    setSwapLogs(
      allLogsFromService.filter(
        (log) => log.action.toLowerCase().includes("swap") || (log.data && log.data.fromToken && log.data.toToken),
      ),
    )
    setTransactionContextLogs(
      allLogsFromService.filter(
        (log) =>
          log.action.toLowerCase().includes("sendtransaction: initial state check") ||
          log.action.toLowerCase().includes("executetokenswap: initial state check"),
      ),
    )

    const unsubscribe = subscribeToActivityLogs((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 500))

      if (entry.action.toLowerCase().includes("swap") || (entry.data && entry.data.fromToken && entry.data.toToken)) {
        setSwapLogs((prev) => [entry, ...prev].slice(0, 100))
      }
      if (
        entry.action.toLowerCase().includes("sendtransaction: initial state check") ||
        entry.action.toLowerCase().includes("executetokenswap: initial state check")
      ) {
        setTransactionContextLogs((prev) => [entry, ...prev].slice(0, 50))
      }
    })

    return () => unsubscribe()
  }, [])

  // Test server health endpoint only
  const testServerHealth = async () => {
    setIsTestingEncryption(true)
    logActivity("Testing server health endpoint only")

    try {
      const response = await fetch("/api/wallet/decrypt", { method: "GET" })
      const data = await response.json()

      const result = {
        timestamp: new Date().toISOString(),
        serverHealth: {
          status: response.status,
          ok: response.ok,
          data: data,
        },
      }

      setEncryptionTestResults(result)
      logActivity("Server health test completed", result)

      if (response.ok && data.healthy) {
        showToast("✅ Server encryption system is healthy!", "success")
      } else {
        showToast("❌ Server encryption system has issues", "error")
      }
    } catch (error: any) {
      const errorResult = {
        timestamp: new Date().toISOString(),
        error: error.message,
      }
      setEncryptionTestResults(errorResult)
      logActivity("Server health test failed", errorResult)
      showToast("Server health test failed: " + error.message, "error")
    } finally {
      setIsTestingEncryption(false)
    }
  }

  // Test decryption of known private key
  const testKnownPrivateKey = async () => {
    setIsTestingEncryption(true)
    logActivity("Testing decryption of known private key", {
      encryptedKeyPreview: KNOWN_ENCRYPTED_VALUES.privateKey.substring(0, 20),
    })

    try {
      const response = await fetch("/api/wallet/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedData: KNOWN_ENCRYPTED_VALUES.privateKey }),
      })

      const data = await response.json()

      const result = {
        timestamp: new Date().toISOString(),
        test: "known_private_key",
        request: {
          encryptedData: KNOWN_ENCRYPTED_VALUES.privateKey.substring(0, 30) + "...",
          fullLength: KNOWN_ENCRYPTED_VALUES.privateKey.length,
        },
        response: {
          status: response.status,
          ok: response.ok,
          success: data.success,
          error: data.error,
          hasData: !!data.data,
          dataLength: data.data?.length || 0,
          dataPreview: data.data ? data.data.substring(0, 10) + "..." : "N/A",
          looksLikePrivateKey: data.data?.length === 64 || data.data?.startsWith("0x"),
        },
      }

      setEncryptionTestResults(result)
      logActivity("Known private key decryption test completed", result)

      if (data.success && data.data) {
        showToast(`✅ Private key decrypted! Length: ${data.data.length}`, "success")
      } else {
        showToast(`❌ Private key decryption failed: ${data.error}`, "error")
      }
    } catch (error: any) {
      const errorResult = {
        timestamp: new Date().toISOString(),
        error: error.message,
      }
      setEncryptionTestResults(errorResult)
      logActivity("Known private key decryption test failed", errorResult)
      showToast("Test failed: " + error.message, "error")
    } finally {
      setIsTestingEncryption(false)
    }
  }

  // Test decryption of known mnemonic
  const testKnownMnemonic = async () => {
    setIsTestingEncryption(true)
    logActivity("Testing decryption of known mnemonic", {
      encryptedMnemonicPreview: KNOWN_ENCRYPTED_VALUES.mnemonic.substring(0, 20),
    })

    try {
      const response = await fetch("/api/wallet/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedData: KNOWN_ENCRYPTED_VALUES.mnemonic }),
      })

      const data = await response.json()

      const result = {
        timestamp: new Date().toISOString(),
        test: "known_mnemonic",
        request: {
          encryptedData: KNOWN_ENCRYPTED_VALUES.mnemonic.substring(0, 30) + "...",
          fullLength: KNOWN_ENCRYPTED_VALUES.mnemonic.length,
        },
        response: {
          status: response.status,
          ok: response.ok,
          success: data.success,
          error: data.error,
          hasData: !!data.data,
          dataLength: data.data?.length || 0,
          wordCount: data.data ? data.data.split(" ").length : 0,
          looksLikeMnemonic: data.data ? data.data.split(" ").length >= 12 : false,
        },
      }

      setEncryptionTestResults(result)
      logActivity("Known mnemonic decryption test completed", result)

      if (data.success && data.data) {
        const wordCount = data.data.split(" ").length
        showToast(`✅ Mnemonic decrypted! ${wordCount} words`, "success")
      } else {
        showToast(`❌ Mnemonic decryption failed: ${data.error}`, "error")
      }
    } catch (error: any) {
      const errorResult = {
        timestamp: new Date().toISOString(),
        error: error.message,
      }
      setEncryptionTestResults(errorResult)
      logActivity("Known mnemonic decryption test failed", errorResult)
      showToast("Test failed: " + error.message, "error")
    } finally {
      setIsTestingEncryption(false)
    }
  }

  // Test simple encryption/decryption cycle
  const testSimpleEncryptDecrypt = async () => {
    setIsTestingEncryption(true)
    logActivity("Testing simple encrypt/decrypt cycle")

    try {
      const testData = "test-private-key-123456789"

      // First encrypt
      const encryptResponse = await fetch("/api/wallet/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: testData }),
      })
      const encryptData = await encryptResponse.json()

      if (!encryptData.success) {
        throw new Error(`Encryption failed: ${encryptData.error}`)
      }

      // Then decrypt
      const decryptResponse = await fetch("/api/wallet/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedData: encryptData.encryptedData }),
      })
      const decryptData = await decryptResponse.json()

      const result = {
        timestamp: new Date().toISOString(),
        test: "simple_encrypt_decrypt",
        originalData: testData,
        encryption: {
          status: encryptResponse.status,
          success: encryptData.success,
          encryptedLength: encryptData.encryptedData?.length || 0,
        },
        decryption: {
          status: decryptResponse.status,
          success: decryptData.success,
          decryptedData: decryptData.data,
          dataMatches: decryptData.data === testData,
        },
      }

      setEncryptionTestResults(result)
      logActivity("Simple encrypt/decrypt test completed", result)

      if (result.decryption.dataMatches) {
        showToast("✅ Encrypt/decrypt cycle works perfectly!", "success")
      } else {
        showToast("❌ Encrypt/decrypt cycle failed", "error")
      }
    } catch (error: any) {
      const errorResult = {
        timestamp: new Date().toISOString(),
        error: error.message,
      }
      setEncryptionTestResults(errorResult)
      logActivity("Simple encrypt/decrypt test failed", errorResult)
      showToast("Test failed: " + error.message, "error")
    } finally {
      setIsTestingEncryption(false)
    }
  }

  const refreshDebugInfo = () => {
    logActivity("Debug info refreshed")
    setRefreshKey((prev) => prev + 1)
    refreshBalances()
    const info = getSupabaseClientInitializationInfo()
    setSupabaseInitInfo(
      `URL Configured: ${info.url ? "Yes" : "NO (MISSING NEXT_PUBLIC_SUPABASE_URL)"}
Anon Key Configured: ${info.anonKey ? "Yes" : "NO (MISSING NEXT_PUBLIC_SUPABASE_ANON_KEY)"}
Client Instance Created: ${info.clientInitialized ? "Yes" : "No"}
URL Used (first 20 chars): ${info.url ? info.url.substring(0, 20) + "..." : "N/A"}`,
    )
  }

  const handleClearLogsAndRefresh = () => {
    clearActivityLogs()
    setLogs([])
    setSwapLogs([])
    setTransactionContextLogs([])
    setEncryptionTestResults(null)
    logActivity("Logs cleared and debug panel refreshed")
    refreshDebugInfo()
  }

  const copyDebugInfo = () => {
    if (!debugPanelRef.current) return

    try {
      const encryptionTestInfo = encryptionTestResults
        ? `
Encryption Test Results:
${JSON.stringify(encryptionTestResults, null, 2)}
`
        : ""

      const knownEncryptedValues = `
Known Encrypted Values Found:
Private Key: ${KNOWN_ENCRYPTED_VALUES.privateKey.substring(0, 50)}...
Mnemonic: ${KNOWN_ENCRYPTED_VALUES.mnemonic.substring(0, 50)}...
`

      const dbUserErrorForCopy = `
DB User Status:
Error: ${dbUserError || (dbUser ? "No error, DB User present." : "No DB User, no specific error reported in context.")}
DB User Object Present: ${!!dbUser}
`
      const telegramEnv = `
Telegram Environment:
Is Telegram Environment: ${isTelegramEnvironment ? "Yes" : "No"}
Is Ready: ${isReady ? "Yes" : "No"}
Is Authenticated: ${isAuthenticated ? "Yes" : "No"}
`

      const userInfo = `
User Info (TelegramContext):
User (TG Raw): ${user ? JSON.stringify(user, null, 2) : "No Telegram user data"}
DB User (Supabase): ${dbUser ? JSON.stringify(dbUser, null, 2) : "No DB user data"}
`
      const supabaseInfoForCopy = `
Supabase Client Initialization:
${supabaseInitInfo}
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
          platform: webApp.platform,
          initDataPreview: webApp.initData ? webApp.initData.substring(0, 50) + "..." : "N/A",
          initDataUnsafe: webApp.initDataUnsafe ? JSON.stringify(webApp.initDataUnsafe, null, 2) : "N/A",
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
Wallet Info (WalletContext):
Active Wallet: ${activeWallet ? JSON.stringify(activeWallet, null, 2) : "No active wallet"}
Total Wallets in State: ${wallets.length}
Tokens (first 5): ${tokens
        .slice(0, 5)
        .map((t) => `${t.symbol}: ${t.balance || "0"}`)
        .join(", ")}
`
      const balanceCheckInfo = `
Balance Check Stats:
Last Check: ${balanceCheckStats?.lastCheck ? new Date(balanceCheckStats.lastCheck).toISOString() : "Never"}
Total Checks: ${balanceCheckStats?.totalChecks || 0}
Successful: ${balanceCheckStats?.successfulChecks || 0}
Failed: ${balanceCheckStats?.failedChecks || 0}
Last Response: ${balanceCheckStats?.lastResponse || "N/A"}
Last Error: ${balanceCheckStats?.lastError || "None"}
`
      const transactionInfo = `
Transactions (last 3):
${
  transactions.length > 0
    ? `Count: ${transactions.length}
${transactions
  .slice(0, 3)
  .map(
    (tx) => `  - Type: ${tx.txType}, Amount: ${tx.amount} ${tx.tokenSymbol}, Status: ${tx.status}
Hash: ${tx.txHash}
Time: ${new Date(tx.timestamp).toISOString()}`,
  )
  .join("\n")}`
    : "No transactions"
}
`
      const swapDebugInfoText = `
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

Swap State (UIContext):
From Token: ${swapFromToken || "Not selected"}
To Token: ${swapToToken || "Not selected"}
From Amount: ${swapFromAmount || "0"}
Max Available: ${maxAmount || "0"}
Slippage Tolerance: ${slippageTolerance || "0.5"}%

Swap Transactions (last 3):
${
  transactions.filter((tx) => tx.txType === "swap").length > 0
    ? transactions
        .filter((tx) => tx.txType === "swap")
        .slice(0, 3)
        .map(
          (tx) =>
            `  - Hash: ${tx.txHash}
Status: ${tx.status}
Tokens: ${tx.tokenSymbol}
Amount: ${tx.amount}
Time: ${new Date(tx.timestamp).toISOString()}`,
        )
        .join("\n")
    : "No swap transactions found"
}

Swap Activity Logs (Last 10 from service):
${swapLogs
  .slice(0, 10)
  .map(
    (log) =>
      `  [${new Date(log.timestamp).toISOString()}] ${log.action}${
        log.data ? `\n    Data: ${JSON.stringify(log.data, null, 2)}` : ""
      }`,
  )
  .join("\n\n")}

Swap Configuration:
RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Uniswap Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D (Mainnet)
WETH Address: ${TOKEN_ADDRESSES.WETH}
Default Slippage: 0.5%
Swap Deadline: 20 minutes
`
      const telegramContextDebugText = `
Telegram Context Initialization Log (Last 10 lines from context):
${debugInfo.split("\n").slice(-10).join("\n") || "No Telegram Context debug info available."}
`
      const blockchainInfo = `
Blockchain Connection & Keys:
RPC Endpoint: ${process.env.NEXT_PUBLIC_RPC_ENDPOINT || "Not configured"}
Network: Ethereum Mainnet (Assumed)
(Encryption key statuses are not client-visible for security)
`
      const criticalTransactionContextText = `
CRITICAL TRANSACTION CONTEXT (Latest from service):
${
  transactionContextLogs.length > 0
    ? `  [${new Date(transactionContextLogs[0].timestamp).toISOString()}] ${transactionContextLogs[0].action}
Data: ${JSON.stringify(transactionContextLogs[0].data, null, 2)}`
    : "No transaction/swap initiation logs found yet."
}
`
      const localStorageInfo = `
Local Storage (Relevant Keys):
activeWalletId: ${typeof window !== "undefined" ? localStorage.getItem("activeWalletId") : "N/A"}
wallets (count): ${
        typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("wallets") || "[]") as any[]).length : "N/A"
      }
bypassAuth: ${typeof window !== "undefined" ? localStorage.getItem("bypassAuth") : "N/A"}
`
      const generalActivityLogText = `
General Activity Log (Last 10 entries from service):
${logs
  .slice(0, 50)
  .map(
    (log) =>
      `  [${new Date(log.timestamp).toISOString()}] ${log.level?.toUpperCase() || "INFO"}: ${log.action}${log.data ? ` - Data: ${JSON.stringify(log.data).substring(0, 150)}...` : ""}`,
  )
  .join("\n")}
`

      const allDebugInfo = `=== GaryAI Wallet Debug Info ===
Timestamp: ${new Date().toISOString()}
Active Tab (UIContext): ${activeTab}
${knownEncryptedValues}
${encryptionTestInfo}
${dbUserErrorForCopy} 
${supabaseInfoForCopy}
${criticalTransactionContextText}
${telegramEnv}
${userInfo}
${walletInfo}
${webAppInfo}
${windowInfo}
${userAgentInfo}
${balanceCheckInfo}
${transactionInfo}
${swapDebugInfoText}
${telegramContextDebugText}
${blockchainInfo}
${localStorageInfo}
${generalActivityLogText}
`

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(allDebugInfo)
          .then(() => {
            setIsCopied(true)
            logActivity("Full debug info copied to clipboard")
            showToast("Debug info copied to clipboard", "success")
            setTimeout(() => setIsCopied(false), 2000)
          })
          .catch((err) => {
            console.error("Clipboard API failed:", err)
            fallbackCopy(allDebugInfo)
          })
      } else {
        fallbackCopy(allDebugInfo)
      }
    } catch (error) {
      console.error("Failed to copy debug info:", error)
      logActivity("Failed to copy debug info: " + (error as Error).message)
      showToast("Failed to copy debug info", "error")
    }
  }

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand("copy")
      document.body.removeChild(textArea)

      if (successful) {
        setIsCopied(true)
        logActivity("Debug info copied using fallback method")
        showToast("Debug info copied (fallback)", "success")
        setTimeout(() => setIsCopied(false), 2000)
      } else {
        logActivity("Fallback copy failed")
        showToast("Fallback copy failed", "error")
      }
    } catch (err) {
      logActivity("All copy methods failed: " + (err as Error).message)
      showToast("All copy methods failed", "error")
    }
  }

  const toggleSwapDebug = () => {
    setShowSwapDebug(!showSwapDebug)
    logActivity(`${!showSwapDebug ? "Showing" : "Hiding"} swap debug information`)
  }

  const renderWalletInfo = () => {
    if (!activeWallet) {
      return <p className="text-gray-400">No active wallet</p>
    }
    const tokenBalances = tokens.map((token) => `${token.symbol}: ${token.balance || "0"}`).join(", ")
    const detailedTokenInfo = tokens.map((token) => (
      <div key={token.address} className="mb-2">
        <div>
          <strong>{token.symbol}</strong> ({token.name})
        </div>
        <div>Balance: {token.balance || "0"}</div>
        <div className="text-xs text-gray-500">Address: {token.address}</div>
      </div>
    ))
    return (
      <>
        <p>
          Active Wallet: {activeWallet.address} (ID: {activeWallet.id})
        </p>
        <p>Name: {activeWallet.name || "N/A"}</p>
        <p>Is Active: {activeWallet.isActive ? "Yes" : "No"}</p>
        <p>Encrypted PK available: {activeWallet.encrypted_private_key ? "Yes" : "No"}</p>
        <p>Encrypted Mnemonic available: {activeWallet.encrypted_mnemonic ? "Yes" : "No"}</p>
        <p>Tokens: {tokenBalances}</p>
        <div className="mt-3">
          <h4 className="text-sm font-bold mb-2">Detailed Token Balances:</h4>
          {detailedTokenInfo}
        </div>
      </>
    )
  }

  const forceRefreshAllTokens = async () => {
    try {
      logActivity("Forcing complete token refresh")
      localStorage.removeItem("cachedTokens")
      await refreshBalances()
      logActivity("Force refresh completed successfully")
      showToast("Forced token refresh complete", "success")
    } catch (error) {
      logActivity(`Force refresh failed: ${(error as Error).message}`)
      showToast("Force refresh failed", "error")
      console.error("Force refresh error:", error)
    }
  }

  const getStatusClass = (status: string) => {
    if (status === "confirmed") return "text-green-500"
    if (status === "pending") return "text-yellow-500"
    if (status === "failed") return "text-red-500"
    return ""
  }

  return (
    <div className="p-4 pb-24 space-y-4 text-xs" ref={debugPanelRef}>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Debug Information</h2>
        <div className="flex space-x-2">
          <button
            onClick={copyDebugInfo}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"
            aria-label="Copy debug info"
          >
            {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
          <button
            onClick={refreshDebugInfo}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"
            aria-label="Refresh debug info"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleClearLogsAndRefresh}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-medium"
          >
            Clear Logs & Refresh
          </button>
        </div>
      </div>

      {/* 🔑 ENCRYPTION TESTING SECTION - CLEAN VERSION */}
      <div className="bg-green-900 border border-green-600 p-3 rounded-lg shadow">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-green-200 flex items-center">
            <Key size={16} className="mr-2" />🔑 ENCRYPTION TESTING (Clean - No Client Crypto)
          </h3>
          <button
            onClick={() => setShowEncryptionTests(!showEncryptionTests)}
            className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded"
          >
            {showEncryptionTests ? "Hide Tests" : "Show Tests"}
          </button>
        </div>

        {showEncryptionTests && (
          <div className="space-y-3">
            <div className="bg-blue-900 p-2 rounded border border-blue-600">
              <h4 className="text-sm font-semibold mb-1 text-blue-200">🎯 Found Your Encrypted Keys!</h4>
              <div className="text-blue-100 text-xs space-y-1">
                <div>Private Key: {KNOWN_ENCRYPTED_VALUES.privateKey.substring(0, 40)}...</div>
                <div>Mnemonic: {KNOWN_ENCRYPTED_VALUES.mnemonic.substring(0, 40)}...</div>
                <div>Both start with "U2FsdGVkX1" ✅ (CryptoJS format)</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={testServerHealth}
                disabled={isTestingEncryption}
                className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-xs font-medium"
              >
                <TestTube size={12} className="mr-1" />
                {isTestingEncryption ? "Testing..." : "Server Health"}
              </button>
              <button
                onClick={testKnownPrivateKey}
                disabled={isTestingEncryption}
                className="flex items-center px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded text-xs font-medium"
              >
                <Zap size={12} className="mr-1" />
                Test Private Key
              </button>
              <button
                onClick={testKnownMnemonic}
                disabled={isTestingEncryption}
                className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-xs font-medium"
              >
                <Key size={12} className="mr-1" />
                Test Mnemonic
              </button>
              <button
                onClick={testSimpleEncryptDecrypt}
                disabled={isTestingEncryption}
                className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-xs font-medium"
              >
                <RefreshCw size={12} className="mr-1" />
                Test Encrypt/Decrypt
              </button>
            </div>

            {encryptionTestResults && (
              <div className="bg-gray-900 p-3 rounded border">
                <h4 className="text-sm font-semibold mb-2 text-yellow-300">Latest Test Results:</h4>
                <pre className="whitespace-pre-wrap overflow-auto max-h-64 text-gray-300 text-xs">
                  {JSON.stringify(encryptionTestResults, null, 2)}
                </pre>
              </div>
            )}

            <div className="bg-yellow-900 p-2 rounded border border-yellow-600">
              <h4 className="text-xs font-semibold mb-1 text-yellow-200">🎯 NEXT STEPS:</h4>
              <div className="text-yellow-100 text-xs space-y-1">
                <div>1. Click "Server Health" to verify the API is working</div>
                <div>2. Click "Test Private Key" to decrypt your actual private key</div>
                <div>3. If successful, try a transaction!</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DB User Error Display */}
      {(dbUserError || !dbUser) && (
        <div className={`p-3 rounded-lg shadow ${dbUserError ? "bg-red-800" : "bg-yellow-700"}`}>
          <h3 className="font-semibold mb-1 text-white flex items-center">
            <AlertTriangle size={16} className="mr-2 text-yellow-300" />
            {dbUserError ? "CRITICAL DB User Error" : "Warning: DB User Not Loaded"}
          </h3>
          <pre className="whitespace-pre-wrap overflow-auto max-h-48 bg-gray-900 p-2 rounded text-gray-300">
            {dbUserError ||
              "DB User object is not available. User-specific database operations (like saving transactions) will fail. Please check Supabase connection, CORS settings, and environment variables."}
          </pre>
        </div>
      )}

      {/* Supabase Client Initialization Info */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1 text-sky-400">Supabase Client Initialization</h3>
        <pre className="whitespace-pre-wrap overflow-auto max-h-48 bg-gray-900 p-2 rounded text-gray-300">
          {supabaseInitInfo}
        </pre>
      </div>

      {/* CRITICAL TRANSACTION CONTEXT */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1 text-yellow-400">Critical Transaction/Swap Context (Latest)</h3>
        <pre className="whitespace-pre-wrap overflow-auto max-h-48 bg-gray-900 p-2 rounded text-gray-300">
          {transactionContextLogs.length > 0
            ? `[${new Date(transactionContextLogs[0].timestamp).toISOString()}] ${
                transactionContextLogs[0].action
              }\nData: ${JSON.stringify(transactionContextLogs[0].data, null, 2)}`
            : "No transaction/swap initiation logs captured yet. Try an action."}
        </pre>
      </div>

      {/* Telegram Environment */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1">Telegram Environment & User</h3>
        <pre className="whitespace-pre-wrap overflow-auto max-h-60 bg-gray-900 p-2 rounded text-gray-300">
          {`Is Telegram Env: ${isTelegramEnvironment} | Ready: ${isReady} | Authenticated: ${isAuthenticated}
User (TG): ${user ? `${user.id} - ${user.first_name}` : "N/A"}
DB User (Supabase): ${dbUser ? `${dbUser.id} - ${dbUser.first_name} (TG ID: ${dbUser.telegram_id})` : "N/A"}
WebApp Platform: ${webApp?.platform || "N/A"}
WebApp Version: ${webApp?.version || "N/A"}
User Agent: ${userAgent.substring(0, 70)}...`}
        </pre>
      </div>

      {/* Wallet Info */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1">Wallet Info (WalletContext)</h3>
        <div className="whitespace-pre-wrap overflow-auto max-h-72 bg-gray-900 p-2 rounded text-gray-300">
          {renderWalletInfo()}
        </div>
      </div>

      {/* Balance Check Stats */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold">Balance Check Stats</h3>
          <div className="flex space-x-2">
            <button
              onClick={refreshBalances}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs flex items-center"
            >
              <RefreshCw size={12} className="mr-1" /> Refresh
            </button>
            <button
              onClick={forceRefreshAllTokens}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded text-xs flex items-center"
            >
              Force Refresh All
            </button>
          </div>
        </div>
        <pre className="whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded text-gray-300">
          {`Last Check: ${
            balanceCheckStats?.lastCheck ? new Date(balanceCheckStats.lastCheck).toLocaleTimeString() : "Never"
          }
Total: ${balanceCheckStats?.totalChecks || 0} | Success: ${
            balanceCheckStats?.successfulChecks || 0
          } | Failed: ${balanceCheckStats?.failedChecks || 0}
Last Response: ${balanceCheckStats?.lastResponse || "N/A"}
Last Error: ${balanceCheckStats?.lastError || "None"}`}
        </pre>
      </div>

      {/* Swap Debug Information */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold">Swap Debug Information</h3>
          <button onClick={toggleSwapDebug} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
            {showSwapDebug ? "Hide Details" : "Show Details"}
          </button>
        </div>
        {showSwapDebug ? (
          <div className="space-y-2 text-gray-300">
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1 text-gray-200">Current Swap Quote:</h4>
              <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                {swapQuote ? JSON.stringify(swapQuote, null, 2) : "No active swap quote"}
              </pre>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1 text-gray-200">Swap State (UIContext):</h4>
              <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                {JSON.stringify(
                  {
                    fromToken: swapFromToken || "Not selected",
                    toToken: swapToToken || "Not selected",
                    fromAmount: swapFromAmount || "0",
                    maxAvailable: maxAmount || "0",
                    slippageTolerance: slippageTolerance || "0.5",
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1 text-gray-200">Swap-Related Transactions (Last 5):</h4>
              {transactions.filter((tx) => tx.txType === "swap").length > 0 ? (
                <div className="space-y-1">
                  {transactions
                    .filter((tx) => tx.txType === "swap")
                    .slice(0, 5)
                    .map((tx) => (
                      <div key={tx.id} className="p-1 border-b border-gray-700">
                        <div className="flex justify-between">
                          <span>Hash:</span>
                          <span className="truncate max-w-[150px]">{tx.txHash}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span> <span className={getStatusClass(tx.status)}>{tx.status}</span>
                        </div>
                        <span>
                          {tx.tokenSymbol} | {tx.amount} | {new Date(tx.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-gray-400">No swap transactions found</div>
              )}
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <h4 className="text-xs font-semibold mb-1 text-gray-200">Swap Activity Logs (Last 10 from service):</h4>
              <div className="max-h-40 overflow-auto">
                {swapLogs.length > 0 ? (
                  swapLogs.slice(0, 10).map((log, index) => (
                    <div key={index} className="p-1 border-b border-gray-700">
                      <div className="font-semibold">
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.action}
                      </div>
                      {log.data && (
                        <div className="pl-2 text-gray-500 overflow-auto max-h-20">
                          <pre>{JSON.stringify(log.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400">No swap logs found</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded text-gray-300">
            {swapQuote
              ? `Active Quote: ${swapQuote.fromToken.amount} → ${swapQuote.toToken.amount} | Rate: 1 = ${swapQuote.executionPrice}`
              : "No active swap quote"}
            {transactions.filter((tx) => tx.txType === "swap").length > 0
              ? `\nSwap Txs: ${transactions.filter((tx) => tx.txType === "swap").length}, Latest: ${
                  transactions.filter((tx) => tx.txType === "swap")[0]?.status || "N/A"
                }`
              : "\nNo swap transactions"}
          </pre>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold">Transactions (Last 5)</h3>
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
          >
            {showTransactions ? "Hide Details" : "Show Details"}
          </button>
        </div>
        {showTransactions ? (
          <div className="text-gray-300">
            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="bg-gray-900 p-2 rounded">
                    <div className="flex justify-between">
                      <span>Type: {tx.txType}</span> <span className={getStatusClass(tx.status)}>{tx.status}</span>
                    </div>
                    <div>
                      Hash: <span className="truncate block max-w-[200px] sm:max-w-full">{tx.txHash}</span>
                    </div>
                    <div>
                      Amount: {tx.amount} {tx.tokenSymbol}
                    </div>
                    <div>Time: {new Date(tx.timestamp).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-gray-400">No transactions</div>
            )}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap overflow-auto max-h-32 bg-gray-900 p-2 rounded text-gray-300">
            {transactions.length > 0
              ? `Count: ${transactions.length}
Latest: ${transactions[0]?.txHash.substring(0, 15) || "None"}... (${transactions[0]?.status || "N/A"})`
              : "No transactions"}
          </pre>
        )}
      </div>

      {/* Telegram Context Init Log */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1">Telegram Context Init Log (Last 10 lines from context)</h3>
        <pre className="whitespace-pre-wrap overflow-auto max-h-40 bg-gray-900 p-2 rounded text-gray-300">
          {debugInfo.split("\n").slice(-10).join("\n") || "No Telegram Context debug info."}
        </pre>
      </div>

      {/* General Activity Log */}
      <div className="bg-gray-800 p-3 rounded-lg shadow">
        <h3 className="font-semibold mb-1">General Activity Log (Last 20 entries from service)</h3>
        <pre className="whitespace-pre-wrap overflow-auto max-h-64 bg-gray-900 p-2 rounded text-gray-300">
          {logs.length > 0
            ? logs
                .slice(0, 50)
                .map(
                  (log) =>
                    `[${new Date(log.timestamp).toISOString()}] ${log.level?.toUpperCase() || "INFO"}: ${log.action}${log.data ? ` - Data: ${JSON.stringify(log.data).substring(0, 150)}...` : ""}`,
                )
                .join("\n")
            : "No activity logged."}
        </pre>
      </div>
    </div>
  )
}
