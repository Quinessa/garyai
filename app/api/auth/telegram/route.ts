import { NextResponse } from "next/server"
import { validateTelegramWebAppData, extractUserFromInitData } from "@/lib/server/telegram-auth-server"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { initData } = data

    if (!initData) {
      return NextResponse.json({ success: false, error: "No initData provided" }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ success: false, error: "Bot token not configured" }, { status: 500 })
    }

    // Validate the data
    const isValid = validateTelegramWebAppData(initData, botToken)
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Invalid authentication data" }, { status: 403 })
    }

    // Extract the user data
    const user = extractUserFromInitData(initData)
    if (!user) {
      return NextResponse.json({ success: false, error: "No user data found" }, { status: 400 })
    }

    // In a real app, you would:
    // 1. Create or retrieve the user in your database
    // 2. Generate a JWT or session token
    // 3. Return user data and token

    return NextResponse.json({
      success: true,
      user,
      // token: 'your-jwt-token'
    })
  } catch (error) {
    console.error("Authentication error:", error)
    return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 500 })
  }
}
