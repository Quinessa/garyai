import { ethers } from "ethers"
import { getERC20Contract, getProvider } from "./blockchain-provider" // Added getProvider

export const sendEth = async (
  signer: ethers.Signer,
  to: string,
  amount: string,
): Promise<ethers.TransactionResponse> => {
  if (typeof amount !== "string" || amount.trim() === "") {
    console.error("sendEth: Invalid or missing amount", amount)
    throw new Error("Invalid or missing amount for sending ETH.")
  }
  const value = ethers.parseEther(amount)

  const tx = await signer.sendTransaction({
    to: to,
    value: value,
  })

  return tx
}

export const sendToken = async (
  signer: ethers.Signer,
  tokenAddress: string,
  to: string,
  amount: string,
  decimals: number,
): Promise<ethers.TransactionResponse> => {
  if (typeof amount !== "string" || amount.trim() === "") {
    console.error("sendToken: Invalid or missing amount", amount)
    throw new Error("Invalid or missing amount for sending token.")
  }
  const value = ethers.parseUnits(amount, decimals)

  const tokenContract = getERC20Contract(tokenAddress, signer)
  const tx = await tokenContract.transfer(to, value)
  return tx
}

// Get transaction status
export async function getTransactionStatus(txHash: string) {
  try {
    const provider = getProvider() // Use the getProvider from blockchain-provider
    const tx = await provider.getTransaction(txHash)

    if (!tx) {
      // If transaction is not found, it might not have been mined yet or is invalid
      return { status: "not_found", confirmations: 0 }
    }

    // Wait for the transaction to be mined to get a receipt
    // A null receipt means it's not mined yet.
    const receipt = await provider.getTransactionReceipt(txHash)

    if (!receipt) {
      return { status: "pending", confirmations: tx.confirmations || 0 }
    }

    // `receipt.status` is 1 for success, 0 for failure.
    // `confirmations` should be available on the receipt once mined.
    return {
      status: receipt.status === 1 ? "confirmed" : "failed",
      confirmations: receipt.confirmations || 0, // Use receipt.confirmations
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    }
  } catch (error: any) {
    console.error(`Error getting transaction status for ${txHash}:`, error)
    // Distinguish between network errors and transaction-specific issues if possible
    if (error.message.includes("transaction not found")) {
      return { status: "not_found", confirmations: 0 }
    }
    // Rethrow or return a generic error status
    // For now, let's return an error status to be handled by the caller
    return { status: "error", message: error.message, confirmations: 0 }
  }
}
