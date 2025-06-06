// lib/services/wallet-service.ts (MODIFIED - CLIENT-SIDE)
import { ethers } from "ethers"
import { logActivity } from "./activity-logger"
import { getProvider, ERC20_ABI } from "./blockchain-provider"
import type { Token } from "@/contexts/WalletContext"

// Removed: encryptPrivateKey, decryptPrivateKey, encryptMnemonic, decryptMnemonic, getEncryptionKey

// NEW: Client-side functions to call server API for encryption/decryption
export const clientEncryptData = async (data: string): Promise<string> => {
  if (!data) return ""
  try {
    const response = await fetch("/api/wallet/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    })
    if (!response.ok) {
      const errorResult = await response.json()
      logActivity("Client-side encryption call failed", { status: response.status, error: errorResult.error })
      throw new Error(errorResult.error || "Encryption API call failed")
    }
    const result = await response.json()
    return result.encryptedData
  } catch (error: any) {
    logActivity("Error calling encryption API", { error: error.message })
    throw error // Re-throw to be caught by caller
  }
}

export const clientDecryptData = async (encryptedData: string): Promise<string> => {
  if (!encryptedData) return ""
  try {
    const response = await fetch("/api/wallet/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData }),
    })
    if (!response.ok) {
      const errorResult = await response.json()
      logActivity("Client-side decryption call failed", { status: response.status, error: errorResult.error })
      // For decryption failures, especially of private keys, returning an empty string
      // is often a safer default than throwing an error that might expose call stacks.
      // The WalletContext can then check for an empty string.
      return ""
    }
    const result = await response.json()
    return result.data
  } catch (error: any) {
    logActivity("Error calling decryption API", { error: error.message })
    return "" // Return empty string on network or other fetch errors
  }
}

export const createWallet = () => {
  const wallet = ethers.Wallet.createRandom()
  logActivity("New wallet created", { address: wallet.address })
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : null,
  }
}

export const importWalletFromPrivateKey = (privateKey: string) => {
  try {
    const wallet = new ethers.Wallet(privateKey)
    logActivity("Wallet imported from private key", { address: wallet.address })
    // The private key is raw here. Encryption for storage will be handled by wallet-db-service or by calling clientEncryptData.
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: null,
    }
  } catch (error: any) {
    logActivity("Failed to import wallet from private key", { error: error.message })
    throw new Error("Invalid private key")
  }
}

export const importWalletFromMnemonic = (mnemonic: string) => {
  try {
    const wallet = ethers.Wallet.fromPhrase(mnemonic)
    logActivity("Wallet imported from mnemonic", { address: wallet.address })
    // The mnemonic is raw here. Encryption for storage will be handled by wallet-db-service or by calling clientEncryptData.
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: mnemonic,
    }
  } catch (error: any) {
    logActivity("Failed to import wallet from mnemonic", { error: error.message })
    throw new Error("Invalid mnemonic phrase")
  }
}

export const getWalletBalance = async (address: string): Promise<string> => {
  try {
    const provider = getProvider()
    const balance = await provider.getBalance(address)
    return ethers.formatEther(balance)
  } catch (error: any) {
    logActivity("Error fetching wallet balance", { address, error: error.message })
    throw new Error(`Failed to fetch balance: ${error.message}`)
  }
}

export const getTokenBalances = async (
  walletAddress: string,
  tokenAddresses: string[],
): Promise<Array<{ address: string; symbol: string; balance: string; decimals: number; name: string }>> => {
  const provider = getProvider()
  const balances = []

  for (const tokenAddress of tokenAddresses) {
    try {
      if (tokenAddress === ethers.ZeroAddress) {
        // Use ethers.ZeroAddress for clarity
        const ethBalance = await provider.getBalance(walletAddress)
        balances.push({
          address: tokenAddress,
          symbol: "ETH",
          name: "Ethereum",
          balance: ethers.formatEther(ethBalance),
          decimals: 18,
        })
      } else {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
        const [balance, symbol, decimalsBigInt, name] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.symbol(),
          tokenContract.decimals(),
          tokenContract.name(),
        ])
        const decimals = Number(decimalsBigInt)
        balances.push({
          address: tokenAddress,
          symbol,
          name,
          balance: ethers.formatUnits(balance, decimals),
          decimals,
        })
      }
    } catch (error: any) {
      logActivity("Error fetching token balance", { walletAddress, tokenAddress, error: error.message })
      balances.push({ address: tokenAddress, symbol: "N/A", name: "Unknown Token", balance: "0", decimals: 18 })
    }
  }
  return balances
}

export const getTokenDetailsWithBalance = async (
  walletAddress: string,
  tokenAddress: string,
): Promise<Token | null> => {
  const provider = getProvider()
  try {
    if (tokenAddress === ethers.ZeroAddress) {
      const ethBalance = await provider.getBalance(walletAddress)
      return {
        id: tokenAddress,
        address: tokenAddress,
        symbol: "ETH",
        name: "Ethereum",
        decimals: 18,
        balance: ethers.formatEther(ethBalance),
        isNative: true,
        logoUrl: "/images/tokens/eth.png",
      }
    } else {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
      const [balance, symbol, decimalsBigInt, name] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.name(),
      ])
      const decimals = Number(decimalsBigInt)
      return {
        id: tokenAddress.toLowerCase(),
        address: tokenAddress,
        symbol,
        name,
        decimals,
        balance: ethers.formatUnits(balance, decimals),
        isNative: false,
        logoUrl: `/images/tokens/${symbol.toLowerCase()}.png`,
      }
    }
  } catch (error: any) {
    logActivity("Error fetching token details with balance", { walletAddress, tokenAddress, error: error.message })
    return null
  }
}
