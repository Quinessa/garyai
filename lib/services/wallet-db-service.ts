import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types" // Assuming you have this from Supabase generation
// Define a local Wallet type if not already globally defined and matching this structure
type Wallet = {
  id: string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
  address: string
  privateKey?: string // Should be raw, for temporary use before encryption or after decryption
  mnemonic?: string // Should be raw
  encrypted_private_key?: string
  encrypted_mnemonic?: string
  derivationPath?: string | null
  isActive: boolean
}

import { v4 as uuidv4 } from "uuid"
import { encryptData } from "@/lib/server/encryption-utils" // Server-side encryption
import { logActivity } from "./activity-logger"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Ensure Supabase client is initialized correctly
if (!supabaseUrl || !supabaseKey) {
  logActivity("Supabase URL or Key is missing. DB service will not function.", {}, "error")
}
const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export async function createWalletInDB(
  userId: string,
  walletName: string,
  address: string,
  rawPrivateKey: string,
  rawMnemonic: string | null,
  derivationPath: string | null,
): Promise<Wallet> {
  logActivity("DB: Attempting to create wallet in DB", { userId, walletName, address })
  if (!rawPrivateKey) {
    logActivity("DB: Cannot encrypt null or empty private key during wallet creation.", { userId }, "error")
    throw new Error("Generated private key is invalid for encryption.")
  }
  const encryptedPrivateKey = encryptData(rawPrivateKey)
  const encryptedMnemonic = rawMnemonic ? encryptData(rawMnemonic) : null

  const newWalletId = uuidv4()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("wallets")
    .insert([
      {
        id: newWalletId,
        user_id: userId,
        name: walletName,
        created_at: now,
        updated_at: now,
        address: address,
        encrypted_private_key: encryptedPrivateKey,
        encrypted_mnemonic: encryptedMnemonic,
        derivation_path: derivationPath,
        is_active: false, // New wallets are not active by default, let user choose
      },
    ])
    .select()
    .single()

  if (error || !data) {
    logActivity("DB: Error creating wallet in DB", { userId, error: error?.message }, "error")
    throw new Error(`Failed to create wallet in database: ${error?.message}`)
  }

  logActivity("DB: Wallet created successfully in DB", { walletId: data.id, userId })
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || "Unnamed Wallet",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    address: data.address,
    // Return raw keys only if absolutely necessary and handled securely immediately after
    // For this context, we assume they are needed temporarily by the calling function
    privateKey: rawPrivateKey,
    mnemonic: rawMnemonic || undefined,
    derivationPath: data.derivation_path,
    isActive: data.is_active,
    encrypted_private_key: data.encrypted_private_key, // also return encrypted versions
    encrypted_mnemonic: data.encrypted_mnemonic || undefined,
  }
}

// Renamed from getWalletsByUserId to getUserWallets
export async function getUserWallets(userId: string): Promise<Wallet[]> {
  logActivity("DB: Fetching wallets for user", { userId })
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    logActivity("DB: Error fetching wallets by user ID", { userId, error: error.message }, "error")
    throw new Error(`Failed to fetch wallets from database: ${error.message}`)
  }

  if (!data) {
    logActivity("DB: No wallets found for user", { userId })
    return []
  }

  logActivity("DB: Successfully fetched wallets for user", { userId, count: data.length })
  return data.map((wallet) => ({
    id: wallet.id,
    userId: wallet.user_id,
    name: wallet.name || "Unnamed Wallet",
    createdAt: wallet.created_at,
    updatedAt: wallet.updated_at,
    address: wallet.address,
    // Private keys and mnemonics are not returned here for security.
    // They should be fetched and decrypted on demand.
    encrypted_private_key: wallet.encrypted_private_key,
    encrypted_mnemonic: wallet.encrypted_mnemonic || undefined,
    derivationPath: wallet.derivation_path,
    isActive: wallet.is_active,
  }))
}

export async function getWalletById(walletId: string): Promise<Wallet | null> {
  logActivity("DB: Fetching wallet by ID", { walletId })
  const { data, error } = await supabase.from("wallets").select("*").eq("id", walletId).single()

  if (error) {
    logActivity("DB: Error fetching wallet by ID", { walletId, error: error.message }, "error")
    // If error is "PGRST116" (JSON object requested, multiple (or no) rows returned), it means not found or too many.
    if (error.code === "PGRST116") return null
    throw new Error(`Failed to fetch wallet from database: ${error.message}`)
  }

  if (!data) {
    logActivity("DB: Wallet not found by ID", { walletId })
    return null
  }

  logActivity("DB: Successfully fetched wallet by ID", { walletId })
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || "Unnamed Wallet",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    address: data.address,
    encrypted_private_key: data.encrypted_private_key,
    encrypted_mnemonic: data.encrypted_mnemonic || undefined,
    derivationPath: data.derivation_path,
    isActive: data.is_active,
  }
}

export async function updateWalletInDB(
  walletId: string,
  updates: Partial<
    Omit<
      Wallet,
      "id" | "userId" | "createdAt" | "privateKey" | "mnemonic" | "encrypted_private_key" | "encrypted_mnemonic"
    >
  >,
): Promise<Wallet | null> {
  logActivity("DB: Updating wallet in DB", { walletId, updates })
  const { data, error } = await supabase
    .from("wallets")
    .update({
      name: updates.name,
      // address: updates.address, // Address typically doesn't change post-creation
      updated_at: new Date().toISOString(),
      derivation_path: updates.derivationPath,
      is_active: updates.isActive,
    })
    .eq("id", walletId)
    .select()
    .single()

  if (error || !data) {
    logActivity("DB: Error updating wallet in DB", { walletId, error: error?.message }, "error")
    return null
  }

  logActivity("DB: Wallet updated successfully in DB", { walletId })
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || "Unnamed Wallet",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    address: data.address,
    encrypted_private_key: data.encrypted_private_key,
    encrypted_mnemonic: data.encrypted_mnemonic || undefined,
    derivationPath: data.derivation_path,
    isActive: data.is_active,
  }
}

export async function deleteWalletFromDB(walletId: string): Promise<boolean> {
  logActivity("DB: Deleting wallet from DB", { walletId })
  const { error } = await supabase.from("wallets").delete().eq("id", walletId)

  if (error) {
    logActivity("DB: Error deleting wallet from DB", { walletId, error: error.message }, "error")
    return false
  }

  logActivity("DB: Wallet deleted successfully from DB", { walletId })
  return true
}

export async function setWalletActive(walletId: string, userId: string): Promise<boolean> {
  logActivity("DB: Setting wallet active", { walletId, userId })
  const { error: resetError } = await supabase.from("wallets").update({ is_active: false }).eq("user_id", userId)

  if (resetError) {
    logActivity("DB: Error resetting active wallets", { userId, error: resetError.message }, "error")
    return false
  }

  const { error: setError } = await supabase
    .from("wallets")
    .update({ is_active: true })
    .eq("id", walletId)
    .eq("user_id", userId)

  if (setError) {
    logActivity("DB: Error setting wallet active", { walletId, userId, error: setError.message }, "error")
    return false
  }

  logActivity("DB: Wallet set active successfully", { walletId, userId })
  return true
}

export async function getActiveWallet(userId: string): Promise<Wallet | null> {
  logActivity("DB: Fetching active wallet for user", { userId })
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single() // Expects one active wallet

  if (error) {
    // "PGRST116" means no rows found or multiple rows, which is okay for "no active wallet"
    if (error.code === "PGRST116") {
      logActivity("DB: No active wallet found for user or multiple active (should not happen)", { userId })
      return null
    }
    logActivity("DB: Error fetching active wallet", { userId, error: error.message }, "error")
    throw new Error(`Failed to fetch active wallet: ${error.message}`)
  }

  if (!data) {
    logActivity("DB: No active wallet found for user (data is null)", { userId })
    return null
  }

  logActivity("DB: Active wallet fetched successfully", { userId, walletId: data.id })
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || "Unnamed Wallet",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    address: data.address,
    encrypted_private_key: data.encrypted_private_key,
    encrypted_mnemonic: data.encrypted_mnemonic || undefined,
    derivationPath: data.derivation_path,
    isActive: data.is_active,
  }
}

export async function importWalletToDB(
  userId: string,
  walletName: string,
  address: string,
  rawPrivateKey: string,
  rawMnemonic: string | null,
  derivationPath: string | null,
): Promise<Wallet> {
  logActivity("DB: Importing wallet to DB", { userId, walletName, address })

  if (!rawPrivateKey) {
    logActivity("DB: Cannot encrypt null or empty private key during import.", { userId }, "error")
    throw new Error("Provided private key is invalid for encryption.")
  }
  const encryptedPrivateKey = encryptData(rawPrivateKey)
  const encryptedMnemonic = rawMnemonic ? encryptData(rawMnemonic) : null

  const newWalletId = uuidv4()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("wallets")
    .insert([
      {
        id: newWalletId,
        user_id: userId,
        name: walletName,
        created_at: now,
        updated_at: now,
        address: address,
        encrypted_private_key: encryptedPrivateKey,
        encrypted_mnemonic: encryptedMnemonic,
        derivation_path: derivationPath,
        is_active: false, // Imported wallets are not active by default
      },
    ])
    .select()
    .single()

  if (error || !data) {
    logActivity("DB: Error importing wallet to DB", { userId, error: error?.message }, "error")
    throw new Error(`Failed to import wallet to database: ${error?.message}`)
  }

  logActivity("DB: Wallet imported successfully to DB", { walletId: data.id, userId })
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || "Unnamed Wallet",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    address: data.address,
    privateKey: rawPrivateKey,
    mnemonic: rawMnemonic || undefined,
    derivationPath: data.derivation_path,
    isActive: data.is_active,
    encrypted_private_key: data.encrypted_private_key,
    encrypted_mnemonic: data.encrypted_mnemonic || undefined,
  }
}

// New function to fetch encrypted private key
export async function getEncryptedPrivateKey(walletId: string, userId: string): Promise<string | null> {
  logActivity("DB: Fetching encrypted private key", { walletId, userId })
  const { data, error } = await supabase
    .from("wallets")
    .select("encrypted_private_key")
    .eq("id", walletId)
    .eq("user_id", userId) // Ensure user owns the wallet
    .single()

  if (error || !data) {
    logActivity(
      "DB: Error fetching encrypted private key or not found",
      { walletId, userId, error: error?.message },
      "error",
    )
    return null
  }
  logActivity("DB: Encrypted private key fetched", { walletId, userId })
  return data.encrypted_private_key
}
