import { ethers } from "ethers"

// Enhance the getProvider function with better error handling and logging
export const getProvider = () => {
  // Use the environment variable for RPC endpoint
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT
  if (!rpcUrl) {
    console.error("[Blockchain] NEXT_PUBLIC_RPC_ENDPOINT environment variable is not set")
    throw new Error("RPC endpoint not configured")
  }

  console.log(`[Blockchain] Initializing provider with RPC endpoint: ${rpcUrl}`)
  try {
    // Add { staticNetwork: true } to the options
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true })

    // Test the provider connection
    provider
      .getNetwork()
      .then((network) => {
        console.log(`[Blockchain] Connected to network: ${network.name} (chainId: ${network.chainId})`)
      })
      .catch((error) => {
        console.error(`[Blockchain] Error connecting to network:`, error)
      })

    return provider
  } catch (error) {
    console.error(`[Blockchain] Error initializing provider:`, error)
    throw new Error(`Failed to initialize provider: ${error.message}`)
  }
}

// Create a wallet instance
export const createWallet = () => {
  return ethers.Wallet.createRandom()
}

// Enhance the getEthBalance function with better error handling and logging
export const getEthBalance = async (address: string) => {
  console.log(`[Blockchain] Getting ETH balance for address: ${address}`)
  try {
    const provider = getProvider()
    console.log(`[Blockchain] Provider initialized, making getBalance call...`)

    const balance = await provider.getBalance(address)
    const formattedBalance = ethers.formatEther(balance)

    console.log(`[Blockchain] ETH balance received: ${formattedBalance} (${balance.toString()} wei)`)
    return formattedBalance
  } catch (error) {
    console.error(`[Blockchain] Error getting ETH balance:`, error)
    throw new Error(`Failed to get ETH balance: ${error.message}`)
  }
}

// Enhance the getTokenBalance function with better error handling and logging
export const getTokenBalance = async (address: string, tokenAddress: string) => {
  console.log(`[Blockchain] Getting token balance for token ${tokenAddress}, address: ${address}`)
  try {
    const provider = getProvider()
    console.log(`[Blockchain] Provider initialized, creating token contract...`)

    // ERC20 token ABI (minimal for balanceOf)
    const abi = ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"]

    const tokenContract = new ethers.Contract(tokenAddress, abi, provider)
    console.log(`[Blockchain] Token contract initialized, making RPC calls...`)

    const balance = await tokenContract.balanceOf(address)
    console.log(`[Blockchain] Raw balance received: ${balance.toString()}`)

    const decimals = await tokenContract.decimals()
    console.log(`[Blockchain] Token decimals: ${decimals}`)

    const formattedBalance = ethers.formatUnits(balance, decimals)
    console.log(`[Blockchain] Formatted balance: ${formattedBalance}`)

    return formattedBalance
  } catch (error) {
    console.error(`[Blockchain] Error getting token balance:`, error)
    throw new Error(`Failed to get token balance: ${error.message}`)
  }
}

// Send ETH transaction
export const sendEth = async (privateKey: string, toAddress: string, amount: string) => {
  const provider = getProvider()
  const wallet = new ethers.Wallet(privateKey, provider)

  const tx = {
    to: toAddress,
    value: ethers.parseEther(amount),
  }

  const transaction = await wallet.sendTransaction(tx)
  return transaction.hash
}

// Send token transaction
export const sendToken = async (privateKey: string, tokenAddress: string, toAddress: string, amount: string) => {
  const provider = getProvider()
  const wallet = new ethers.Wallet(privateKey, provider)

  // ERC20 token ABI (minimal for transfer)
  const abi = ["function transfer(address to, uint amount) returns (bool)", "function decimals() view returns (uint8)"]

  const tokenContract = new ethers.Contract(tokenAddress, abi, provider)
  const decimals = await tokenContract.decimals()
  const parsedAmount = ethers.parseUnits(amount, decimals)

  const transaction = await tokenContract.connect(wallet).transfer(toAddress, parsedAmount)
  return transaction.hash
}

// Get transaction details
export const getTransaction = async (txHash: string) => {
  const provider = getProvider()
  return provider.getTransaction(txHash)
}

// Get transaction receipt
export const getTransactionReceipt = async (txHash: string) => {
  const provider = getProvider()
  return provider.getTransactionReceipt(txHash)
}
