import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// Parser CSV simples que respeita campos entre aspas
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = splitCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// Normaliza qualquer formato de telefone para 55XXXXXXXXXXX
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length >= 10) return '55' + digits
  return null
}

// Extrai todos os telefones de uma linha do Google Contacts
function extractPhones(row: Record<string, string>): string[] {
  const phones: string[] = []
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue
    // Google Contacts usa "Phone X - Value" ou "Phone" ou "Mobile"
    if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('mobile') || key.toLowerCase().includes('tel')) {
      const normalized = normalizePhone(value)
      if (normalized) phones.push(normalized)
    }
  }
  return phones
}

// Extrai nome da linha do Google Contacts
function extractName(row: Record<string, string>): string {
  if (row['Name'] && row['Name'].trim()) return row['Name'].trim()
  const first = (row['First Name'] || row['Given Name'] || '').trim()
  const last = (row['Last Name'] || row['Family Name'] || '').trim()
  return [first, last].filter(Boolean).join(' ')
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV vazio ou inválido' }, { status: 400 })

  // Busca instância ativa
  const { data: instRows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = instRows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  // Busca todos os contatos da instância
  const { data: contacts } = await supabaseAdmin()
    .from('contacts')
    .select('id, remote_jid, name')
    .eq('instance_id', inst.id)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'Nenhum contato para atualizar. Sincronize primeiro.' }, { status: 400 })
  }

  // Mapa: número normalizado → id do contato
  const jidMap = new Map<string, string>()
  for (const c of contacts) {
    const digits = c.remote_jid.replace('@s.whatsapp.net', '')
    jidMap.set(digits, c.id)
  }

  // Processa CSV e monta updates
  const updates: { id: string; name: string }[] = []
  for (const row of rows) {
    const name = extractName(row)
    if (!name) continue
    const phones = extractPhones(row)
    for (const phone of phones) {
      const contactId = jidMap.get(phone)
      if (contactId) {
        updates.push({ id: contactId, name })
        break // um match por contato do CSV é suficiente
      }
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      csv_rows: rows.length,
      message: 'Nenhum número do CSV coincidiu com os contatos. Verifique se sincronizou os contatos primeiro.',
    })
  }

  // Atualiza em lotes
  const BATCH = 100
  let updated = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await Promise.all(
      batch.map(u =>
        supabaseAdmin().from('contacts').update({ name: u.name }).eq('id', u.id)
      )
    )
    updated += batch.length
  }

  return NextResponse.json({
    ok: true,
    updated,
    csv_rows: rows.length,
    not_matched: rows.length - updated,
  })
}
