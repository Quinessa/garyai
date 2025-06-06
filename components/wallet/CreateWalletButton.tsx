"use client"

import { useState } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useUI } from "@/contexts/UIContext"
import { Loader2, Plus } from "lucide-react"

export default function CreateWalletButton() {
  const [isCreating, setIsCreating] = useState(false)
  const { createNewWallet, error } = useWallet()
  const { showToast, logActivity } = useUI()

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true)
      logActivity("Creating new wallet")
      await createNewWallet()
      showToast("Wallet created successfully", "success")
      logActivity("Wallet created successfully")
    } catch (err) {
      console.error("Error creating wallet:", err)
      showToast(error || "Failed to create wallet", "error")
      logActivity(`Failed to create wallet: ${error}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <button onClick={handleCreateWallet} disabled={isCreating} className="gary-button flex items-center justify-center">
      {isCreating ? (
        <>
          <Loader2 size={16} className="animate-spin mr-2" />
          Creating...
        </>
      ) : (
        <>
          <Plus size={16} className="mr-2" />
          Create New Wallet
        </>
      )}
    </button>
  )
}
