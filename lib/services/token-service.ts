import { getProvider, getERC20Contract, getAllTokenBalances } from "./blockchain-provider"

// Common ERC20 tokens on Ethereum mainnet
export const COMMON_TOKENS = [
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6, // USDT has 6 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6, // USDC has 6 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18, // DAI has 18 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8, // WBTC has 8 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18, // WETH has 18 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  {
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    symbol: "LINK",
    name: "ChainLink Token",
    decimals: 18, // LINK has 18 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18, // UNI has 18 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg",
  },
  {
    address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18, // MATIC has 18 decimals
    logoUrl: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  },
]

// Get token information
export async function getTokenInfo(tokenAddress: string) {
  try {
    const provider = getProvider()
    const tokenContract = getERC20Contract(tokenAddress, provider)

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
    ])

    return {
      address: tokenAddress,
      name,
      symbol,
      decimals,
    }
  } catch (error) {
    console.error(`Error fetching token info for ${tokenAddress}:`, error)
    throw new Error(`Failed to get token info: ${error.message}`)
  }
}

// Detect common tokens in a wallet
export async function detectCommonTokens(walletAddress: string) {
  const provider = getProvider()
  const detectedTokens = []

  for (const token of COMMON_TOKENS) {
    try {
      const tokenContract = getERC20Contract(token.address, provider)
      const balance = await tokenContract.balanceOf(walletAddress)

      if (balance.gt(0)) {
        detectedTokens.push({
          ...token,
          balance: balance.toString(),
        })
      }
    } catch (error) {
      console.error(`Error detecting token ${token.symbol}:`, error)
    }
  }

  return detectedTokens
}

// Add this new function to get all token balances
export async function getAllTokensWithBalances(walletAddress: string) {
  try {
    console.log(`Getting all tokens with balances for wallet: ${walletAddress}`)

    // Get all token addresses from COMMON_TOKENS
    const tokenAddresses = COMMON_TOKENS.map((token) => token.address)

    // Use the enhanced getAllTokenBalances function
    const tokenBalances = await getAllTokenBalances(walletAddress, tokenAddresses)

    console.log(`Found ${tokenBalances.length} tokens with balances`)
    return tokenBalances
  } catch (error) {
    console.error("Error in getAllTokensWithBalances:", error)
    throw error
  }
}
