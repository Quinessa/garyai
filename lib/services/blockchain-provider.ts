import { ethers } from "ethers"

// Alchemy API key for Ethereum mainnet - Consider moving to environment variables
const ALCHEMY_API_KEY = "UFkgWyFWSq2dE-7lk4uHlKyqxzhqhFCT"
const ALCHEMY_RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// ERC20 ABI for token interactions - Standardized to ERC20_ABI (snake_case)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]

export const COMMON_TOKENS = [
  {
    address: ethers.ZeroAddress, // ETH
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    isNative: true,
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    isNative: false,
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isNative: false,
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoUrl: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    isNative: false,
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    logoUrl: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    isNative: false,
  },
]

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ALCHEMY_RPC_URL, "mainnet", { staticNetwork: true })
}

export function getSigner(privateKey: string): ethers.Wallet {
  const provider = getProvider()
  return new ethers.Wallet(privateKey, provider)
}

export function getContract(
  contractAddress: string,
  abi: any,
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(contractAddress, abi, signerOrProvider)
}

export function getERC20Contract(
  tokenAddress: string,
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return getContract(tokenAddress, ERC20_ABI, signerOrProvider)
}

export function formatUnits(value: bigint | string, decimals: number): string {
  return ethers.formatUnits(value, decimals)
}

export function parseUnits(value: string, decimals: number): bigint {
  return ethers.parseUnits(value, decimals)
}

export async function getEthBalance(address: string): Promise<string> {
  const provider = getProvider()
  const balance = await provider.getBalance(address)
  return ethers.formatEther(balance)
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
): Promise<{ balance: string; decimals: number; symbol: string; name: string }> {
  try {
    const provider = getProvider()
    const tokenContract = getERC20Contract(tokenAddress, provider)
    const [balance, decimalsBigInt, symbol, name] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name(),
    ])
    const decimals = Number(decimalsBigInt)
    const formattedBalance = ethers.formatUnits(balance, decimals)
    return { balance: formattedBalance, decimals, symbol, name }
  } catch (error) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error)
    throw error
  }
}

export async function getAllTokenBalances(walletAddress: string, tokenAddresses: string[] = []): Promise<any[]> {
  const provider = getProvider()
  const results = []
  try {
    const ethBalance = await provider.getBalance(walletAddress)
    results.push({
      address: ethers.ZeroAddress,
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      balance: ethers.formatEther(ethBalance),
      isNative: true,
      logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    })
  } catch (error) {
    console.error("Error fetching ETH balance in getAllTokenBalances:", error)
  }

  const allTokenAddresses = [...new Set([...tokenAddresses, ...COMMON_TOKENS.map((t) => t.address)])]
  for (const tokenAddress of allTokenAddresses) {
    if (tokenAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) continue
    try {
      const tokenContract = getERC20Contract(tokenAddress, provider)
      const [balance, decimalsBigInt, symbol, name] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
        tokenContract.symbol(),
        tokenContract.name(),
      ])
      const decimals = Number(decimalsBigInt)
      const formattedBalance = ethers.formatUnits(balance, decimals)
      const commonToken = COMMON_TOKENS.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())
      if (BigInt(balance) > 0n || commonToken) {
        results.push({
          address: tokenAddress,
          symbol,
          name,
          decimals,
          balance: formattedBalance,
          logoUrl: commonToken?.logoUrl,
          isNative: false,
        })
      }
    } catch (error) {
      console.error(`Error checking token ${tokenAddress} in getAllTokenBalances:`, error)
    }
  }
  return results
}

export async function estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
  const provider = getProvider()
  return provider.estimateGas(transaction)
}

export async function getGasPrice(): Promise<bigint> {
  const provider = getProvider()
  const feeData = await provider.getFeeData()
  return feeData.gasPrice || 0n
}

export async function getTransaction(txHash: string) {
  const provider = getProvider()
  return provider.getTransaction(txHash)
}

export async function getTransactionReceipt(txHash: string) {
  const provider = getProvider()
  return provider.getTransactionReceipt(txHash)
}

export async function waitForTransaction(txHash: string) {
  const provider = getProvider()
  return provider.waitForTransaction(txHash)
}
