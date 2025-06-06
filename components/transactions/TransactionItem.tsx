"use client"

import { ArrowUpRight, ArrowDownLeft, RefreshCw, Check, X, ExternalLink } from "lucide-react"

interface TransactionItemProps {
  transaction: {
    id: string
    txHash: string
    txType: "send" | "receive" | "swap"
    status: "pending" | "confirmed" | "failed"
    fromAddress: string
    toAddress: string
    amount: string
    tokenSymbol?: string
    fee?: string
    timestamp: Date
  }
}

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const getStatusIcon = () => {
    switch (transaction.status) {
      case "pending":
        return <RefreshCw size={16} className="text-yellow-500" />
      case "confirmed":
        return <Check size={16} className="text-green-500" />
      case "failed":
        return <X size={16} className="text-red-500" />
    }
  }

  const getTypeIcon = () => {
    switch (transaction.txType) {
      case "send":
        return <ArrowUpRight size={20} className="text-red-400" />
      case "receive":
        return <ArrowDownLeft size={20} className="text-green-400" />
      case "swap":
        return <RefreshCw size={20} className="text-blue-400" />
    }
  }

  return (
    <div className="tg-card">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mr-3">{getTypeIcon()}</div>

        <div className="flex-1">
          <div className="flex justify-between">
            <span className="font-medium capitalize">{transaction.txType}</span>
            <div className="flex items-center">
              <span
                className={`font-semibold ${
                  transaction.txType === "send"
                    ? "text-red-400"
                    : transaction.txType === "receive"
                      ? "text-green-400"
                      : ""
                }`}
              >
                {transaction.txType === "send" ? "-" : transaction.txType === "receive" ? "+" : ""}
                {transaction.amount} {transaction.tokenSymbol}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-sm text-[var(--telegram-hint)]">
            <span>{formatDate(transaction.timestamp)}</span>
            <div className="flex items-center">
              {getStatusIcon()}
              <span className="ml-1">{transaction.status}</span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-[var(--telegram-hint)]">
            <div className="flex justify-between mb-1">
              <span>From:</span>
              <span>{formatAddress(transaction.fromAddress)}</span>
            </div>
            <div className="flex justify-between">
              <span>To:</span>
              <span>{formatAddress(transaction.toAddress)}</span>
            </div>
            {transaction.fee && (
              <div className="flex justify-between mt-1">
                <span>Fee:</span>
                <span>{transaction.fee} ETH</span>
              </div>
            )}
          </div>

          <div className="mt-2 text-xs">
            <a
              href={`https://etherscan.io/tx/${transaction.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tg-link flex items-center justify-center"
            >
              View on Etherscan
              <ExternalLink size={12} className="ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
