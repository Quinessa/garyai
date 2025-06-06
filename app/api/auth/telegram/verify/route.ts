import { NextResponse } from "next/server"
import { validateTelegramWebAppData } from "@/lib/server/telegram-auth-server"

export async function POST(request: Request) {
  try {
    const { initData } = await request.json()

    if (!initData) {
      return NextResponse.json({ isValid: false, error: "No initData provided" })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is not set")
      return NextResponse.json({ isValid: false, error: "Server configuration error" })
    }

    // Validate the data using the server-side utility
    const isValid = validateTelegramWebAppData(initData, botToken)

    return NextResponse.json({ isValid })
  } catch (error) {
    console.error("Error verifying Telegram data:", error)
    return NextResponse.json({ isValid: false, error: "Verification failed" })
  }
}
