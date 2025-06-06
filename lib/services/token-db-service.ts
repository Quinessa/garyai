import { getSupabaseClient } from "../supabase-client"
import { COMMON_TOKENS } from "./token-service"

// Types
export interface TokenDB {
  id: number
  address: string
  symbol: string
  name: string
  decimals: number
  logo_url?: string
  is_native: boolean
  created_at: string
}

export interface WalletTokenDB {
  id: number
  wallet_id: number
  token_id: number
  balance: string
  last_updated: string
  token?: TokenDB
}

// Initialize default tokens in the database
export async function initializeDefaultTokens(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    // Add ETH as native token
    const ethToken = {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      logo_url: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
      is_native: true,
    }

    // Insert ETH
    await supabase.from("tokens").upsert(ethToken, { onConflict: "address" })

    // Insert common tokens
    for (const token of COMMON_TOKENS) {
      await supabase.from("tokens").upsert(
        {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logo_url: token.logoUrl,
          is_native: false,
        },
        { onConflict: "address" },
      )
    }

    return true
  } catch (error) {
    console.error("Error initializing default tokens:", error)
    return false
  }
}

// Get all tokens
export async function getAllTokens(): Promise<TokenDB[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("is_native", { ascending: false })
      .order("symbol")

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting all tokens:", error)
    return []
  }
}

// Update token balance for a wallet
export async function updateTokenBalance(walletId: number, tokenId: number, balance: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase.from("wallet_tokens").upsert(
      {
        wallet_id: walletId,
        token_id: tokenId,
        balance,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "wallet_id,token_id" },
    )

    if (error) throw error
    return true
  } catch (error) {
    console.error("Error updating token balance:", error)
    return false
  }
}

// Get token balances for a wallet
export async function getWalletTokenBalances(walletId: number): Promise<WalletTokenDB[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from("wallet_tokens")
      .select(`
        *,
        token:tokens(*)
      `)
      .eq("wallet_id", walletId)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting wallet token balances:", error)
    return []
  }
}
