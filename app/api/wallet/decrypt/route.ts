import { NextResponse } from 'next/server'
import { decryptData } from '@/lib/server/encryption-utils'
import '@/lib/env'

export async function POST(request: Request) {
  try {
    const { encryptedData } = await request.json()
    if (!encryptedData) {
      return NextResponse.json({ error: 'Missing encryptedData' }, { status: 400 })
    }
    const decryptedData = await decryptData(encryptedData)
    return NextResponse.json({ decryptedData })
  } catch (error) {
    return NextResponse.json({ error: 'Decryption failed' }, { status: 500 })
  }
}

