import { NextResponse } from 'next/server'
import { encryptData } from '@/lib/server/encryption-utils'
import '@/lib/env'

export async function POST(request: Request) {
  try {
    const { data } = await request.json()
    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }
    const encryptedData = await encryptData(data)
    return NextResponse.json({ encryptedData })
  } catch (error) {
    return NextResponse.json({ error: 'Encryption failed' }, { status: 500 })
  }
}

