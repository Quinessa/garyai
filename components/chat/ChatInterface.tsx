"use client"

import { useRef, useEffect, useState } from "react"
import MessageBubble from "./MessageBubble"
import InputArea from "./InputArea"
import { useWallet, type WalletContextType } from "@/contexts/WalletContext"
import { useUI } from "@/contexts/UIContext"
import TypingIndicator from "./TypingIndicator"
import { RefreshCw, Send, WalletIcon } from "lucide-react"
import SendForm from "@/components/send/SendForm"
import SwapForm from "@/components/swap/SwapForm"
import { useChat } from "@/contexts/ChatContext"
import { COMMON_TOKENS } from "@/lib/services/blockchain-provider"
import { getTokenPrice } from "@/lib/services/price-service"

const ETHERSCAN_BASE_URL = "https://etherscan.io/tx/"

type TokenFromContext = WalletContextType["tokens"][0] // Infer Token type

type SwapQuote = WalletContextType["swapQuote"]

type PendingSendDetails = {
  amount: string
  tokenSymbol: string
  tokenAddress: string
  recipientAddress: string
  originalFiatRequest?: {
    currencyAmount: string
    currencySymbol: string
  }
}

type PendingSwapDetails = {
  quote: NonNullable<SwapQuote>
  fromTokenSymbol: string
  toTokenSymbol: string
  amountIn: string
}

type PendingConfirmationAction =
  | { type: "send"; details: PendingSendDetails; confirmationMessage: string }
  | { type: "swap"; details: PendingSwapDetails; confirmationMessage: string }

type ParsedIntent = {
  intent: string
  entities?: {
    amount?: string
    tokenSymbol?: string
    address?: string
    fromTokenSymbol?: string
    toTokenSymbol?: string
    currencyAmount?: string
    currencySymbol?: string
    targetTokenSymbol?: string
  }
  originalQuery?: string
}

export default function ChatInterface() {
  const { messages, isTyping, isRecording, addMessage, setIsTyping, setIsRecording } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    activeWallet,
    // tokens: walletTokensFromContext, // We'll use the direct return from refreshBalances
    sendTransaction,
    refreshBalances, // This will now return Token[]
    getSwapQuote: getTokenSwapQuoteFromContext,
    executeSwap: executeTokenSwapFromContext,
    tokens: contextTokens, // Keep this for findTokenAddressBySymbol if needed for all known tokens
  } = useWallet()
  const { showToast, openBottomSheet, logActivity } = useUI()

  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationAction | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const findTokenAddressBySymbol = (symbol: string): string | undefined => {
    if (!symbol) return undefined
    const upperSymbol = symbol.toUpperCase()
    // Prefer contextTokens as it's more likely to be up-to-date from proactive refreshes
    const walletToken = contextTokens.find((t) => t.symbol.toUpperCase() === upperSymbol)
    if (walletToken) return walletToken.address
    const commonToken = COMMON_TOKENS.find((t) => t.symbol.toUpperCase() === upperSymbol)
    return commonToken?.address
  }

  const handleSendMessage = async (content: string) => {
    addMessage({ type: "user", content })
    setIsTyping(true)

    if (pendingConfirmation) {
      // ... (pending confirmation logic remains the same)
      const userResponse = content.toLowerCase().trim()
      let followupMessage = ""

      if (userResponse === "yes" || userResponse === "y") {
        if (pendingConfirmation.type === "send") {
          const { amount, tokenAddress, recipientAddress, tokenSymbol } = pendingConfirmation.details
          if (!amount || typeof amount !== "string" || amount.trim() === "" || Number.parseFloat(amount) <= 0) {
            followupMessage =
              "Sorry, the amount for the transaction is missing or invalid. Please try the command again."
            logActivity("Transaction aborted: Invalid amount in pending confirmation", pendingConfirmation.details)
          } else {
            try {
              followupMessage = `Okay, sending ${amount} ${tokenSymbol} to ${recipientAddress}...`
              addMessage({ type: "assistant", content: followupMessage })
              setIsTyping(true)

              const txHash = await sendTransaction(recipientAddress, amount, tokenAddress)
              const etherscanLink = `${ETHERSCAN_BASE_URL}${txHash}`
              followupMessage = `Transaction sent! View on Etherscan: ${etherscanLink}\nIt might take a few moments to confirm on the network.`
              logActivity("Transaction submitted via chat", {
                txHash,
                amount,
                tokenSymbol,
                recipientAddress,
                etherscanLink,
              })
              showToast("Transaction submitted!", "success")
              setTimeout(() => refreshBalances(), 3000) // This will update context state
              setTimeout(() => refreshBalances(), 10000)
            } catch (error: any) {
              console.error("Error sending transaction:", error)
              followupMessage = `Sorry, there was an error sending the transaction: ${error.message || "Unknown error"}`
              logActivity("Transaction failed via chat", {
                error: error.message,
                amount,
                tokenSymbol,
                recipientAddress,
              })
              showToast("Transaction failed", "error")
            }
          }
        } else if (pendingConfirmation.type === "swap") {
          const { quote, fromTokenSymbol, toTokenSymbol, amountIn } = pendingConfirmation.details
          try {
            followupMessage = `Okay, swapping ${amountIn} ${fromTokenSymbol} for ${toTokenSymbol}...`
            addMessage({ type: "assistant", content: followupMessage })
            setIsTyping(true)

            const txHash = await executeTokenSwapFromContext(quote, 0.5)
            const etherscanLink = `${ETHERSCAN_BASE_URL}${txHash}`
            followupMessage = `Swap submitted! View on Etherscan: ${etherscanLink}\nIt might take a few moments to confirm.`
            logActivity("Swap submitted via chat", { txHash, fromTokenSymbol, toTokenSymbol, amountIn, etherscanLink })
            showToast("Swap submitted!", "success")
            setTimeout(() => refreshBalances(), 3000)
            setTimeout(() => refreshBalances(), 10000)
          } catch (error: any) {
            console.error("Error executing swap:", error)
            followupMessage = `Sorry, there was an error executing the swap: ${error.message || "Unknown error"}`
            logActivity("Swap failed via chat", { error: error.message, fromTokenSymbol, toTokenSymbol, amountIn })
            showToast("Swap failed", "error")
          }
        }
      } else if (userResponse === "no" || userResponse === "n") {
        followupMessage = "Okay, I've cancelled the action."
        logActivity("User cancelled pending action", { type: pendingConfirmation.type })
      } else {
        followupMessage = `Please respond with "Yes" or "No". ${pendingConfirmation.confirmationMessage}`
        setIsTyping(false)
        addMessage({ type: "assistant", content: followupMessage })
        return
      }

      setPendingConfirmation(null)
      setIsTyping(false)
      addMessage({ type: "assistant", content: followupMessage })
      return
    }

    const understandingResponse = await fetch("/api/chat/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content }),
    })

    if (!understandingResponse.ok) {
      const errorData = await understandingResponse.json()
      console.error("Error understanding message:", errorData)
      showToast(errorData.error || "Sorry, I had trouble understanding that.", "error")
      setIsTyping(false)
      addMessage({
        type: "assistant",
        content: "I'm having a little trouble understanding right now. Please try again.",
      })
      return
    }

    const parsed: ParsedIntent = await understandingResponse.json()
    console.log("NLU API Response:", parsed)
    logActivity(`NLU result: ${JSON.stringify(parsed)}`)

    let response = ""

    try {
      switch (parsed.intent) {
        case "greeting":
          response = "Hey there! How can I help with your crypto today?"
          break

        case "check_balance":
          if (!activeWallet) {
            response = "You don't have an active wallet yet. Would you like me to help you create one?"
            setIsTyping(false)
          } else {
            setIsTyping(true)
            const fetchedTokens: TokenFromContext[] = await refreshBalances() // Use the returned tokens

            const ethToken = fetchedTokens.find((t) => t.isNative)
            const otherTokens = fetchedTokens.filter(
              (t) => !t.isNative && t.balance && Number.parseFloat(t.balance) > 0.00001,
            )

            let balanceMessage = "Here's your current balance:\n"
            if (ethToken && ethToken.balance) {
              const ethBal = Number.parseFloat(ethToken.balance)
              balanceMessage += `• ${ethBal > 0.000001 ? ethBal.toFixed(6) : "0.00"} ${ethToken.symbol}\n`
            } else if (fetchedTokens.length > 0) {
              balanceMessage += "• Could not fetch ETH balance at the moment.\n"
            }

            if (otherTokens.length > 0) {
              otherTokens.forEach((token) => {
                if (token.balance) {
                  const tokenBal = Number.parseFloat(token.balance)
                  const precision = token.symbol === "USDC" || token.symbol === "USDT" || token.symbol === "DAI" ? 2 : 4
                  balanceMessage += `• ${tokenBal.toFixed(precision)} ${token.symbol}\n`
                }
              })
            }

            const hasEthBalance = ethToken && ethToken.balance && Number.parseFloat(ethToken.balance) > 0.000001
            const hasOtherBalances = otherTokens.some(
              (token) => token.balance && Number.parseFloat(token.balance) > 0.00001,
            )

            if (!hasEthBalance && !hasOtherBalances) {
              if (fetchedTokens.length === 0) {
                balanceMessage =
                  "I couldn't fetch any token information for your wallet right now. It might be a new wallet or there could be a temporary issue. Please try again in a moment."
              } else {
                balanceMessage = "It looks like your wallet is currently empty or has only trace amounts of crypto."
              }
            }

            response = balanceMessage.trim() + "\n\nWould you like to do anything else?"
            logActivity("User checked balance", {
              numTokensDisplayed: (hasEthBalance ? 1 : 0) + otherTokens.length,
              activeWallet: activeWallet.address,
              fetchedTokensCount: fetchedTokens.length,
            })
          }
          break

        // ... (other cases like send, swap, etc. remain the same)
        case "send":
          if (!activeWallet) {
            response =
              "You'll need to create a wallet first before sending any crypto. Would you like me to help you create one?"
          } else if (parsed.entities) {
            const {
              amount: cryptoAmountFromNLU,
              tokenSymbol: tokenSymbolFromNLU,
              address: recipientAddress,
              currencyAmount,
              currencySymbol,
              targetTokenSymbol,
            } = parsed.entities

            if (!recipientAddress) {
              response = "I understood you want to send something, but I'm missing the recipient address."
              break
            }

            let finalCryptoAmount: string | undefined = cryptoAmountFromNLU
            let finalTokenSymbol: string | undefined = tokenSymbolFromNLU
            let originalFiatRequest

            if (currencyAmount && currencySymbol && targetTokenSymbol) {
              logActivity(
                `Parsed send intent (fiat): ${currencyAmount} ${currencySymbol} of ${targetTokenSymbol} to ${recipientAddress}`,
              )
              finalTokenSymbol = targetTokenSymbol
              try {
                const price = await getTokenPrice(targetTokenSymbol, currencySymbol)
                const numericCurrencyAmount = Number.parseFloat(currencyAmount)
                if (isNaN(numericCurrencyAmount) || numericCurrencyAmount <= 0) {
                  response = `The amount ${currencyAmount} ${currencySymbol} is not valid. Please specify a positive amount.`
                  break
                }
                const calculatedCryptoAmount = numericCurrencyAmount / price
                finalCryptoAmount = calculatedCryptoAmount.toFixed(8) // Keep good precision for crypto
                originalFiatRequest = { currencyAmount, currencySymbol }
                logActivity(
                  `Converted ${currencyAmount} ${currencySymbol} of ${targetTokenSymbol} to ${finalCryptoAmount} ${targetTokenSymbol} (price: ${price})`,
                )
              } catch (error: any) {
                console.error("Error during fiat to crypto conversion:", error)
                response =
                  error.message ||
                  `Sorry, I couldn't convert ${currencyAmount} ${currencySymbol} to ${targetTokenSymbol} right now. Please try specifying the amount in ${targetTokenSymbol}.`
                break
              }
            } else if (cryptoAmountFromNLU && tokenSymbolFromNLU) {
              finalCryptoAmount = cryptoAmountFromNLU
              finalTokenSymbol = tokenSymbolFromNLU
            }

            if (finalCryptoAmount && finalTokenSymbol && recipientAddress) {
              if (
                typeof finalCryptoAmount !== "string" ||
                finalCryptoAmount.trim() === "" ||
                Number.parseFloat(finalCryptoAmount) <= 0
              ) {
                response =
                  "It looks like the amount to send is missing or invalid. Could you please specify a valid positive amount?"
                break
              }
              const actualTokenAddress = findTokenAddressBySymbol(finalTokenSymbol)
              if (!actualTokenAddress) {
                response = `Sorry, I don't recognize the token symbol "${finalTokenSymbol}". Please use a known symbol like ETH, USDC, etc.`
                break
              }

              const confirmationMessage = `You want to send ${finalCryptoAmount} ${finalTokenSymbol} ${originalFiatRequest ? `(approx. ${originalFiatRequest.currencyAmount} ${originalFiatRequest.currencySymbol}) ` : ""}to ${recipientAddress}. Is this correct? (Yes/No)`
              setPendingConfirmation({
                type: "send",
                details: {
                  amount: finalCryptoAmount,
                  tokenSymbol: finalTokenSymbol,
                  tokenAddress: actualTokenAddress,
                  recipientAddress,
                  originalFiatRequest,
                },
                confirmationMessage,
              })
              response = confirmationMessage
              logActivity(`Pending send confirmation: ${finalCryptoAmount} ${finalTokenSymbol} to ${recipientAddress}`)
            } else {
              response =
                "I understood you want to send something, but I'm missing some details like the amount or token."
            }
          } else {
            response = "I understood you want to send something, but I couldn't extract the details."
          }
          break

        case "swap":
          if (!activeWallet) {
            response =
              "You'll need to create a wallet first before swapping tokens. Would you like me to help you create one?"
          } else if (parsed.entities) {
            const { amount: amountIn, fromTokenSymbol, toTokenSymbol } = parsed.entities

            if (!amountIn || !fromTokenSymbol || !toTokenSymbol) {
              response =
                "I understood you want to swap, but I'm missing some details like the amount, or which tokens to swap. Example: 'swap 1 ETH for USDC'."
              break
            }

            const fromTokenAddress = findTokenAddressBySymbol(fromTokenSymbol)
            const toTokenAddress = findTokenAddressBySymbol(toTokenSymbol)

            if (!fromTokenAddress) {
              response = `Sorry, I don't recognize the token "${fromTokenSymbol}".`
              break
            }
            if (!toTokenAddress) {
              response = `Sorry, I don't recognize the token "${toTokenSymbol}".`
              break
            }
            if (fromTokenAddress === toTokenAddress) {
              response = "You can't swap a token for itself!"
              break
            }

            try {
              setIsTyping(true)
              addMessage({
                type: "assistant",
                content: `Getting a swap quote for ${amountIn} ${fromTokenSymbol} to ${toTokenSymbol}...`,
              })

              const quoteResult = await getTokenSwapQuoteFromContext(fromTokenAddress, toTokenAddress, amountIn)

              if (!quoteResult) {
                throw new Error("Failed to get a valid swap quote.")
              }

              const estimatedAmountOut = Number.parseFloat(quoteResult.toToken.amount).toFixed(6)
              const priceImpact = quoteResult.priceImpact || "N/A"

              const confirmationMessage = `To swap ${amountIn} ${fromTokenSymbol}, you'll get approximately ${estimatedAmountOut} ${toTokenSymbol}. Price impact: ${priceImpact}. Do you want to proceed? (Yes/No)`

              setPendingConfirmation({
                type: "swap",
                details: {
                  quote: quoteResult,
                  fromTokenSymbol,
                  toTokenSymbol,
                  amountIn,
                },
                confirmationMessage,
              })
              response = confirmationMessage
              logActivity(
                `Pending swap confirmation: ${amountIn} ${fromTokenSymbol} for ~${estimatedAmountOut} ${toTokenSymbol}`,
              )
            } catch (error: any) {
              console.error("Error getting swap quote:", error)
              response = `Sorry, I couldn't get a swap quote: ${error.message || "Unknown error"}. Please ensure the tokens are swappable and you have enough balance for gas.`
            }
          } else {
            response = "I understood you want to swap, but I couldn't extract the details."
          }
          break
        case "wallet_info":
          if (activeWallet) {
            const shortAddress = `${activeWallet.address.substring(0, 6)}...${activeWallet.address.substring(activeWallet.address.length - 4)}`
            response = `Your active wallet is ${shortAddress}. Would you like to copy the full address or see your tokens?`
          } else {
            response = "You don't have an active wallet yet. Would you like me to help you create one?"
          }
          break

        case "create_wallet_info":
          response =
            "I can help you create a new wallet. Just tap the 'Wallet' tab at the bottom and then select 'Create New Wallet'. Would you like me to guide you through the process?"
          break

        case "help":
          response = `I can help you manage your crypto! Try asking me to:
• Check your balance
• Send ETH or tokens to someone (e.g., "send 0.1 ETH to 0x123..." or "send $10 of USDC to vitalik.eth")
• Show your wallet address
• Swap tokens (e.g., "swap 1 ETH for USDC" or "swap 100 USDC to DAI")
• View your recent transactions
Or just chat with me about crypto in general!`
          break

        case "transaction_history_info":
          response = "Let me pull up your recent transactions for you. (Actual history display coming soon!)"
          break

        case "refresh_balances":
          addMessage({ type: "assistant", content: "Refreshing your balances now..." })
          setIsTyping(true)
          await refreshBalances() // This call updates context, but we don't use its return value here
          setIsTyping(false)
          response =
            "I've refreshed your wallet balances. Is there anything specific you'd like to know about your holdings?"
          break

        case "crypto_question":
          response =
            "That's a great question about crypto! I'd be happy to explain. What specific aspects are you most interested in learning about?"
          break

        case "unknown":
        default:
          const unknownResponses = [
            "I'm not quite sure what you're asking for. Could you rephrase that?",
            "I'd love to help with that. Could you give me a bit more detail about what you need?",
            "I'm still learning! Could you try asking in a different way or tell me specifically what you'd like to do with your crypto?",
          ]
          response = unknownResponses[Math.floor(Math.random() * unknownResponses.length)]
          break
      }

      if (response) {
        setTimeout(
          () => {
            setIsTyping(false)
            addMessage({ type: "assistant", content: response })
          },
          // Adjust delay: shorter for simple responses, slightly longer if it was a balance check
          parsed.intent === "check_balance"
            ? 750
            : response.length < 100
              ? 500
              : Math.min(500 + response.length * 10, 2000),
        )
      } else {
        setIsTyping(false)
      }
    } catch (error: any) {
      console.error("Error processing message:", error)
      showToast("Error processing your message", "error")
      setIsTyping(false)
      logActivity(`Error processing message: ${error.message || error.toString()}`)
      addMessage({ type: "assistant", content: "I encountered an issue trying to process that. Please try again." })
    }
  }

  const handleStartRecording = () => {
    setIsRecording(true)
    showToast("Recording started...", "info")
    logActivity("Voice recording started")
  }
  const handleStopRecording = () => {
    setIsRecording(false)
    showToast("Recording stopped", "info")
    logActivity("Voice recording stopped")
    setTimeout(() => {
      handleSendMessage("Show me my wallet balance")
    }, 1000)
  }
  const handleOpenSendForm = () => {
    openBottomSheet(<SendForm />)
    logActivity("User opened send form from quick action")
  }
  const handleOpenSwapForm = () => {
    openBottomSheet(<SwapForm />)
    logActivity("User opened swap form from quick action")
  }
  const handleCheckBalance = () => {
    handleSendMessage("Show me my wallet balance")
    logActivity("User requested balance check from quick action")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-center mb-8 mt-4">
          <h1 className="text-2xl font-light text-gary-text">GaryAI Wallet Assistant</h1>
        </div>
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              type={message.type}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="px-4 pb-4">
        <InputArea
          onSendMessage={handleSendMessage}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          isRecording={isRecording}
        />
        <div className="mt-4">
          <p className="text-gary-text-secondary text-sm mb-2 text-center">Quick Actions:</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={handleOpenSwapForm}
              className="gary-button-outline text-xs py-1 px-3 flex items-center backdrop-blur-md bg-opacity-50 bg-gary-bg"
            >
              <RefreshCw size={14} className="mr-1" /> Swap Tokens
            </button>
            <button
              onClick={handleOpenSendForm}
              className="gary-button-outline text-xs py-1 px-3 flex items-center backdrop-blur-md bg-opacity-50 bg-gary-bg"
            >
              <Send size={14} className="mr-1" /> Send Tokens
            </button>
            <button
              onClick={handleCheckBalance}
              className="gary-button-outline text-xs py-1 px-3 flex items-center backdrop-blur-md bg-opacity-50 bg-gary-bg"
            >
              <WalletIcon size={14} className="mr-1" /> Check Balance
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
