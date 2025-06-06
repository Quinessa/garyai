"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useUI } from "@/contexts/UIContext"
import { ArrowDown, Loader2, RefreshCw, AlertCircle, CheckCircle, ExternalLink } from "lucide-react"
// Remove executeSwap from the import, keep TOKEN_ADDRESSES
import { validateSwapRequest, TOKEN_ADDRESSES } from "@/lib/services/swap-service"
import { COMMON_TOKENS } from "@/lib/services/blockchain-provider"

export default function SwapForm() {
  const {
    tokens,
    refreshBalances,
    swapFromToken,
    swapToToken,
    swapFromAmount,
    setSwapFromToken,
    setSwapToToken,
    setSwapFromAmount,
    // Import executeSwap from the context instead
    executeSwap,
    getSwapQuote,
  } = useWallet()

  const { showToast, closeBottomSheet, logActivity } = useUI()

  const [toAmount, setToAmount] = useState("")
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [step, setStep] = useState<"form" | "confirm" | "result">("form")
  const [txHash, setTxHash] = useState("")
  const [error, setError] = useState("")
  const [maxAmount, setMaxAmount] = useState("0")
  const [isLoading, setIsLoading] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const [availableTokens, setAvailableTokens] = useState<any[]>([])

  // Initialize available tokens
  useEffect(() => {
    // Make sure we always have common tokens available for swapping
    const commonTokenSymbols = COMMON_TOKENS.map((t) => t.symbol)

    // Combine tokens from wallet with common tokens
    const combined = [...tokens]

    // Add any missing common tokens
    COMMON_TOKENS.forEach((commonToken) => {
      const exists = combined.some(
        (t) => t.symbol === commonToken.symbol || t.address.toLowerCase() === commonToken.address.toLowerCase(),
      )

      if (!exists) {
        combined.push({
          ...commonToken,
          id: commonToken.address.toLowerCase(),
          balance: "0",
        })
      }
    })

    setAvailableTokens(combined)
    logActivity("Available tokens for swap updated", {
      count: combined.length,
      symbols: combined.map((t) => t.symbol),
    })
  }, [tokens])

  // Update max amount when from token changes
  useEffect(() => {
    if (swapFromToken) {
      const token = tokens.find(
        (t) =>
          (swapFromToken === "ETH" && t.isNative) ||
          t.address.toLowerCase() === TOKEN_ADDRESSES[swapFromToken]?.toLowerCase(),
      )

      if (token && token.balance) {
        setMaxAmount(token.balance)
      } else {
        setMaxAmount("0")
      }
    }
  }, [swapFromToken, tokens])

  // Get swap quote when inputs change
  useEffect(() => {
    // Store the current input values to use in the async function
    const currentFromToken = swapFromToken
    const currentToToken = swapToToken
    const currentAmount = swapFromAmount

    // Only proceed if we have valid input
    if (!currentFromToken || !currentToToken || !currentAmount || Number.parseFloat(currentAmount) <= 0) {
      setToAmount("")
      setError("") // Clear any previous errors
      return
    }

    // Create a stable reference to avoid state changes during async operation
    const getQuote = async () => {
      // Verify inputs haven't changed since debounce started
      if (currentFromToken !== swapFromToken || currentToToken !== swapToToken || currentAmount !== swapFromAmount) {
        return // Inputs changed, abort this quote request
      }

      try {
        setIsLoading(true)
        setError("")

        // Log the attempt to get a quote
        logActivity("Attempting to get swap quote", {
          fromToken: currentFromToken,
          toToken: currentToToken,
          amount: currentAmount,
        })

        // Get token addresses
        const fromTokenAddress = currentFromToken === "ETH" ? TOKEN_ADDRESSES.ETH : TOKEN_ADDRESSES[currentFromToken]
        const toTokenAddress = currentToToken === "ETH" ? TOKEN_ADDRESSES.ETH : TOKEN_ADDRESSES[currentToToken]

        // Validate the swap request
        const validation = await validateSwapRequest({
          fromTokenAddress,
          toTokenAddress,
          amount: currentAmount,
        })

        if (!validation.isValid) {
          setError(validation.error || "Invalid swap parameters")
          logActivity("Swap validation failed", { error: validation.error })
          setIsLoading(false)
          return
        }

        // Get the quote
        const newQuote = await getSwapQuote(fromTokenAddress, toTokenAddress, currentAmount)

        // Verify inputs haven't changed during async operation
        if (currentFromToken !== swapFromToken || currentToToken !== swapToToken || currentAmount !== swapFromAmount) {
          return // Inputs changed, discard this quote
        }

        setQuote(newQuote)
        setToAmount(newQuote.toToken.amount)

        logActivity("Swap quote received successfully", {
          fromToken: currentFromToken,
          toToken: currentToToken,
          fromAmount: currentAmount,
          toAmount: newQuote.toToken.amount,
          executionPrice: newQuote.executionPrice,
        })
      } catch (err: any) {
        // Only set error if inputs haven't changed
        if (currentFromToken === swapFromToken && currentToToken === swapToToken && currentAmount === swapFromAmount) {
          setError(err.message)
          logActivity("Error getting swap quote", {
            error: err.message,
            stack: err.stack,
            fromToken: currentFromToken,
            toToken: currentToToken,
            amount: currentAmount,
          })
        }
      } finally {
        // Only update loading state if inputs haven't changed
        if (currentFromToken === swapFromToken && currentToToken === swapToToken && currentAmount === swapFromAmount) {
          setIsLoading(false)
        }
      }
    }

    // Use a longer debounce to reduce state changes
    const timer = setTimeout(() => {
      getQuote()
    }, 800) // Increased from 500ms to 800ms

    return () => clearTimeout(timer)
  }, [swapFromToken, swapToToken, swapFromAmount, tokens, logActivity, getSwapQuote])

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get the value from the input
    const value = e.target.value.trim()

    // Only allow valid number formats - strict decimal validation
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      // Log the value for debugging
      logActivity("User entered amount", {
        amount: value,
        type: typeof value,
      })

      setSwapFromAmount(value)
    }
  }

  const handleSwapTokens = () => {
    const temp = swapFromToken
    setSwapFromToken(swapToToken)
    setSwapToToken(temp)
    setSwapFromAmount("")
    setToAmount("")
  }

  const handleSetMaxAmount = () => {
    setSwapFromAmount(maxAmount)
  }

  const validateForm = () => {
    if (!swapFromToken) {
      showToast("Please select a token to swap from", "error")
      logActivity("Validation failed: No from token selected")
      return false
    }

    if (!swapToToken) {
      showToast("Please select a token to swap to", "error")
      logActivity("Validation failed: No to token selected")
      return false
    }

    // Add check for same token swap
    if (swapFromToken === swapToToken) {
      showToast("Cannot swap the same token", "error")
      logActivity("Validation failed: Same token swap attempted", { token: swapFromToken })
      return false
    }

    if (!swapFromAmount || Number.parseFloat(swapFromAmount) <= 0) {
      showToast("Please enter a valid amount", "error")
      logActivity("Validation failed: Invalid amount", { amount: swapFromAmount })
      return false
    }

    if (Number.parseFloat(swapFromAmount) > Number.parseFloat(maxAmount)) {
      showToast("Amount exceeds your balance", "error")
      logActivity("Validation failed: Amount exceeds balance", {
        amount: swapFromAmount,
        balance: maxAmount,
      })
      return false
    }

    if (!quote) {
      showToast("Please wait for the swap quote", "error")
      logActivity("Validation failed: No quote available")
      return false
    }

    logActivity("Form validation passed")
    return true
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setStep("confirm")
    logActivity(`Prepared to swap ${swapFromAmount} of token ${swapFromToken} to ${toAmount} of token ${swapToToken}`)
  }

  // Update the handleConfirm function to use the context's executeSwap
  const handleConfirm = async () => {
    try {
      setIsLoading(true)
      setError("")

      if (!quote) {
        throw new Error("Swap quote not available")
      }

      logActivity(`Confirming swap: ${swapFromAmount} of token ${swapFromToken} to ${toAmount} of token ${swapToToken}`)

      // Use the executeSwap from the context instead of calling it directly
      const txHash = await executeSwap(quote, slippageTolerance)

      setTxHash(txHash)
      setStep("result")
      logActivity(`Swap transaction sent successfully: ${txHash}`)

      // Refresh balances after swap
      refreshBalances()

      // Schedule additional refreshes to ensure balances are updated
      setTimeout(() => {
        refreshBalances()
      }, 5000)

      setTimeout(() => {
        refreshBalances()
      }, 15000)
    } catch (err: any) {
      console.error("Swap error:", err)
      setError(err.message || "Swap failed")
      logActivity(`Swap failed: ${err.message}`)
    } finally {
      setIsLoading(false)
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
    // Refresh balances one more time before closing
    refreshBalances()
    closeBottomSheet()
  }

  // Get token details
  const fromTokenDetails = tokens.find(
    (t) =>
      (swapFromToken === "ETH" && t.isNative) ||
      t.address.toLowerCase() === TOKEN_ADDRESSES[swapFromToken]?.toLowerCase(),
  )

  const toTokenDetails = tokens.find(
    (t) =>
      (swapToToken === "ETH" && t.isNative) || t.address.toLowerCase() === TOKEN_ADDRESSES[swapToToken]?.toLowerCase(),
  )

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-semibold mb-4">Swap Tokens</h2>

      {step === "form" && (
        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <label htmlFor="fromToken" className="block text-sm font-medium mb-1">
              From
            </label>
            <select
              id="fromToken"
              value={swapFromToken}
              onChange={(e) => setSwapFromToken(e.target.value)}
              className="tg-input mb-2"
              required
            >
              <option value="">Select Token</option>
              {Object.keys(TOKEN_ADDRESSES).map((token) => (
                <option key={token} value={token} disabled={token === swapToToken}>
                  {token}
                </option>
              ))}
            </select>

            <div className="flex items-center">
              <input
                type="text"
                value={swapFromAmount}
                onChange={handleFromAmountChange}
                placeholder="0.0"
                className="tg-input flex-1"
                style={{
                  userSelect: "text",
                  WebkitUserSelect: "text",
                }}
                required
              />
              <button
                type="button"
                onClick={handleSetMaxAmount}
                className="ml-2 text-xs bg-gary-accent text-white px-2 py-1 rounded"
              >
                MAX
              </button>
            </div>
            <div className="text-xs text-gary-text-secondary mt-1">
              Available: {maxAmount} {fromTokenDetails?.symbol || swapFromToken}
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center cursor-pointer"
              onClick={handleSwapTokens}
            >
              <ArrowDown size={20} />
            </div>
          </div>

          <div>
            <label htmlFor="toToken" className="block text-sm font-medium mb-1">
              To
            </label>
            <select
              id="toToken"
              value={swapToToken}
              onChange={(e) => setSwapToToken(e.target.value)}
              className="tg-input mb-2"
              required
            >
              <option value="">Select Token</option>
              {Object.keys(TOKEN_ADDRESSES).map((token) => (
                <option key={token} value={token} disabled={token === swapFromToken}>
                  {token}
                </option>
              ))}
            </select>

            <div className="flex items-center">
              <input type="text" value={toAmount} readOnly placeholder="0.0" className="tg-input flex-1 bg-gray-700" />
              <button
                type="button"
                onClick={() => {
                  if (swapFromAmount && Number.parseFloat(swapFromAmount) > 0) {
                    setIsLoading(true)
                    setTimeout(() => setIsLoading(false), 1000)
                  }
                }}
                className="ml-2 p-2 bg-gray-700 rounded hover:bg-gray-600"
                disabled={!swapFromAmount || Number.parseFloat(swapFromAmount) <= 0 || isLoading}
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {quote && (
            <div className="text-sm text-gary-text-secondary p-3 bg-gray-700 rounded-lg">
              <div className="flex justify-between">
                <span>Rate:</span>
                <span>
                  1 {swapFromToken} = {quote.executionPrice} {swapToToken}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Price Impact:</span>
                <span>{quote.priceImpact}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Slippage Tolerance:</span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSlippageTolerance(0.1)}
                    className={`px-2 py-0.5 rounded text-xs ${slippageTolerance === 0.1 ? "bg-gary-accent text-white" : "bg-gray-600"}`}
                  >
                    0.1%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlippageTolerance(0.5)}
                    className={`px-2 py-0.5 rounded text-xs ${slippageTolerance === 0.5 ? "bg-gary-accent text-white" : "bg-gray-600"}`}
                  >
                    0.5%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlippageTolerance(1.0)}
                    className={`px-2 py-0.5 rounded text-xs ${slippageTolerance === 1.0 ? "bg-gary-accent text-white" : "bg-gray-600"}`}
                  >
                    1.0%
                  </button>
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span>Minimum Received:</span>
                <span>
                  {quote.toToken.minAmount} {swapToToken}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center">
              <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="gary-button w-full"
            disabled={isLoading || !swapFromAmount || Number.parseFloat(swapFromAmount) <= 0 || !toAmount}
            style={{ minHeight: "48px" }} // Ensure consistent height
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 size={16} className="animate-spin mr-2" />
                Loading...
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <div className="tg-card">
            <h3 className="text-lg font-medium mb-4">Confirm Swap</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gary-text-secondary">From:</span>
                <span className="font-medium">
                  {swapFromAmount} {swapFromToken}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">To:</span>
                <span className="font-medium">
                  {toAmount} {swapToToken}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Rate:</span>
                <span>
                  1 {swapFromToken} = {quote?.executionPrice} {swapToToken}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Minimum Received:</span>
                <span>
                  {quote?.toToken.minAmount} {swapToToken}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Slippage Tolerance:</span>
                <span>{slippageTolerance}%</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Network:</span>
                <span>Ethereum Mainnet</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gary-text-secondary">Estimated Fee:</span>
                <span>~0.005 ETH</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={handleBack} className="gary-button-outline flex-1" disabled={isLoading}>
              Back
            </button>
            <button onClick={handleConfirm} className="gary-button flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Swapping...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <RefreshCw size={16} className="mr-2" />
                  Swap
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
              <h3 className="text-lg font-medium mb-2">Swap Failed</h3>
              <p className="text-gary-text-secondary mb-4">{error}</p>
              <button onClick={handleBack} className="gary-button w-full">
                Try Again
              </button>
            </div>
          ) : (
            <div className="text-center">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Swap Submitted</h3>
              <p className="text-gary-text-secondary mb-4">Your swap transaction has been submitted to the network</p>

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
