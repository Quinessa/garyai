import { ethers } from "ethers"
import { logActivity } from "./activity-logger"
// Correctly imports ERC20_ABI (snake_case) from blockchain-provider
import {
  getProvider,
  ERC20_ABI, // Ensure this is ERC20_ABI
  parseUnits as parseBlockchainUnits,
  formatUnits as formatBlockchainUnits,
} from "./blockchain-provider"
// Removed unused decryptPrivateKey import as executeSwap now expects a signer
// import { decryptPrivateKey } from "./wallet-service"; // No longer needed here

// Types from WalletContext or local if not directly from context
interface WalletSigner {
  // Simplified interface for what executeSwap needs
  getAddress(): Promise<string>
  provider: ethers.Provider | null // Assuming signer has a provider
  // Add other methods if executeSwap directly uses more signer methods
}

const UNISWAP_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
]

export const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: ethers.ZeroAddress,
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
}

const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
const WETH_ADDRESS = TOKEN_ADDRESSES.WETH

export interface SwapParams {
  fromTokenAddress: string
  toTokenAddress: string
  amount: string
  fromDecimals?: number
  toDecimals?: number
  slippageTolerance?: number
  deadline?: number
}

export interface SwapQuote {
  fromToken: { address: string; amount: string }
  toToken: { address: string; amount: string; minAmount: string }
  executionPrice: string
  priceImpact: string
}

async function getTokenDecimals(tokenAddress: string, provider: ethers.Provider): Promise<number> {
  if (tokenAddress === TOKEN_ADDRESSES.ETH) return 18
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const decimals = await tokenContract.decimals()
    return Number(decimals)
  } catch (error: any) {
    logActivity(`Error getting token decimals for ${tokenAddress}: ${error.message}`)
    return 18
  }
}

export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  logActivity("Getting swap quote", params)
  const provider = getProvider()
  const router = new ethers.Contract(ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider)

  const fromAddress = params.fromTokenAddress
  const toAddress = params.toTokenAddress
  if (!fromAddress || !toAddress) throw new Error("Invalid token addresses")

  let path: string[]
  if (fromAddress === TOKEN_ADDRESSES.ETH) path = [WETH_ADDRESS, toAddress]
  else if (toAddress === TOKEN_ADDRESSES.ETH) path = [fromAddress, WETH_ADDRESS]
  else path = [fromAddress, WETH_ADDRESS, toAddress]

  const fromDecimals = params.fromDecimals || (await getTokenDecimals(fromAddress, provider))
  const toDecimals = params.toDecimals || (await getTokenDecimals(toAddress, provider))

  const amountIn = parseBlockchainUnits(params.amount, fromDecimals)

  try {
    const amounts = await router.getAmountsOut(amountIn, path)
    const amountOut = amounts[amounts.length - 1]

    const outputAmount = formatBlockchainUnits(amountOut, toDecimals)
    const slippage = params.slippageTolerance || 1
    const minAmountOut = (amountOut * BigInt(10000 - Math.floor(slippage * 100))) / BigInt(10000)
    const minOutputAmount = formatBlockchainUnits(minAmountOut, toDecimals)

    const inputAmountFloat = Number.parseFloat(params.amount)
    const outputAmountFloat = Number.parseFloat(outputAmount)
    const executionPrice = inputAmountFloat > 0 ? (outputAmountFloat / inputAmountFloat).toFixed(6) : "0"

    const quote: SwapQuote = {
      fromToken: { address: fromAddress, amount: params.amount },
      toToken: { address: toAddress, amount: outputAmount, minAmount: minOutputAmount },
      executionPrice,
      priceImpact: "<0.01%",
    }
    logActivity("Swap quote received", { quote })
    return quote
  } catch (error: any) {
    logActivity("Error in getAmountsOut or processing quote", {
      error: error.message,
      path,
      amountIn: amountIn.toString(),
    })
    if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
      throw new Error("Insufficient liquidity for this trade pair.")
    }
    throw new Error(`Failed to get swap quote: ${error.message}`)
  }
}

// executeSwap now expects a signer (ethers.Signer) to be passed from WalletContext
export async function executeSwap(
  signer: ethers.Signer, // Changed from encryptedPrivateKey
  params: SwapParams,
  quote: SwapQuote,
): Promise<any> {
  // Return type can be more specific, e.g., { txHash: string; ... }
  logActivity("Executing swap", { walletAddress: await signer.getAddress(), params })

  const router = new ethers.Contract(ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, signer)
  const walletAddress = await signer.getAddress()

  const fromAddress = params.fromTokenAddress
  const toAddress = params.toTokenAddress

  // Ensure provider is available on the signer for getTokenDecimals
  if (!signer.provider) {
    throw new Error("Signer must have a provider to fetch token decimals for swap execution.")
  }

  const fromDecimals = params.fromDecimals || (await getTokenDecimals(fromAddress, signer.provider))
  const toDecimals = params.toDecimals || (await getTokenDecimals(toAddress, signer.provider))

  const amountIn = parseBlockchainUnits(params.amount, fromDecimals)
  const amountOutMin = parseBlockchainUnits(quote.toToken.minAmount, toDecimals)
  const deadline = Math.floor(Date.now() / 1000) + (params.deadline || 20) * 60

  let tx: ethers.TransactionResponse
  const gasOptions = { gasLimit: 500000n }

  if (fromAddress === TOKEN_ADDRESSES.ETH) {
    tx = await router.swapExactETHForTokens(amountOutMin, [WETH_ADDRESS, toAddress], walletAddress, deadline, {
      ...gasOptions,
      value: amountIn,
    })
  } else {
    const tokenContract = new ethers.Contract(fromAddress, ERC20_ABI, signer)
    const allowance = await tokenContract.allowance(walletAddress, ROUTER_ADDRESS)
    if (allowance < amountIn) {
      logActivity(`Approving router to spend ${params.amount} of ${fromAddress}`)
      const approveTx = await tokenContract.approve(ROUTER_ADDRESS, amountIn, { gasLimit: 100000n })
      await approveTx.wait()
      logActivity(`Approval transaction confirmed: ${approveTx.hash}`)
    }
    if (toAddress === TOKEN_ADDRESSES.ETH) {
      tx = await router.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        [fromAddress, WETH_ADDRESS],
        walletAddress,
        deadline,
        gasOptions,
      )
    } else {
      tx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [fromAddress, WETH_ADDRESS, toAddress],
        walletAddress,
        deadline,
        gasOptions,
      )
    }
  }
  logActivity(`Swap transaction sent: ${tx.hash}`)
  // Wait for the transaction to be mined to get the receipt
  const receipt = await tx.wait()
  if (!receipt) {
    throw new Error("Transaction receipt not found after waiting.")
  }
  logActivity(`Swap executed successfully (tx: ${receipt.hash})`)

  return {
    txHash: receipt.hash,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    inputAmount: params.amount,
    estimatedOutputAmount: quote.toToken.amount, // This is from the quote, actual might differ
    // actualOutputAmount: receipt.logs.... // This would require parsing logs
    etherscanLink: `https://etherscan.io/tx/${receipt.hash}`,
  }
}

export async function validateSwapRequest(params: SwapParams): Promise<{ isValid: boolean; error?: string }> {
  if (!params.fromTokenAddress || !params.toTokenAddress) return { isValid: false, error: "Invalid token addresses." }
  if (params.fromTokenAddress === params.toTokenAddress) return { isValid: false, error: "Cannot swap the same token." }
  if (!params.amount || params.amount.trim() === "" || Number.parseFloat(params.amount) <= 0)
    return { isValid: false, error: "Amount must be greater than 0." }
  if (/[eE]/.test(params.amount))
    return {
      isValid: false,
      error: "Scientific notation (e.g., 1e-5) is not supported for amounts. Please use plain decimal form.",
    }
  return { isValid: true }
}
