import { getSupabaseClient } from "../supabase-client"

// Types
export interface TransactionDB {
  id: number
  wallet_id: number
  tx_hash: string
  tx_type: "send" | "receive" | "swap"
  status: "pending" | "confirmed" | "failed"
  from_address: string
  to_address: string
  amount: string
  token_address: string
  token_symbol?: string
  fee?: string
  confirmations: number
  timestamp: string
}

// Create a new transaction
export async function createTransaction(
  transaction: Omit<TransactionDB, "id" | "timestamp">,
): Promise<TransactionDB | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        ...transaction,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error creating transaction:", error)
    return null
  }
}

// Update transaction status
export async function updateTransactionStatus(
  txHash: string,
  status: "pending" | "confirmed" | "failed",
  confirmations: number,
  fee?: string,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    const updateData: any = { status, confirmations }
    if (fee) updateData.fee = fee

    const { error } = await supabase.from("transactions").update(updateData).eq("tx_hash", txHash)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Error updating transaction status:", error)
    return false
  }
}

// Get transactions for a wallet
export async function getWalletTransactions(walletId: number): Promise<TransactionDB[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("timestamp", { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting wallet transactions:", error)
    return []
  }
}

// Get transaction by hash
export async function getTransactionByHash(txHash: string): Promise<TransactionDB | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.from("transactions").select("*").eq("tx_hash", txHash).single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error getting transaction by hash:", error)
    return null
  }
}
