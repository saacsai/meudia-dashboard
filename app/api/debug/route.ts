import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GEMINI_API_KEY
  return NextResponse.json({
    gemini_key_set: !!key,
    gemini_key_prefix: key ? key.slice(0, 12) : 'UNDEFINED',
    gemini_key_length: key?.length ?? 0,
  })
}
