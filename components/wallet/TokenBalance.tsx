"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { Send, RefreshCw, ExternalLink } from "lucide-react"
import { useUI } from "@/contexts/UIContext"
import { useWallet } from "@/contexts/WalletContext"
import SendForm from "@/components/send/SendForm"

interface TokenBalanceProps {
  token: {
    id: string
    address: string
    symbol: string
    name: string
    decimals: number
    balance?: string
    logoUrl?: string
    isNative: boolean
  }
}

export default function TokenBalance({ token }: TokenBalanceProps) {
  const [expanded, setExpanded] = useState(false)
  const { openBottomSheet, logActivity } = useUI()
  const { getBalance, refreshBalances } = useWallet()
  const [imageError, setImageError] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const toggleExpand = () => {
    setExpanded(!expanded)
  }

  const handleRefreshBalance = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRefreshing(true)

    try {
      // First try to get the specific token balance
      await getBalance(token.address)

      // Then refresh all balances to ensure consistency
      await refreshBalances()

      logActivity(`Refreshed balance for ${token.symbol}`)
    } catch (error) {
      console.error(`Error refreshing ${token.symbol} balance:`, error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation()
    openBottomSheet(<SendForm preselectedToken={token.address} />)
    logActivity(`Opened send form for ${token.symbol}`)
  }

  const openTokenOnEtherscan = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (token.isNative) {
      window.open("https://etherscan.io/", "_blank")
    } else {
      window.open(`https://etherscan.io/token/${token.address}`, "_blank")
    }
    logActivity(`Opened ${token.symbol} on Etherscan`)
  }

  // Format balance with commas and show up to 8 decimal places for small amounts
  const formattedBalance = token.balance ? formatTokenBalance(token.balance, token.symbol) : "0"

  // Calculate USD value (in a real app, this would use price feeds)
  const usdValue = token.balance
    ? (
        Number.parseFloat(token.balance) *
        (token.symbol === "ETH" ? 2000 : token.symbol === "USDT" || token.symbol === "USDC" ? 1 : 0)
      ).toFixed(2)
    : "0.00"

  // Get token color based on symbol
  const getTokenColor = (symbol: string) => {
    const colors: Record<string, string> = {
      ETH: "#627EEA",
      USDT: "#26A17B",
      USDC: "#2775CA",
      DAI: "#F5AC37",
      WBTC: "#F7931A",
    }
    return colors[symbol] || "#4CAF50" // Default to gary-accent if no color found
  }

  return (
    <div className={`tg-card transition-all duration-200 ${expanded ? "p-4" : "p-3"}`} onClick={toggleExpand}>
      <div className="flex items-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
          style={{ backgroundColor: `${getTokenColor(token.symbol)}20` }} // 20 is for 12% opacity
        >
          {token.logoUrl && !imageError ? (
            <Image
              src={token.logoUrl || "/placeholder.svg"}
              alt={token.symbol}
              width={32}
              height={32}
              className="rounded-full"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: getTokenColor(token.symbol) }}
            >
              {token.symbol.substring(0, 3)}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex justify-between">
            <span className="font-medium">{token.name}</span>
            <span className="font-semibold">{formattedBalance}</span>
          </div>
          <div className="flex justify-between text-sm text-gary-text-secondary">
            <span>{token.symbol}</span>
            <span>≈ ${usdValue}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-3 border-t border-gary-border">
          <div className="flex justify-between text-xs text-gary-text-secondary mb-3">
            <span>Token Address:</span>
            <span className="truncate max-w-[180px]">{token.isNative ? "Native ETH" : token.address}</span>
          </div>

          <div className="flex space-x-2 justify-end">
            <button
              onClick={handleRefreshBalance}
              className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={openTokenOnEtherscan} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600">
              <ExternalLink size={16} />
            </button>
            <button onClick={handleSend} className="p-2 bg-gary-accent rounded-full hover:bg-opacity-80">
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Update the formatTokenBalance function to better handle different token formats
function formatTokenBalance(balance: string, symbol: string): string {
  const numBalance = Number.parseFloat(balance)

  // For very small amounts (less than 0.00001), show scientific notation
  if (numBalance < 0.00001 && numBalance > 0) {
    return numBalance.toExponential(4)
  }

  // For USDC and USDT (stablecoins), show 2 decimal places
  if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI") {
    return numBalance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // For small amounts (less than 0.1), show up to 8 decimal places
  if (numBalance < 0.1 && numBalance > 0) {
    return numBalance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    })
  }

  // For regular amounts, show up to 6 decimal places
  return numBalance.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  })
}
