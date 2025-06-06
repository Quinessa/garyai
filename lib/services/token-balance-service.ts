import { getAllTokenBalances } from "../services/blockchain-provider"
import { logActivity } from "./activity-logger"

// Common ERC20 tokens on Ethereum mainnet
const COMMON_TOKENS = [
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoUrl: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    logoUrl: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
  },
]

// Add a new function to get all token balances including detected ones
export async function getAllTokensWithBalances(walletAddress: string): Promise<any[]> {
  try {
    logActivity("Getting all tokens with balances", { walletAddress })

    // Get token balances from blockchain
    const tokenBalances = await getAllTokenBalances(walletAddress)

    // Log the results
    logActivity("Retrieved token balances", {
      count: tokenBalances.length,
      tokens: tokenBalances.map((t) => `${t.symbol}: ${t.balance}`),
    })

    // Make sure all common tokens are included even if they have zero balance
    const commonTokenAddresses = COMMON_TOKENS.map((t) => t.address.toLowerCase())
    const existingTokenAddresses = tokenBalances.map((t) => t.address.toLowerCase())

    // Find common tokens that are missing from the results
    const missingCommonTokens = COMMON_TOKENS.filter(
      (commonToken) => !existingTokenAddresses.includes(commonToken.address.toLowerCase()),
    )

    // Add missing common tokens with zero balance
    if (missingCommonTokens.length > 0) {
      logActivity("Adding missing common tokens", {
        count: missingCommonTokens.length,
        tokens: missingCommonTokens.map((t) => t.symbol),
      })

      missingCommonTokens.forEach((token) => {
        tokenBalances.push({
          ...token,
          balance: "0",
        })
      })
    }

    return tokenBalances
  } catch (error) {
    logActivity("Error getting tokens with balances", { error: error.message })
    console.error("Error in getAllTokensWithBalances:", error)

    // Return at least the common tokens as a fallback
    return COMMON_TOKENS.map((token) => ({
      ...token,
      balance: "0",
    }))
  }
}

// Function to find a token by address
export function findTokenByAddress(tokens: any[], address: string): any | undefined {
  if (!address) return undefined

  return tokens.find((token) => token.address.toLowerCase() === address.toLowerCase())
}

// Function to find a token by symbol
export function findTokenBySymbol(tokens: any[], symbol: string): any | undefined {
  if (!symbol) return undefined

  return tokens.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase())
}
