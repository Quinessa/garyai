"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useTelegram } from "./TelegramContext"
import {
  importWalletFromPrivateKey,
  importWalletFromMnemonic,
  getWalletBalance,
  getTokenBalances,
  clientDecryptData, // Add this
} from "@/lib/services/wallet-service"
import { sendEth, sendToken, getTransactionStatus } from "@/lib/services/transaction-service"
import { getSwapQuote, executeSwap } from "@/lib/services/swap-service"
import {
  createWalletInDB,
  importWalletToDB,
  getUserWallets,
  setWalletActive,
  getWalletById,
} from "@/lib/services/wallet-db-service"
import { getAllTokens, initializeDefaultTokens } from "@/lib/services/token-db-service"
import {
  createTransaction,
  updateTransactionStatus,
  getWalletTransactions,
} from "@/lib/services/transaction-db-service"
import { logActivity } from "@/lib/services/activity-logger"
import { getAllTokensWithBalances, findTokenByAddress } from "@/lib/services/token-balance-service"
import { COMMON_TOKENS, getSigner } from "@/lib/services/blockchain-provider" // Import getSigner

type Token = {
  id: string
  address: string
  symbol: string
  name: string
  decimals: number
  balance?: string
  logoUrl?: string
  isNative: boolean
}

type Wallet = {
  id: string
  address: string
  isActive: boolean
  name?: string // Add name
  encrypted_private_key?: string // Add this
  encrypted_mnemonic?: string // Add this
}

type Transaction = {
  id: string
  txHash: string
  txType: "send" | "receive" | "swap"
  status: "pending" | "confirmed" | "failed"
  fromAddress: string
  toAddress: string
  amount: string
  tokenId: string
  tokenSymbol?: string
  tokenAddress?: string
  fee?: string
  timestamp: Date
  confirmations: number
}

type SwapQuote = {
  fromToken: {
    address: string
    amount: string
  }
  toToken: {
    address: string
    amount: string
    minAmount: string
  }
  executionPrice: string
  priceImpact: string
}

type BalanceCheckStats = {
  lastCheck: number
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  lastError: string
  lastResponse: string
}

// Update the WalletContextType to include balanceCheckStats
export type WalletContextType = {
  wallets: Wallet[]
  activeWallet: Wallet | null
  tokens: Token[]
  transactions: Transaction[]
  swapQuote: SwapQuote | null
  isLoading: boolean
  error: string | null
  balanceCheckStats: BalanceCheckStats
  createNewWallet: () => Promise<void>
  importWallet: (privateKeyOrMnemonic: string) => Promise<void>
  setActiveWallet: (walletId: string) => void
  getBalance: (tokenAddress?: string) => Promise<string>
  sendTransaction: (to: string, amount: string, tokenAddress: string) => Promise<string>
  getSwapQuote: (fromTokenAddress: string, toTokenAddress: string, amount: string) => Promise<SwapQuote>
  executeSwap: (quote: SwapQuote, slippageTolerance: number) => Promise<string>
  refreshBalances: () => Promise<Token[]>
  getTransactionHistory: () => Promise<void>
  swapFromToken: string
  swapToToken: string
  swapFromAmount: string
  setSwapFromToken: (token: string) => void
  setSwapToToken: (token: string) => void
  setSwapFromAmount: (amount: string) => void
}

const WalletContext = createContext<WalletContextType>({
  wallets: [],
  activeWallet: null,
  tokens: [],
  transactions: [],
  swapQuote: null,
  isLoading: false,
  error: null,
  balanceCheckStats: {
    lastCheck: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    lastError: "",
    lastResponse: "",
  },
  createNewWallet: async () => {},
  importWallet: async () => {},
  setActiveWallet: () => {},
  getBalance: async () => "",
  sendTransaction: async () => "",
  getSwapQuote: async () => ({
    fromToken: { address: "", amount: "" },
    toToken: { address: "", amount: "", minAmount: "" },
    executionPrice: "",
    priceImpact: "",
  }),
  executeSwap: async () => "",
  refreshBalances: async () => [],
  getTransactionHistory: async () => {},
  swapFromToken: "ETH",
  swapToToken: "USDC",
  swapFromAmount: "",
  setSwapFromToken: () => {},
  setSwapToToken: () => {},
  setSwapFromAmount: () => {},
})

const useWallet = () => useContext(WalletContext)

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { dbUser, isAuthenticated, isReady } = useTelegram()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0)
  const [cachedWalletData, setCachedWalletData] = useState<{
    walletId: string
    encryptedPrivateKey: string
  } | null>(null)

  // Add these new state variables for tracking balance check operations
  const [balanceCheckStats, setBalanceCheckStats] = useState<BalanceCheckStats>({
    lastCheck: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    lastError: "",
    lastResponse: "",
  })

  const [swapFromToken, setSwapFromToken] = useState("ETH")
  const [swapToToken, setSwapToToken] = useState("USDC")
  const [swapFromAmount, setSwapFromAmount] = useState("")

  // Refresh all balances - with improved error handling and simplified approach
  const refreshBalances = useCallback(async (): Promise<Token[]> => {
    try {
      if (!activeWallet) {
        console.log("[WalletContext] No active wallet, skipping balance refresh")
        return []
      }

      // Throttle refreshes to once every 3 seconds (reduced from 5)
      const now = Date.now()
      if (now - lastRefreshTime < 3000) {
        console.log("[WalletContext] Throttling balance refresh (last refresh was less than 3 seconds ago)")
        return
      }

      setIsLoading(true)
      setLastRefreshTime(now)

      // Update balance check stats
      setBalanceCheckStats((prev) => ({
        ...prev,
        lastCheck: now,
        totalChecks: prev.totalChecks + 1,
      }))

      console.log(`[WalletContext] Refreshing balances for wallet: ${activeWallet.address}`)

      try {
        // Use the enhanced getAllTokensWithBalances function
        const tokenBalances = await getAllTokensWithBalances(activeWallet.address)
        console.log(
          `[WalletContext] Received ${tokenBalances.length} token balances:`,
          tokenBalances.map((t) => `${t.symbol}: ${t.balance}`).join(", "),
        )

        // Find ETH balance
        const ethToken = tokenBalances.find((t) => t.address === "0x0000000000000000000000000000000000000000")
        const ethBalance = ethToken ? ethToken.balance : "0"

        const formattedTokens = tokenBalances.map((tokenData) => ({
          id: tokenData.address.toLowerCase(),
          address: tokenData.address,
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: tokenData.decimals,
          balance: tokenData.balance,
          logoUrl: tokenData.logoUrl,
          isNative: tokenData.address === "0x0000000000000000000000000000000000000000",
        }))

        // Update tokens in state with a complete replacement to ensure all tokens are updated
        setTokens(formattedTokens)

        // Update balance check stats for success
        setBalanceCheckStats((prev) => ({
          ...prev,
          successfulChecks: prev.successfulChecks + 1,
          lastResponse: `ETH balance: ${ethBalance}, Total tokens: ${tokenBalances.length}`,
          lastError: "", // Clear any previous errors
        }))

        console.log(`[WalletContext] Balance refresh completed successfully`)
        setIsLoading(false)
        return formattedTokens
      } catch (error) {
        console.error(`[WalletContext] Error fetching balances:`, error)

        // Update balance check stats for failure
        setBalanceCheckStats((prev) => ({
          ...prev,
          failedChecks: prev.failedChecks + 1,
          lastError: error instanceof Error ? error.message : String(error),
        }))

        // Show error toast
        setError(error instanceof Error ? error.message : "Failed to refresh balances")
        setIsLoading(false)
        return []
      }
      // No finally block here, isLoading is handled in try/catch
    } catch (err) {
      console.error(`[WalletContext] Unexpected error in refreshBalances:`, err)
      setIsLoading(false)

      // Update balance check stats for unexpected failure
      setBalanceCheckStats((prev) => ({
        ...prev,
        failedChecks: prev.failedChecks + 1,
        lastError: err instanceof Error ? err.message : String(err),
      }))
      return []
    }
  }, [activeWallet, lastRefreshTime, setError])

  // Load wallets from localStorage on initial mount
  useEffect(() => {
    const loadWalletsFromLocalStorage = () => {
      try {
        const savedWallets = localStorage.getItem("wallets")
        if (savedWallets) {
          const parsedWallets = JSON.parse(savedWallets)
          setWallets(parsedWallets)

          // Find active wallet
          const activeWalletId = localStorage.getItem("activeWalletId")
          if (activeWalletId) {
            const active = parsedWallets.find((w: Wallet) => w.id === activeWalletId)
            if (active) {
              setActiveWallet(active)
              console.log("Loaded active wallet from localStorage:", active)

              // Cache the wallet ID for later use
              const walletId = active.id

              // Try to load encrypted private key from localStorage
              const encryptedPrivateKey = localStorage.getItem(`wallet_${walletId}_privateKey`)
              if (encryptedPrivateKey) {
                setCachedWalletData({
                  walletId,
                  encryptedPrivateKey,
                })
                logActivity("Cached wallet private key from localStorage", { walletId })
              }
            }
          }

          console.log("Loaded wallets from localStorage:", parsedWallets)
        }
      } catch (err) {
        console.error("Failed to load wallets from localStorage:", err)
      }
    }

    loadWalletsFromLocalStorage()
  }, [])

  // Initialize tokens and wallets when user is available
  useEffect(() => {
    const initializeData = async () => {
      if (dbUser) {
        setIsLoading(true)
        logActivity("Initializing wallet data with dbUser", { userId: dbUser.id })

        // Initialize default tokens in the database
        await initializeDefaultTokens()

        // Load tokens from database
        const dbTokens = await getAllTokens()
        if (dbTokens.length > 0) {
          setTokens(
            dbTokens.map((token) => ({
              id: token.address.toLowerCase(),
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              logoUrl: token.logo_url,
              isNative: token.is_native,
              balance: "0",
            })),
          )
        }

        // Only load wallets from database if we don't already have wallets from localStorage
        if (wallets.length === 0) {
          if (dbUser?.id) {
            const dbWallets = await getUserWallets(dbUser.id)
            if (dbWallets.length > 0) {
              const formattedWallets = dbWallets.map((wallet) => ({
                id: wallet.id.toString(),
                address: wallet.address,
                isActive: wallet.is_active,
                name: wallet.name,
                encrypted_private_key: wallet.encrypted_private_key,
                encrypted_mnemonic: wallet.encrypted_mnemonic,
              }))

              setWallets(formattedWallets)

              // Set active wallet
              const activeDbWallet = dbWallets.find((w) => w.is_active)
              if (activeDbWallet) {
                const activeWalletFormatted = {
                  id: activeDbWallet.id.toString(),
                  address: activeDbWallet.address,
                  isActive: true,
                  name: activeDbWallet.name,
                  encrypted_private_key: activeDbWallet.encrypted_private_key,
                  encrypted_mnemonic: activeDbWallet.encrypted_mnemonic,
                }
                setActiveWallet(activeWalletFormatted)
              }
            }
          }
        }

        setIsLoading(false)
      } else if (isReady) {
        // If dbUser is not available but app is ready, initialize tokens from default list
        logActivity("Initializing tokens without dbUser")

        // Initialize default tokens in memory
        const defaultTokens = COMMON_TOKENS.map((token) => ({
          id: token.address.toLowerCase(),
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoUrl: token.logoUrl,
          isNative: token.isNative,
          balance: "0",
        }))

        setTokens(defaultTokens)
      }
    }

    initializeData()
  }, [dbUser, wallets.length, isReady])

  // Save wallets to localStorage whenever they change
  useEffect(() => {
    if (wallets.length > 0) {
      localStorage.setItem("wallets", JSON.stringify(wallets))
    }
  }, [wallets])

  // Save active wallet ID to localStorage whenever it changes
  useEffect(() => {
    if (activeWallet) {
      localStorage.setItem("activeWalletId", activeWallet.id)
    }
  }, [activeWallet])

  // Add this after the other useEffect hooks
  useEffect(() => {
    // Debug the wallet state on mount and when it changes
    if (activeWallet) {
      logActivity("Active wallet updated", {
        id: activeWallet.id,
        address: activeWallet.address,
        isActive: activeWallet.isActive,
      })
    } else {
      logActivity("No active wallet", { walletsCount: wallets.length })

      // Try to recover wallet from localStorage if we have wallets but no active one
      if (wallets.length > 0) {
        const activeWalletId = localStorage.getItem("activeWalletId")
        if (activeWalletId) {
          const wallet = wallets.find((w) => w.id === activeWalletId)
          if (wallet) {
            logActivity("Recovering active wallet from localStorage", { id: wallet.id })
            setActiveWallet(wallet)
          }
        } else if (wallets[0]) {
          // If no active wallet ID in localStorage, use the first wallet
          logActivity("Setting first wallet as active", { id: wallets[0].id })
          setActiveWallet(wallets[0])
          localStorage.setItem("activeWalletId", wallets[0].id)
        }
      }
    }
  }, [activeWallet, wallets])

  // Proactive balance refreshing
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null

    const performRefresh = async () => {
      if (activeWallet) {
        logActivity("Proactively refreshing balances", { walletAddress: activeWallet.address })
        await refreshBalances() // Call it, but no need to use the returned value here
      }
    }

    // Initial refresh if activeWallet is present
    performRefresh()

    // Set up periodic refresh (e.g., every 60 seconds)
    // Clear previous interval if activeWallet changes or component unmounts
    if (refreshInterval) clearInterval(refreshInterval)
    refreshInterval = setInterval(performRefresh, 60000) // Refresh every 60 seconds

    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [activeWallet, refreshBalances]) // Rerun when activeWallet or refreshBalances function instance changes

  // Create a new wallet
  const createNewWallet = async () => {
    try {
      if (!dbUser && !isAuthenticated) {
        logActivity("Creating wallet without authentication")
        throw new Error("User not authenticated")
      }

      setIsLoading(true)
      setError(null)

      // Placeholder for actual wallet creation logic
      // const { address, privateKey: rawPrivateKey, mnemonic: rawMnemonic } = generateNewEthersWallet(); // You need to implement or import this
      // const walletName = "My New Wallet";
      // const derivationPath = "m/44'/60'/0'/0/0";

      // if (!dbUser?.id) throw new Error("User not authenticated for wallet creation");
      // const newWalletDB = await createWalletInDB(dbUser.id, walletName, address, rawPrivateKey, rawMnemonic, derivationPath);

      // Create a new wallet in the database
      // const newWalletDB = await createWalletInDB(dbUser ? dbUser.id : 0)
      // Placeholder for actual wallet creation logic
      // const { address, privateKey: rawPrivateKey, mnemonic: rawMnemonic } = generateNewEthersWallet(); // You need to implement or import this
      // const walletName = "My New Wallet";
      // const derivationPath = "m/44'/60'/0'/0/0";

      // if (!dbUser?.id) throw new Error("User not authenticated for wallet creation");
      // const newWalletDB = await createWalletInDB(dbUser.id, walletName, address, rawPrivateKey, rawMnemonic, derivationPath);

      // Placeholder for actual wallet creation logic
      const walletName = "My New Wallet"
      const derivationPath = "m/44'/60'/0'/0/0"

      // Placeholder for actual wallet creation logic
      // const { address, privateKey: rawPrivateKey, mnemonic: rawMnemonic } = generateNewEthersWallet(); // You need to implement or import this
      // const walletName = "My New Wallet";
      // const derivationPath = "m/44'/60'/0'/0/0";

      // if (!dbUser?.id) throw new Error("User not authenticated for wallet creation");
      // const newWalletDB = await createWalletInDB(dbUser.id, walletName, address, rawPrivateKey, rawMnemonic, derivationPath);

      // For now, to make it compile, you might need to temporarily adjust the call or the `createWalletInDB` signature if you're not ready to integrate full wallet generation here. The key is that `createWalletInDB` now expects more parameters because it handles the encryption itself.

      // Placeholder for actual wallet creation logic
      const address = "0x0000000000000000000000000000000000000000"
      const rawPrivateKey = "0x0000000000000000000000000000000000000000000000000000000000000000"
      const rawMnemonic = "test test test test test test test test test test test test"

      if (!dbUser?.id) throw new Error("User not authenticated for wallet creation")
      const newWalletDB = await createWalletInDB(
        dbUser.id,
        walletName,
        address,
        rawPrivateKey,
        rawMnemonic,
        derivationPath,
      )

      if (!newWalletDB) {
        throw new Error("Failed to create wallet")
      }

      const newWallet: Wallet = {
        id: newWalletDB.id.toString(),
        address: newWalletDB.address,
        isActive: true,
        name: newWalletDB.name,
        encrypted_private_key: newWalletDB.encrypted_private_key,
        encrypted_mnemonic: newWalletDB.encrypted_mnemonic,
      }

      // Update the wallets array and set the new wallet as active
      setWallets((prev) => {
        const updatedWallets = [...prev, newWallet]
        return updatedWallets.map((w) => ({
          ...w,
          isActive: w.id === newWallet.id,
        }))
      })
      setActiveWallet(newWallet)

      setIsLoading(false)
    } catch (err) {
      setError("Failed to create wallet")
      setIsLoading(false)
      console.error(err)
    }
  }

  // Import a wallet from private key or mnemonic
  const importWallet = async (privateKeyOrMnemonic: string) => {
    try {
      if (!dbUser && !isAuthenticated) {
        logActivity("Importing wallet without authentication")
        throw new Error("User not authenticated")
      }

      setIsLoading(true)
      setError(null)

      let walletData

      // Check if input is a private key or mnemonic
      if (privateKeyOrMnemonic.startsWith("0x") && privateKeyOrMnemonic.length === 66) {
        // Import from private key
        walletData = importWalletFromPrivateKey(privateKeyOrMnemonic)

        // Save to database
        // const newWalletDB = await importWalletToDB(dbUser ? dbUser.id : 0, walletData.address, walletData.privateKey)
        // if (!dbUser?.id) throw new Error("User not authenticated for wallet import");
        // const walletName = "Imported Wallet"; // Or prompt user
        // const derivationPath = "m/44'/60'/0'/0/0"; // Or determine appropriately

        // let newWalletDB;
        // if (privateKeyOrMnemonic.startsWith("0x") && privateKeyOrMnemonic.length === 66) {
        //   const walletData = importWalletFromPrivateKey(privateKeyOrMnemonic); // This is client-side, returns raw keys
        //   newWalletDB = await importWalletToDB(dbUser.id, walletName, walletData.address, walletData.privateKey, null, derivationPath);
        // } else {
        //   const walletData = importWalletFromMnemonic(privateKeyOrMnemonic); // Client-side, returns raw keys
        //   newWalletDB = await importWalletToDB(dbUser.id, walletName, walletData.address, walletData.privateKey, walletData.mnemonic, derivationPath);
        // }

        if (!dbUser?.id) throw new Error("User not authenticated for wallet import")
        const walletName = "Imported Wallet" // Or prompt user
        const derivationPath = "m/44'/60'/0'/0/0" // Or determine appropriately

        let newWalletDB
        if (privateKeyOrMnemonic.startsWith("0x") && privateKeyOrMnemonic.length === 66) {
          const walletData = importWalletFromPrivateKey(privateKeyOrMnemonic) // This is client-side, returns raw keys
          newWalletDB = await importWalletToDB(
            dbUser.id,
            walletName,
            walletData.address,
            walletData.privateKey,
            null,
            derivationPath,
          )
        } else {
          const walletData = importWalletFromMnemonic(privateKeyOrMnemonic) // Client-side, returns raw keys
          newWalletDB = await importWalletToDB(
            dbUser.id,
            walletName,
            walletData.address,
            walletData.privateKey,
            walletData.mnemonic,
            derivationPath,
          )
        }

        if (!newWalletDB) {
          throw new Error("Failed to import wallet")
        }

        const newWallet: Wallet = {
          id: newWalletDB.id.toString(),
          address: newWalletDB.address,
          isActive: true,
          name: newWalletDB.name,
          encrypted_private_key: newWalletDB.encrypted_private_key,
          encrypted_mnemonic: newWalletDB.encrypted_mnemonic,
        }

        // Update the wallets array and set the new wallet as active
        setWallets((prev) => {
          const updatedWallets = [...prev, newWallet]
          return updatedWallets.map((w) => ({
            ...w,
            isActive: w.id === newWallet.id,
          }))
        })
        setActiveWallet(newWallet)
      } else {
        // Import from mnemonic
        walletData = importWalletFromMnemonic(privateKeyOrMnemonic)

        // Save to database
        // const newWalletDB = await importWalletToDB(
        //   dbUser ? dbUser.id : 0,
        //   walletData.address,
        //   walletData.privateKey,
        //   walletData.mnemonic,
        // )
        if (!dbUser?.id) throw new Error("User not authenticated for wallet import")
        const walletName = "Imported Wallet" // Or prompt user
        const derivationPath = "m/44'/60'/0'/0/0" // Or determine appropriately

        let newWalletDB
        if (privateKeyOrMnemonic.startsWith("0x") && privateKeyOrMnemonic.length === 66) {
          const walletData = importWalletFromPrivateKey(privateKeyOrMnemonic) // This is client-side, returns raw keys
          newWalletDB = await importWalletToDB(
            dbUser.id,
            walletName,
            walletData.address,
            walletData.privateKey,
            null,
            derivationPath,
          )
        } else {
          const walletData = importWalletFromMnemonic(privateKeyOrMnemonic) // Client-side, returns raw keys
          newWalletDB = await importWalletToDB(
            dbUser.id,
            walletName,
            walletData.address,
            walletData.privateKey,
            walletData.mnemonic,
            derivationPath,
          )
        }

        if (!newWalletDB) {
          throw new Error("Failed to import wallet")
        }

        const newWallet: Wallet = {
          id: newWalletDB.id.toString(),
          address: newWalletDB.address,
          isActive: true,
          name: newWalletDB.name,
          encrypted_private_key: newWalletDB.encrypted_private_key,
          encrypted_mnemonic: newWalletDB.encrypted_mnemonic,
        }

        // Update the wallets array and set the new wallet as active
        setWallets((prev) => {
          const updatedWallets = [...prev, newWallet]
          return updatedWallets.map((w) => ({
            ...w,
            isActive: w.id === newWallet.id,
          }))
        })
        setActiveWallet(newWallet)
      }

      setIsLoading(false)
    } catch (err) {
      setError("Failed to import wallet")
      setIsLoading(false)
      console.error(err)
    }
  }

  // Set the active wallet
  const handleSetActiveWallet = async (walletId: string) => {
    try {
      if (!dbUser && !isAuthenticated) {
        logActivity("Setting active wallet without authentication")
      }

      setIsLoading(true)

      // Update in database if user is authenticated
      if (dbUser) {
        // const success = await setWalletActive(Number.parseInt(walletId), dbUser.id)
        const success = await setWalletActive(walletId, dbUser.id)

        if (!success) {
          throw new Error("Failed to set active wallet")
        }
      }

      // Update in state
      setWallets((prev) =>
        prev.map((wallet) => ({
          ...wallet,
          isActive: wallet.id === walletId,
        })),
      )

      const wallet = wallets.find((w) => w.id === walletId)
      if (wallet) {
        setActiveWallet({
          ...wallet,
          isActive: true,
        })
      }

      setIsLoading(false)
    } catch (err) {
      console.error("Error setting active wallet:", err)
      setIsLoading(false)
    }
  }

  // Get balance for a specific token
  const getBalance = async (tokenAddress?: string) => {
    try {
      if (!activeWallet) return "0"

      setIsLoading(true)

      // Update balance check stats
      setBalanceCheckStats((prev) => ({
        ...prev,
        lastCheck: Date.now(),
        totalChecks: prev.totalChecks + 1,
      }))

      if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
        // Get ETH balance
        try {
          const balance = await getWalletBalance(activeWallet.address)

          // Update token balance in state
          setTokens((prev) => prev.map((token) => (token.isNative ? { ...token, balance } : token)))

          // Update balance check stats
          setBalanceCheckStats((prev) => ({
            ...prev,
            successfulChecks: prev.successfulChecks + 1,
            lastResponse: `ETH balance: ${balance}`,
          }))

          setIsLoading(false)
          return balance
        } catch (err) {
          // Update balance check stats
          setBalanceCheckStats((prev) => ({
            ...prev,
            failedChecks: prev.failedChecks + 1,
            lastError: err.message || "Unknown error",
          }))

          setIsLoading(false)
          throw err
        }
      } else {
        // Get ERC20 token balance
        const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())
        if (!token) {
          setIsLoading(false)
          return "0"
        }

        try {
          const tokenData = await getTokenBalances(activeWallet.address, [tokenAddress])
          const tokenBalance = tokenData.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())

          if (tokenBalance) {
            // Update token balance in state
            setTokens((prev) =>
              prev.map((t) =>
                t.address.toLowerCase() === tokenAddress.toLowerCase() ? { ...t, balance: tokenBalance.balance } : t,
              ),
            )

            // Update balance check stats
            setBalanceCheckStats((prev) => ({
              ...prev,
              successfulChecks: prev.successfulChecks + 1,
              lastResponse: `${token.symbol} balance: ${tokenBalance.balance}`,
            }))

            setIsLoading(false)
            return tokenBalance.balance
          }

          setIsLoading(false)
          return "0"
        } catch (err) {
          // Update balance check stats
          setBalanceCheckStats((prev) => ({
            ...prev,
            failedChecks: prev.failedChecks + 1,
            lastError: err.message || "Unknown error",
          }))

          setIsLoading(false)
          throw err
        }
      }
    } catch (err) {
      setIsLoading(false)
      return "0"
    }
  }

  // Send a transaction
  const sendTransaction = async (to: string, amount: string, tokenAddress: string) => {
    try {
      setIsLoading(true)
      setError(null)

      if (!activeWallet) {
        logActivity("sendTransaction: Critical error - activeWallet object is null.", {}, "error")
        throw new Error("No active wallet selected or available.")
      }
      if (!activeWallet.id) {
        logActivity(
          "sendTransaction: Critical error - activeWallet.id is missing.",
          { walletAddress: activeWallet.address },
          "error",
        )
        throw new Error("Active wallet ID is missing.")
      }
      if (!dbUser) {
        logActivity("sendTransaction: Critical error - dbUser object is null.", {}, "error")
        throw new Error("User data (dbUser) not available for transaction.")
      }
      if (!dbUser.id) {
        logActivity(
          "sendTransaction: Critical error - dbUser.id is missing.",
          { tgFirstName: dbUser.first_name },
          "error",
        )
        throw new Error("User ID (dbUser.id) is missing for transaction.")
      }

      logActivity("sendTransaction: Initial state check", {
        isTelegramAuthenticated: isAuthenticated,
        activeWalletExists: !!activeWallet,
        activeWalletId: activeWallet?.id,
        activeWalletAddress: activeWallet?.address,
        dbUserExists: !!dbUser,
        dbUserId: dbUser?.id,
        dbUserFirstName: dbUser?.first_name,
      })

      // The original combined check can be removed as the individual checks above are more specific.
      // If you want to keep it as a final safeguard:
      // if (!activeWallet.id || !dbUser.id) {
      //   logActivity("sendTransaction: Combined check failed (should have been caught by individual checks).", { activeWalletId: activeWallet.id, dbUserId: dbUser.id }, "error");
      //   throw new Error("Active wallet or user ID is missing (Combined Check).");
      // }

      // Get encrypted private key
      // let encPrivateKey: string | null = null

      // // First try to get from database if user is authenticated
      // if (dbUser) {
      //   const walletDB = await getActiveWallet(dbUser.id)
      //   if (walletDB && walletDB.encrypted_private_key) {
      //     encPrivateKey = walletDB.encrypted_private_key
      //   }
      // }

      // // If not found in database, try to get from cached data
      // if (!encPrivateKey && cachedWalletData && cachedWalletData.walletId === activeWallet.id) {
      //   encPrivateKey = cachedWalletData.encryptedPrivateKey
      // }

      // // If still not found, try to get from localStorage directly
      // if (!encPrivateKey) {
      //   encPrivateKey = localStorage.getItem(`wallet_${activeWallet.id}_privateKey`)
      // }

      // if (!encPrivateKey) {
      //   throw new Error("Wallet private key not found or accessible.")
      // }
      if (!activeWallet?.id || !dbUser?.id) {
        throw new Error("Active wallet or user ID is missing.")
      }

      let encPrivateKey = activeWallet.encrypted_private_key

      if (!encPrivateKey) {
        // If not already on the activeWallet object, fetch it specifically
        logActivity("Encrypted private key not found on activeWallet object, fetching from DB...", {
          walletId: activeWallet.id,
        })
        const walletDetailsFromDB = await getWalletById(activeWallet.id) // getWalletById now returns encrypted keys
        if (walletDetailsFromDB?.encrypted_private_key) {
          encPrivateKey = walletDetailsFromDB.encrypted_private_key
          // Optionally update activeWallet state here if you want to cache it on the object
          setActiveWallet((prev) => (prev ? { ...prev, encrypted_private_key: encPrivateKey } : null))
        } else {
          logActivity("Failed to fetch encrypted private key from DB.", { walletId: activeWallet.id }, "error")
          throw new Error("Could not retrieve encrypted private key for transaction.")
        }
      }

      logActivity(
        "WalletContext: Preparing to decrypt private key for sendTransaction.",
        {
          activeWalletId: activeWallet.id,
          sourceOfEncPrivateKey:
            activeWallet.encrypted_private_key === encPrivateKey
              ? "activeWallet object"
              : "fetched from DB/localStorage/cache",
          encPrivateKeyPreview: encPrivateKey ? encPrivateKey.substring(0, 10) + "..." : "N/A",
          isEncPrivateKeyPresent: !!encPrivateKey,
        },
        "info",
      )

      if (!encPrivateKey) {
        logActivity(
          "WalletContext: CRITICAL - encPrivateKey is null or empty before calling clientDecryptData for sendTransaction.",
          {},
          "error",
        )
        throw new Error("Encrypted private key is missing for send operation.")
      }

      const privateKey = await clientDecryptData(encPrivateKey)

      logActivity(
        "WalletContext: Decryption attempt completed for sendTransaction.",
        {
          activeWalletId: activeWallet.id,
          isPrivateKeyDecrypted: !!privateKey,
          privateKeyPreview: privateKey ? "Exists (not logged)" : "Empty/Failed",
        },
        privateKey ? "info" : "error",
      )

      if (!privateKey) {
        logActivity("WalletContext: Failed to decrypt private key via server for sendTransaction.", {
          walletId: activeWallet.id,
        })
        throw new Error("Failed to decrypt private key.")
      }
      const signer = getSigner(privateKey)

      let txHash
      let tokenSymbol
      let tokenDecimals

      // Check if sending ETH or token
      if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
        // Send ETH
        const result = await sendEth(signer, to, amount) // Pass signer
        txHash = result.hash
        tokenSymbol = "ETH"
        tokenDecimals = 18
      } else {
        // Find token in the list
        const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())
        if (!token) {
          throw new Error("Token not found")
        }

        // Send token
        const result = await sendToken(signer, tokenAddress, to, amount, token.decimals) // Pass signer
        txHash = result.hash
        tokenSymbol = token.symbol
        tokenDecimals = token.decimals
      }

      // Create a transaction record in database if user is authenticated
      let dbTransaction = null
      if (dbUser) {
        dbTransaction = await createTransaction({
          wallet_id: Number.parseInt(activeWallet.id),
          tx_hash: txHash,
          tx_type: "send",
          status: "pending",
          from_address: activeWallet.address,
          to_address: to,
          amount,
          token_address: tokenAddress || "0x0000000000000000000000000000000000000000",
          token_symbol: tokenSymbol,
          confirmations: 0,
        })
      }

      // Create a transaction record for state
      const newTransaction: Transaction = {
        id: dbTransaction ? dbTransaction.id.toString() : Date.now().toString(),
        txHash,
        txType: "send",
        status: "pending",
        fromAddress: activeWallet.address,
        toAddress: to,
        amount,
        tokenId: tokenAddress || "0x0000000000000000000000000000000000000000",
        tokenSymbol,
        tokenAddress,
        fee: "0.001", // This will be updated when the transaction is confirmed
        timestamp: new Date(),
        confirmations: 0,
      }

      // Update the transactions array
      setTransactions((prev) => [newTransaction, ...prev])

      // Start monitoring the transaction
      monitorTransaction(txHash, newTransaction.id)

      setIsLoading(false)
      return txHash
    } catch (err: any) {
      setError(err.message || "Failed to send transaction")
      setIsLoading(false)
      throw err
    }
  }

  // Monitor transaction status
  const monitorTransaction = async (txHash: string, transactionId: string) => {
    try {
      // Check status every 15 seconds
      const interval = setInterval(async () => {
        const status = await getTransactionStatus(txHash)

        // Update transaction status in database if user is authenticated
        if (dbUser) {
          await updateTransactionStatus(
            txHash,
            status.status,
            status.confirmations,
            status.status === "confirmed" ? "0.001" : undefined, // Example fee
          )
        }

        // Update transaction status in state
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === transactionId
              ? {
                  ...tx,
                  status: status.status,
                  confirmations: status.confirmations,
                }
              : tx,
          ),
        )

        // If confirmed or failed, stop monitoring
        if (status.status === "confirmed" || status.status === "failed") {
          clearInterval(interval)

          // Refresh balances after confirmation
          if (status.status === "confirmed") {
            logActivity("Transaction confirmed, refreshing balances", { txHash })
            refreshBalances()

            // Schedule another refresh after a delay to ensure balances are updated
            setTimeout(() => {
              refreshBalances()
            }, 5000)
          }
        }
      }, 15000)

      // Clear interval after 10 minutes (in case transaction is stuck)
      setTimeout(() => clearInterval(interval), 10 * 60 * 1000)
    } catch (error) {
      console.error("Error monitoring transaction:", error)
    }
  }

  // Get swap quote
  const getTokenSwapQuote = async (fromTokenAddress: string, toTokenAddress: string, amount: string) => {
    try {
      setIsLoading(true)
      logActivity("Getting swap quote", { fromTokenAddress, toTokenAddress, amount })

      // Validate input parameters
      if (!fromTokenAddress || !toTokenAddress) {
        const error = "Invalid token addresses"
        logActivity("Swap quote error", { error, fromTokenAddress, toTokenAddress })
        throw new Error(error)
      }

      if (fromTokenAddress === toTokenAddress) {
        const error = "Cannot swap the same token"
        logActivity("Swap quote error", { error, fromTokenAddress, toTokenAddress })
        throw new Error(error)
      }

      // Find tokens in the list - first try in current tokens list
      let fromToken = findTokenByAddress(tokens, fromTokenAddress)
      let toToken = findTokenByAddress(tokens, toTokenAddress)

      // If not found, try in common tokens
      if (!fromToken) {
        const commonToken = COMMON_TOKENS.find((t) => t.address.toLowerCase() === fromTokenAddress.toLowerCase())
        if (commonToken) {
          fromToken = {
            ...commonToken,
            id: commonToken.address.toLowerCase(),
            balance: "0",
          }
        }
      }

      if (!toToken) {
        const commonToken = COMMON_TOKENS.find((t) => t.address.toLowerCase() === toTokenAddress.toLowerCase())
        if (commonToken) {
          toToken = {
            ...commonToken,
            id: commonToken.address.toLowerCase(),
            balance: "0",
          }
        }
      }

      if (!fromToken) {
        const error = `From token not found: ${fromTokenAddress}`
        logActivity("Swap quote error", { error, fromTokenAddress, availableTokens: tokens.map((t) => t.address) })
        throw new Error(error)
      }

      if (!toToken) {
        const error = `To token not found: ${toTokenAddress}`
        logActivity("Swap quote error", { error, toTokenAddress, availableTokens: tokens.map((t) => t.address) })
        throw new Error(error)
      }

      // Log token details for debugging
      logActivity("Found tokens for swap", {
        fromToken: {
          address: fromToken.address,
          symbol: fromToken.symbol,
          decimals: fromToken.decimals,
        },
        toToken: {
          address: toToken.address,
          symbol: toToken.symbol,
          decimals: toToken.decimals,
        },
      })

      // Get swap quote
      const quote = await getSwapQuote({
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        amount,
        fromDecimals: fromToken.decimals,
        toDecimals: toToken.decimals,
        slippageTolerance: 0.5, // Default 0.5%
        deadline: 20, // Default 20 minutes
      })

      // Set swap quote
      const formattedQuote: SwapQuote = {
        fromToken: {
          address: fromToken.address,
          amount,
        },
        toToken: {
          address: toToken.address,
          amount: quote.toToken.amount,
          minAmount: quote.toToken.minAmount,
        },
        executionPrice: quote.executionPrice,
        priceImpact: quote.priceImpact,
      }

      setSwapQuote(formattedQuote)
      logActivity("Swap quote received", { formattedQuote })
      setIsLoading(false)
      return formattedQuote
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get swap quote"
      setError(errorMessage)
      logActivity("Error getting swap quote", {
        error: errorMessage,
        stack: err.stack,
        fromTokenAddress,
        toTokenAddress,
        amount,
      })
      setIsLoading(false)
      throw err
    }
  }

  // Execute swap
  const executeTokenSwap = async (quote: SwapQuote, slippageTolerance = 0.5) => {
    try {
      setIsLoading(true)
      setError(null)
      logActivity("Executing swap", { quote, slippageTolerance })

      logActivity("executeTokenSwap: Initial state check", {
        isTelegramAuthenticated: isAuthenticated,
        activeWalletExists: !!activeWallet,
        activeWalletId: activeWallet?.id,
        activeWalletAddress: activeWallet?.address,
        dbUserExists: !!dbUser,
        dbUserId: dbUser?.id,
        dbUserFirstName: dbUser?.first_name,
      })

      if (!activeWallet) {
        logActivity("executeTokenSwap: Critical error - activeWallet object is null.", {}, "error")
        throw new Error("No active wallet selected or available for swap.")
      }
      if (!activeWallet.id) {
        logActivity(
          "executeTokenSwap: Critical error - activeWallet.id is missing.",
          { walletAddress: activeWallet.address },
          "error",
        )
        throw new Error("Active wallet ID is missing for swap.")
      }
      if (!dbUser) {
        logActivity("executeTokenSwap: Critical error - dbUser object is null.", {}, "error")
        throw new Error("User data (dbUser) not available for swap.")
      }
      if (!dbUser.id) {
        logActivity(
          "executeTokenSwap: Critical error - dbUser.id is missing.",
          { tgFirstName: dbUser.first_name },
          "error",
        )
        throw new Error("User ID (dbUser.id) is missing for swap.")
      }

      // The original combined check can be removed as the individual checks above are more specific.
      // If you want to keep it as a final safeguard:
      // if (!activeWallet.id || !dbUser.id) {
      //   logActivity("executeTokenSwap: Combined check failed (should have been caught by individual checks).", { activeWalletId: activeWallet.id, dbUserId: dbUser.id }, "error");
      //   throw new Error("Active wallet or user ID is missing (Combined Check).");
      // }

      if (!activeWallet?.id || !dbUser?.id) {
        throw new Error("Active wallet or user ID is missing.")
      }

      let encPrivateKey = activeWallet.encrypted_private_key

      if (!encPrivateKey) {
        // If not already on the activeWallet object, fetch it specifically
        logActivity("Encrypted private key not found on activeWallet object, fetching from DB...", {
          walletId: activeWallet.id,
        })
        const walletDetailsFromDB = await getWalletById(activeWallet.id) // getWalletById now returns encrypted keys
        if (walletDetailsFromDB?.encrypted_private_key) {
          encPrivateKey = walletDetailsFromDB.encrypted_private_key
          // Optionally update activeWallet state here if you want to cache it on the object
          setActiveWallet((prev) => (prev ? { ...prev, encrypted_private_key: encPrivateKey } : null))
        } else {
          logActivity("Failed to fetch encrypted private key from DB.", { walletId: activeWallet.id }, "error")
          throw new Error("Could not retrieve encrypted private key for transaction.")
        }
      }

      logActivity(
        "WalletContext: Preparing to decrypt private key for swap.",
        {
          activeWalletId: activeWallet.id,
          sourceOfEncPrivateKey:
            activeWallet.encrypted_private_key === encPrivateKey
              ? "activeWallet object"
              : "fetched from DB/localStorage/cache",
          encPrivateKeyPreview: encPrivateKey ? encPrivateKey.substring(0, 10) + "..." : "N/A",
          isEncPrivateKeyPresent: !!encPrivateKey,
        },
        "info",
      )

      if (!encPrivateKey) {
        logActivity(
          "WalletContext: CRITICAL - encPrivateKey is null or empty before calling clientDecryptData for swap.",
          {},
          "error",
        )
        throw new Error("Encrypted private key is missing for swap operation.")
      }

      const privateKey = await clientDecryptData(encPrivateKey)

      logActivity(
        "WalletContext: Decryption attempt completed for swap.",
        {
          activeWalletId: activeWallet.id,
          isPrivateKeyDecrypted: !!privateKey,
          privateKeyPreview: privateKey ? "Exists (not logged)" : "Empty/Failed",
        },
        privateKey ? "info" : "error",
      )

      if (!privateKey) {
        logActivity("WalletContext: Failed to decrypt private key via server for executeTokenSwap.", {
          walletId: activeWallet.id,
        })
        throw new Error("Failed to decrypt private key.")
      }
      const signer = getSigner(privateKey)

      // Find tokens in the list - first try in current tokens list
      let fromToken = findTokenByAddress(tokens, quote.fromToken.address)
      let toToken = findTokenByAddress(tokens, quote.toToken.address)

      // If not found, try in common tokens
      if (!fromToken) {
        const commonToken = COMMON_TOKENS.find((t) => t.address.toLowerCase() === quote.fromToken.address.toLowerCase())
        if (commonToken) {
          fromToken = {
            ...commonToken,
            id: commonToken.address.toLowerCase(),
            balance: "0",
          }
        }
      }

      if (!toToken) {
        const commonToken = COMMON_TOKENS.find((t) => t.address.toLowerCase() === quote.toToken.address.toLowerCase())
        if (commonToken) {
          toToken = {
            ...commonToken,
            id: commonToken.address.toLowerCase(),
            balance: "0",
          }
        }
      }

      if (!fromToken || !toToken) {
        throw new Error("Token not found")
      }

      // Execute swap
      const result = await executeSwap(
        signer, // Pass signer
        {
          fromTokenAddress: fromToken.address,
          toTokenAddress: toToken.address,
          amount: quote.fromToken.amount,
          fromDecimals: fromToken.decimals,
          toDecimals: toToken.decimals,
          slippageTolerance,
          deadline: 20, // 20 minutes
        },
        quote,
      )

      logActivity("Swap executed successfully", { txHash: result.txHash })

      // Create a transaction record in database if user is authenticated
      let dbTransaction = null
      if (dbUser) {
        dbTransaction = await createTransaction({
          wallet_id: Number.parseInt(activeWallet.id),
          tx_hash: result.txHash,
          tx_type: "swap",
          status: "pending",
          from_address: activeWallet.address,
          to_address: activeWallet.address, // Self-swap
          amount: quote.fromToken.amount,
          token_address: fromToken.address,
          token_symbol: `${fromToken.symbol} → ${toToken.symbol}`,
          confirmations: 0,
        })
      }

      // Create a transaction record for state
      const newTransaction: Transaction = {
        id: dbTransaction ? dbTransaction.id.toString() : Date.now().toString(),
        txHash: result.txHash,
        txType: "swap",
        status: "pending",
        fromAddress: activeWallet.address,
        toAddress: activeWallet.address, // Self-swap
        amount: quote.fromToken.amount,
        tokenId: fromToken.id,
        tokenSymbol: `${fromToken.symbol} → ${toToken.symbol}`,
        tokenAddress: fromToken.address,
        fee: "0.001", // This will be updated when the transaction is confirmed
        timestamp: new Date(),
        confirmations: 0,
      }

      // Update the transactions array
      setTransactions((prev) => [newTransaction, ...prev])

      // Start monitoring the transaction
      monitorTransaction(result.txHash, newTransaction.id)

      // Force an immediate balance refresh
      logActivity("Forcing immediate balance refresh after swap")
      await refreshBalances()

      // Schedule additional refreshes to ensure balances are updated
      // Use shorter intervals and more frequent checks
      setTimeout(async () => {
        logActivity("First scheduled balance refresh (2s)")
        await refreshBalances()
      }, 2000)

      setTimeout(async () => {
        logActivity("Second scheduled balance refresh (5s)")
        await refreshBalances()
      }, 5000)

      setTimeout(async () => {
        logActivity("Third scheduled balance refresh (10s)")
        await refreshBalances()
      }, 10000)

      setTimeout(async () => {
        logActivity("Fourth scheduled balance refresh (20s)")
        await refreshBalances()
      }, 20000)

      setIsLoading(false)
      return result.txHash
    } catch (err: any) {
      setError(err.message || "Failed to execute swap")
      logActivity("Swap execution failed", { error: err.message })
      setIsLoading(false)
      throw err
    }
  }

  // Get the transaction history
  const getTransactionHistory = async () => {
    try {
      // Add debug logging for wallet state
      logActivity("Transaction history wallet state check", {
        activeWallet: activeWallet ? activeWallet.address : "null",
        dbUser: dbUser ? dbUser.id : "null",
        isAuthenticated,
      })

      if (!activeWallet) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      // Get transactions from database if user is authenticated
      if (dbUser) {
        const dbTransactions = await getWalletTransactions(Number.parseInt(activeWallet.id))

        // Convert to state format
        const formattedTransactions: Transaction[] = dbTransactions.map((tx) => ({
          id: tx.id.toString(),
          txHash: tx.tx_hash,
          txType: tx.tx_type as "send" | "receive" | "swap",
          status: tx.status as "pending" | "confirmed" | "failed",
          fromAddress: tx.from_address,
          toAddress: tx.to_address,
          amount: tx.amount,
          tokenId: tx.token_address,
          tokenSymbol: tx.token_symbol,
          tokenAddress: tx.token_address,
          fee: tx.fee,
          timestamp: new Date(tx.timestamp),
          confirmations: tx.confirmations,
        }))

        setTransactions(formattedTransactions)
      }

      setIsLoading(false)
    } catch (err) {
      console.error("Error getting transaction history:", err)
      setIsLoading(false)
    }
  }

  return (
    <WalletContext.Provider
      value={{
        wallets,
        activeWallet,
        tokens,
        transactions,
        swapQuote,
        isLoading,
        error,
        balanceCheckStats,
        createNewWallet,
        importWallet,
        setActiveWallet: handleSetActiveWallet,
        getBalance,
        sendTransaction,
        getSwapQuote: getTokenSwapQuote,
        executeSwap: executeTokenSwap,
        refreshBalances,
        getTransactionHistory,
        swapFromToken,
        swapToToken,
        swapFromAmount,
        setSwapFromToken,
        setSwapToToken,
        setSwapFromAmount,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export { useWallet }
