"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useWallet } from "@/contexts/WalletContext"
import {
  Copy,
  RefreshCw,
  ExternalLink,
  QrCode,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Loader2,
} from "lucide-react"
import TokenBalance from "./TokenBalance"
import { useUI } from "@/contexts/UIContext"
import QRCode from "./QRCode"

export default function WalletPanel() {
  const { activeWallet, tokens, refreshBalances, isLoading, createNewWallet, importWallet, error } = useWallet()
  const { showToast, logActivity } = useUI()
  const [showQR, setShowQR] = useState(false)
  const [showAllTokens, setShowAllTokens] = useState(false) // Default to collapsed
  const [isCreating, setIsCreating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importType, setImportType] = useState<"privateKey" | "mnemonic">("privateKey")
  const [privateKeyOrMnemonic, setPrivateKeyOrMnemonic] = useState("")
  const [showImportForm, setShowImportForm] = useState(false)

  // Use localStorage to persist auto-refresh setting
  const [autoRefresh, setAutoRefresh] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("autoRefreshEnabled")
      return saved === "true"
    }
    return false
  })

  // Save auto-refresh setting to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("autoRefreshEnabled", autoRefresh.toString())
    }
  }, [autoRefresh])

  // Initial load of balances
  useEffect(() => {
    if (activeWallet) {
      refreshBalances()
      logActivity("Wallet balances refreshed on mount")
    }
  }, [activeWallet, refreshBalances, logActivity])

  // Auto refresh balances every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (autoRefresh && activeWallet) {
      // Immediate refresh when auto is enabled
      console.log("[WalletPanel] Auto-refresh active, triggering immediate refresh")
      refreshBalances()
      logActivity("Auto-refresh enabled, refreshing immediately")

      interval = setInterval(() => {
        console.log("[WalletPanel] Auto-refresh interval triggered")
        refreshBalances()
        logActivity("Auto-refreshed wallet balances")
      }, 30000) // 30 seconds
    }

    return () => {
      if (interval) {
        console.log("[WalletPanel] Clearing auto-refresh interval")
        clearInterval(interval)
      }
    }
  }, [autoRefresh, activeWallet, refreshBalances, logActivity])

  const handleCopyAddress = () => {
    if (activeWallet) {
      navigator.clipboard.writeText(activeWallet.address)
      showToast("Address copied to clipboard", "success")
      logActivity("Wallet address copied to clipboard")
    }
  }

  const handleRefresh = () => {
    console.log("[WalletPanel] Manual refresh triggered")
    refreshBalances()
    showToast("Refreshing balances...", "info")
    logActivity("Manual refresh of wallet balances triggered")
  }

  const toggleAutoRefresh = () => {
    const newAutoRefreshState = !autoRefresh
    setAutoRefresh(newAutoRefreshState)
    logActivity(`Auto-refresh ${newAutoRefreshState ? "enabled" : "disabled"}`)
    showToast(`Auto-refresh ${newAutoRefreshState ? "enabled" : "disabled"}`, "info")
    console.log(`[WalletPanel] Auto-refresh ${newAutoRefreshState ? "enabled" : "disabled"}`)

    // Trigger an immediate refresh when enabling
    if (newAutoRefreshState) {
      console.log("[WalletPanel] Auto-refresh enabled, triggering immediate refresh")
      refreshBalances()
    }
  }

  const toggleQRCode = () => {
    setShowQR(!showQR)
    logActivity(`QR code view ${!showQR ? "opened" : "closed"}`)
  }

  const toggleAllTokens = () => {
    setShowAllTokens(!showAllTokens)
    logActivity(`${!showAllTokens ? "Showing" : "Hiding"} all available tokens`)
  }

  const openEtherscan = () => {
    if (activeWallet) {
      window.open(`https://etherscan.io/address/${activeWallet.address}`, "_blank")
      logActivity("Opened wallet on Etherscan")
    }
  }

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true)
      logActivity("Creating new wallet")
      await createNewWallet()
      showToast("Wallet created successfully", "success")
      logActivity("Wallet created successfully")
    } catch (err) {
      console.error("Error creating wallet:", err)
      showToast(error || "Failed to create wallet", "error")
      logActivity(`Failed to create wallet: ${error}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!privateKeyOrMnemonic) {
      showToast("Please enter a private key or mnemonic phrase", "error")
      return
    }

    try {
      setIsImporting(true)
      logActivity(`Importing wallet using ${importType}`)
      await importWallet(privateKeyOrMnemonic)
      showToast("Wallet imported successfully", "success")
      logActivity("Wallet imported successfully")
      setPrivateKeyOrMnemonic("")
      setShowImportForm(false)
    } catch (err: any) {
      console.error("Error importing wallet:", err)
      showToast(err.message || "Failed to import wallet", "error")
      logActivity(`Failed to import wallet: ${err.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  // Check if we have a wallet in localStorage but it's not loaded in state
  useEffect(() => {
    if (!activeWallet) {
      const savedWallets = localStorage.getItem("wallets")
      if (savedWallets) {
        console.log("Found wallets in localStorage but not in state, refreshing page")
        // Force a page refresh to reload the wallet state
        window.location.reload()
      }
    }
  }, [activeWallet])

  if (!activeWallet) {
    return (
      <div className="p-4 pb-20">
        <div className="flex items-center justify-center mb-6">
          <h1 className="text-2xl font-light text-gary-text">Wallet Setup</h1>
        </div>

        <p className="text-gary-text mb-6 text-center">You don't have an active wallet yet.</p>

        {!showImportForm ? (
          <div className="flex flex-col space-y-4 max-w-xs mx-auto">
            <button
              onClick={handleCreateWallet}
              disabled={isCreating}
              className="gary-button flex items-center justify-center"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Create New Wallet
                </>
              )}
            </button>

            <button
              onClick={() => setShowImportForm(true)}
              className="gary-button-outline flex items-center justify-center"
            >
              <Download size={16} className="mr-2" />
              Import Wallet
            </button>
          </div>
        ) : (
          <div className="gary-card max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">Import Wallet</h2>

            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg ${
                  importType === "privateKey" ? "bg-gary-accent text-white" : "bg-gray-700 text-gary-text-secondary"
                }`}
                onClick={() => setImportType("privateKey")}
              >
                Private Key
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg ${
                  importType === "mnemonic" ? "bg-gary-accent text-white" : "bg-gray-700 text-gary-text-secondary"
                }`}
                onClick={() => setImportType("mnemonic")}
              >
                Mnemonic
              </button>
            </div>

            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label htmlFor="privateKeyOrMnemonic" className="block text-sm font-medium mb-1">
                  {importType === "privateKey" ? "Private Key" : "Mnemonic Phrase"}
                </label>
                <textarea
                  id="privateKeyOrMnemonic"
                  value={privateKeyOrMnemonic}
                  onChange={(e) => setPrivateKeyOrMnemonic(e.target.value)}
                  placeholder={
                    importType === "privateKey"
                      ? "Enter your private key (0x...)"
                      : "Enter your 12 or 24 word mnemonic phrase"
                  }
                  className="tg-input h-24"
                  style={{
                    userSelect: "text",
                    WebkitUserSelect: "text",
                  }}
                  required
                />
              </div>

              <div className="text-sm text-gary-text-secondary mb-4">
                {importType === "privateKey" ? (
                  <p>Enter your Ethereum private key starting with 0x</p>
                ) : (
                  <p>Enter your recovery phrase with words separated by spaces</p>
                )}
              </div>

              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowImportForm(false)} className="gary-button-outline flex-1">
                  Cancel
                </button>
                <button type="submit" className="gary-button flex-1" disabled={isImporting}>
                  {isImporting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Importing...
                    </span>
                  ) : (
                    "Import Wallet"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  // Filter tokens to only show those with balances
  const tokensWithBalance = tokens.filter((token) => token.balance && Number.parseFloat(token.balance) > 0)

  // Other tokens (with zero balance)
  const otherTokens = tokens.filter((token) => !token.balance || Number.parseFloat(token.balance) === 0)

  return (
    <div className="p-4 pb-24">
      <div className="tg-card mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Wallet Address</h2>
          <div className="flex space-x-2">
            {showQR ? (
              <button
                onClick={toggleQRCode}
                className="p-2 rounded-full hover:bg-gray-700 flex items-center text-gary-accent"
                aria-label="Back to address view"
              >
                <ArrowLeft size={16} />
                <span className="ml-1 text-xs">Back</span>
              </button>
            ) : (
              <button
                onClick={toggleQRCode}
                className="p-2 rounded-full hover:bg-gray-700 flex items-center"
                aria-label="Show QR code"
              >
                <QrCode size={16} />
              </button>
            )}
            <button
              onClick={handleCopyAddress}
              className="p-2 rounded-full hover:bg-gray-700 flex items-center"
              aria-label="Copy address"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={openEtherscan}
              className="p-2 rounded-full hover:bg-gray-700"
              aria-label="View on Etherscan"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {showQR ? (
          <div className="mt-4">
            <QRCode value={activeWallet.address} size={200} />
            <p className="text-center mt-2 text-sm text-gary-text-secondary">Scan to send tokens to this wallet</p>
            <button
              onClick={handleCopyAddress}
              className="w-full mt-3 py-2 flex items-center justify-center gary-button-outline"
            >
              <Copy size={14} className="mr-2" />
              Copy Wallet Address
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gary-text-secondary break-all mb-2">{activeWallet.address}</p>
            <button
              onClick={handleCopyAddress}
              className="w-full py-2 flex items-center justify-center gary-button-outline"
            >
              <Copy size={14} className="mr-2" />
              Copy Wallet Address
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Tokens</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleAutoRefresh}
            className={`text-xs px-2 py-1 rounded ${
              autoRefresh ? "bg-gary-accent text-white" : "bg-gray-700 text-gary-text-secondary"
            }`}
          >
            Auto
          </button>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-full hover:bg-gray-700 ${isLoading ? "animate-spin" : ""}`}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gary-accent"></div>
        </div>
      )}

      {/* Tokens with balance */}
      {tokensWithBalance.length > 0 ? (
        <div className="space-y-2 mb-4">
          {tokensWithBalance.map((token) => (
            <TokenBalance key={token.id} token={token} />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gary-text-secondary">
          {isLoading ? "Loading balances..." : "No tokens with balance found"}
        </div>
      )}

      {/* All tokens section - collapsible */}
      <div className="mb-24">
        <div className="flex justify-between items-center mb-3 cursor-pointer" onClick={toggleAllTokens}>
          <h3 className="text-md font-medium">All Available Tokens</h3>
          <button className="p-1 rounded-full hover:bg-gray-700 text-gary-text-secondary">
            {showAllTokens ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showAllTokens && (
          <div className="space-y-2">
            {otherTokens.length > 0 ? (
              otherTokens.map((token) => <TokenBalance key={token.id} token={token} />)
            ) : (
              <div className="text-center py-2 text-gary-text-secondary">No other tokens available</div>
            )}
          </div>
        )}
      </div>
      {/* Add padding at the bottom to ensure content doesn't get hidden behind the navigation bar */}
      <div className="h-20"></div>
    </div>
  )
}
