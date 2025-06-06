import CryptoJS from "crypto-js"
import { createClient } from "@supabase/supabase-js"
import { logActivity } from "@/lib/services/activity-logger"

// Cache for encryption key to avoid repeated database queries
let cachedEncryptionKey: string | null = null

const getSupabaseServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration for server operations")
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

const getEncryptionKey = async (): Promise<string> => {
  // Return cached key if available
  if (cachedEncryptionKey) {
    logActivity("Using cached encryption key")
    return cachedEncryptionKey
  }

  // Try environment variable first
  const envKey = process.env.ENCRYPTION_KEY
  if (envKey && envKey.trim()) {
    cachedEncryptionKey = envKey.trim()
    logActivity("Using encryption key from environment variable", {
      keyLength: cachedEncryptionKey.length,
      keyPreview: cachedEncryptionKey.substring(0, 8) + "...",
    })
    return cachedEncryptionKey
  }

  // Fallback to database
  try {
    logActivity("Environment key not found, trying database fallback")
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "encryption_key").single()

    if (error) {
      logActivity("Failed to fetch encryption key from database", { error: error.message })
      throw new Error(`Failed to fetch encryption key from database: ${error.message}`)
    }

    if (!data?.value) {
      logActivity("No encryption key found in database")
      throw new Error("No encryption key found in database")
    }

    cachedEncryptionKey = data.value.trim()
    logActivity("Using encryption key from database", {
      keyLength: cachedEncryptionKey.length,
      keyPreview: cachedEncryptionKey.substring(0, 8) + "...",
    })
    return cachedEncryptionKey
  } catch (error: any) {
    logActivity("Error accessing database for encryption key", { error: error.message })
    throw new Error(`Unable to retrieve encryption key: ${error.message}`)
  }
}

export const encryptData = async (data: string): Promise<string> => {
  if (!data || typeof data !== "string") {
    logActivity("Encryption failed: Invalid data provided", { dataType: typeof data, hasData: !!data })
    throw new Error("Invalid data provided for encryption")
  }

  try {
    const encryptionKey = await getEncryptionKey()
    const encrypted = CryptoJS.AES.encrypt(data, encryptionKey).toString()

    if (!encrypted) {
      throw new Error("Encryption process failed - empty result")
    }

    logActivity("Data encrypted successfully on server", {
      dataLength: data.length,
      encryptedLength: encrypted.length,
      encryptedPreview: encrypted.substring(0, 20) + "...",
    })
    return encrypted
  } catch (error: any) {
    logActivity("Server-side encryption failed", { error: error.message, stack: error.stack })
    throw new Error(`Server-side encryption failed: ${error.message}`)
  }
}

export const decryptData = async (encryptedData: string): Promise<string> => {
  if (!encryptedData || typeof encryptedData !== "string") {
    logActivity("Decryption failed: Invalid encrypted data provided", {
      dataType: typeof encryptedData,
      hasData: !!encryptedData,
    })
    throw new Error("Invalid encrypted data provided for decryption")
  }

  logActivity("Starting decryption process", {
    encryptedDataLength: encryptedData.length,
    encryptedDataPreview: encryptedData.substring(0, 20) + "...",
    startsWithExpectedPrefix: encryptedData.startsWith("U2FsdGVkX1"),
  })

  try {
    const encryptionKey = await getEncryptionKey()

    logActivity("Encryption key retrieved for decryption", {
      keyLength: encryptionKey.length,
      keyPreview: encryptionKey.substring(0, 8) + "...",
    })

    // Perform decryption
    const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)

    logActivity("Decryption process completed", {
      decryptedLength: decrypted.length,
      hasDecryptedData: !!decrypted,
      decryptedPreview: decrypted ? decrypted.substring(0, 10) + "..." : "EMPTY",
    })

    if (!decrypted) {
      logActivity("Decryption failed: Empty result (wrong key or corrupted data)", {
        encryptedDataPreview: encryptedData.substring(0, 20),
        encryptedDataLength: encryptedData.length,
        keyUsedLength: encryptionKey.length,
      })
      throw new Error("Decryption failed - key mismatch or corrupted data")
    }

    logActivity("Data decrypted successfully on server", {
      decryptedLength: decrypted.length,
      encryptedDataLength: encryptedData.length,
    })
    return decrypted
  } catch (error: any) {
    logActivity("Server-side decryption failed", {
      error: error.message,
      stack: error.stack,
      encryptedDataPreview: encryptedData.substring(0, 20),
    })
    throw new Error(`Server-side decryption failed: ${error.message}`)
  }
}

// Health check function for testing
export const testEncryptionSystem = async (): Promise<boolean> => {
  try {
    logActivity("Starting encryption system health check")
    const testData = "test-private-key-12345"
    const encrypted = await encryptData(testData)
    const decrypted = await decryptData(encrypted)

    const success = decrypted === testData
    logActivity("Encryption system health check completed", {
      success,
      testDataLength: testData.length,
      encryptedLength: encrypted.length,
      decryptedLength: decrypted.length,
      dataMatches: success,
    })
    return success
  } catch (error: any) {
    logActivity("Encryption system health check failed", { error: error.message, stack: error.stack })
    return false
  }
}
