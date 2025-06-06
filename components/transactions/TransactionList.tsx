"use client"

import { useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import TransactionItem from "./TransactionItem"

export default function TransactionList() {
  const { transactions, getTransactionHistory, isLoading } = useWallet()

  useEffect(() => {
    getTransactionHistory()
  }, [getTransactionHistory])

  if (isLoading) {
    return (
      <div className="p-4 pb-24 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--telegram-link)] mx-auto"></div>
        <p className="mt-2 text-[var(--telegram-hint)]">Loading transactions...</p>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="p-4 pb-24 text-center">
        <p className="text-[var(--telegram-hint)]">No transactions found</p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
      <div className="space-y-3">
        {transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </div>
  )
}
