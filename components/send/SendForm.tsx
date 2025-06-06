"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useUI } from "@/contexts/UIContext"
import { Loader2, Send, ArrowRight, AlertCircle, CheckCircle, ExternalLink } from "lucide-react"

interface SendFormProps {
  preselectedToken?: string
}

export default function SendForm({ preselectedToken }: SendFormProps) {
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState(preselectedToken || "")
  const [step, setStep] = useState<"form" | "confirm" | "result">("form")
  const [txHash, setTxHash] = useState("")
  const [error, setError] = useState("")
  const [maxAmount, setMaxAmount] = useState("0")

  const { tokens, sendTransaction, isLoading, activeWallet } = useWallet()
  const { showToast, closeBottomSheet, logActivity } = useUI()

  // Set the selected token when preselectedToken changes
  useEffect(() => {
    if (preselectedToken) {
      setSelectedToken(preselectedToken)

      // Find the token to get its balance
      const token = tokens.find((t) => t.address.toLowerCase() === preselectedToken.toLowerCase())
      if (token && token.balance) {
        setMaxAmount(token.balance)
      }
    }
  }, [preselectedToken, tokens])

  // Update max amount when selected token changes
  useEffect(() => {
    if (selectedToken) {
      const token = tokens.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase())
      if (token && token.balance) {
        setMaxAmount(token.balance)
      }
    }
  }, [selectedToken, tokens])

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tokenAddress = e.target.value
    setSelectedToken(tokenAddress)

    // Find the token to get its balance
    const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())
    if (token && token.balance) {
      setMaxAmount(token.balance)
    } else {
      setMaxAmount("0")
    }
  }

  const handleSetMaxAmount = () => {
    setAmount(maxAmount)
  }

  const validateForm = () => {
    if (!recipient) {
      showToast("Please enter a recipient address", "error")
      return false
    }

    if (!recipient.startsWith("0x") || recipient.length !== 42) {
      showToast("Please enter a valid Ethereum address", "error")
      return false
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      showToast("Please enter a valid amount", "error")
      return false
    }

    if (!selectedToken) {
      showToast("Please select a token", "error")
      return false
    }

    if (Number.parseFloat(amount) > Number.parseFloat(maxAmount)) {
      showToast("Amount exceeds your balance", "error")
      return false
    }

    return true
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setStep("confirm")
    logActivity(`Prepared to send ${amount} of token ${selectedToken} to ${recipient}`)
  }

  const handleConfirm = async () => {
    try {
      setError("")
      logActivity(`Confirming transaction: ${amount} of token ${selectedToken} to ${recipient}`)

      const hash = await sendTransaction(recipient, amount, selectedToken)
      setTxHash(hash)
      setStep("result")
      logActivity(`Transaction sent successfully: ${hash}`)

      // Reset form for next use
      setRecipient("")
      setAmount("")
      setSelectedToken(preselectedToken || "")
    } catch (err: any) {
      console.error("Transaction error:", err)
      setError(err.message || "Transaction failed")
      logActivity(`Transaction failed: ${err.message}`)
    }
  }

  const handleBack = () => {
    if (step === "confirm") {
      setStep("form")
    } else if (step === "result") {
      // Close the bottom sheet if we're done
      closeBottomSheet()
    }
  }

  const handleClose = () => {
    closeBottomSheet()
  }

  // Get the selected token details
  const selectedTokenDetails = tokens.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase())

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-semibold mb-4">Send Tokens</h2>

      {step === "form" && (
        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium mb-1">
              Recipient Address
            </label>
            <input
              id="recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="tg-input"
              style={{
                userSelect: "text",
                WebkitUserSelect: "text",
              }}
              required
            />
          </div>

          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-1">
              Token
            </label>
            <select
              id="token"
              value={selectedToken}
              onChange={handleTokenChange}
              className="tg-input"
              required
              disabled={!!preselectedToken}
            >
              <option value="">Select Token</option>
              {tokens
                .filter((token) => token.balance && Number.parseFloat(token.balance) > 0)
                .map((token) => (
                  <option key={token.id} value={token.address}>
                    {token.symbol} - Balance: {token.balance || "0"}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="amount" className="block text-sm font-medium">
                Amount
              </label>
              <button type="button" onClick={handleSetMaxAmount} className="text-xs text-gary-accent">
                MAX
              </button>
            </div>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="0.000001"
              min="0"
              max={maxAmount}
              className="tg-input"
              style={{
                userSelect: "text",
                WebkitUserSelect: "text",
              }}
              required
            />
            <div className="text-xs text-gary-text-secondary mt-1">
              Available: {maxAmount} {selectedTokenDetails?.symbol || ""}
            </div>
          </div>

          <button type="submit" className="gary-button w-full" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 size={16} className="animate-spin mr-2" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                Continue
                <ArrowRight size={16} className="ml-2" />
              </span>
            )}
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <div className="tg-card">
            <h3 className="text-lg font-medium mb-4">Confirm Transaction</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gary-text-secondary">From:</span>
                <span className="text-sm truncate max-w-[200px]">{activeWallet?.address}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">To:</span>
                <span className="text-sm truncate max-w-[200px]">{recipient}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Amount:</span>
                <span className="font-medium">
                  {amount} {selectedTokenDetails?.symbol}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Network:</span>
                <span>Ethereum Mainnet</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Estimated Fee:</span>
                <span>~0.001 ETH</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={handleBack} className="gary-button-outline flex-1">
              Back
            </button>
            <button onClick={handleConfirm} className="gary-button flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Send size={16} className="mr-2" />
                  Send
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="space-y-4">
          {error ? (
            <div className="text-center">
              <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Transaction Failed</h3>
              <p className="text-gary-text-secondary mb-4">{error}</p>
              <button onClick={handleBack} className="gary-button w-full">
                Try Again
              </button>
            </div>
          ) : (
            <div className="text-center">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Transaction Sent</h3>
              <p className="text-gary-text-secondary mb-4">Your transaction has been submitted to the network</p>

              <div className="tg-card mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gary-text-secondary">Transaction Hash:</span>
                </div>
                <p className="text-sm break-all">{txHash}</p>
                <div className="mt-3">
                  <a
                    href={`https://etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tg-link flex items-center justify-center"
                  >
                    View on Etherscan
                    <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
              </div>

              <button onClick={handleClose} className="gary-button w-full">
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
