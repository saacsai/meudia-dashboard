'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Contact {
  id: string
  name: string | null
  remote_jid: string
  priority: string
  auto_score: number
  msg_count_30d: number
  last_interaction: string | null
  classified_manually: boolean
}

const PRIORITY_LABEL: Record<string, string> = {
  priority: 'Prioridade',
  normal: 'Normal',
  muted: 'Silenciado',
}

const PRIORITY_COLOR: Record<string, string> = {
  priority: '#2A5F6B',
  normal: '#6b7280',
  muted: '#d1d5db',
}

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token || ''
}

function formatJid(jid: string): string {
  const digits = jid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length === 13)
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  if (digits.startsWith('55') && digits.length === 12)
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  return `+${digits}`
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'priority' | 'normal' | 'muted'>('all')
  const [saving, setSaving] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ total: number; priority: number; normal: number; muted: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/contatos', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setContacts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function syncContacts() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    const token = await getToken()
    const res = await fetch('/api/contatos/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok) {
      setSyncResult(data)
      await loadData()
    } else {
      setSyncError(data.error + (data.debug ? ` | ${JSON.stringify(data.debug)}` : ''))
    }
    setSyncing(false)
  }

  async function setPriority(contactId: string, priority: string) {
    setSaving(contactId)
    const token = await getToken()
    const res = await fetch('/api/contatos', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contactId, priority }),
    })
    const data = await res.json()
    if (data.id) {
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data } : c))
    }
    setSaving(null)
  }

  const filtered = contacts.filter(c => {
    const matchSearch = (c.name || c.remote_jid).toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.priority === filter
    return matchSearch && matchFilter
  })

  const counts = {
    all: contacts.length,
    priority: contacts.filter(c => c.priority === 'priority').length,
    normal: contacts.filter(c => c.priority === 'normal').length,
    muted: contacts.filter(c => c.priority === 'muted').length,
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Barra superior: filtros + sync */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={syncContacts}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-colors flex-shrink-0"
          style={{ backgroundColor: PRIMARY }}
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              Sincronizando…
            </>
          ) : 'Sincronizar contatos'}
        </button>
        {syncResult && (
          <p className="text-xs text-gray-500">
            {syncResult.total} importados — <span style={{ color: PRIMARY }}>{syncResult.priority} prioridade</span> · {syncResult.normal} normal · {syncResult.muted} silenciado
          </p>
        )}
        {syncError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-md break-all">{syncError}</p>
        )}
      </div>

      {/* Filtros por prioridade */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'priority', 'normal', 'muted'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
            style={filter === f
              ? { backgroundColor: PRIMARY, color: '#fff', borderColor: PRIMARY }
              : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            {f === 'all' ? 'Todos' : PRIORITY_LABEL[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Busca */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar contato…"
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors bg-white"
        onFocus={e => (e.target.style.borderColor = PRIMARY)}
        onBlur={e => (e.target.style.borderColor = '')}
      />

      {/* Lista */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-2">
          <p className="text-sm font-medium text-gray-700">Nenhum contato ainda</p>
          <p className="text-xs text-gray-400">Os contatos aparecem aqui quando alguém te enviar uma mensagem pelo WhatsApp conectado.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map(contact => {
            const displayName = contact.name || formatJid(contact.remote_jid)
            const initials = displayName[0].toUpperCase()
            const color = PRIORITY_COLOR[contact.priority] || '#9ca3af'

            return (
              <div key={contact.id} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    {contact.classified_manually && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 font-medium flex-shrink-0">manual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{contact.remote_jid}</p>
                </div>

                {/* Msgs */}
                <div className="text-center hidden sm:block flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">{contact.msg_count_30d ?? 0}</p>
                  <p className="text-xs text-gray-400">msgs/30d</p>
                </div>

                {/* Priority selector */}
                <select
                  value={contact.priority}
                  onChange={e => setPriority(contact.id, e.target.value)}
                  disabled={saving === contact.id}
                  className="border rounded-lg px-2 py-1.5 text-xs font-medium outline-none transition-colors disabled:opacity-50 flex-shrink-0"
                  style={{
                    color,
                    borderColor: contact.classified_manually ? PRIMARY : '#e5e7eb',
                  }}
                >
                  <option value="priority">Prioridade</option>
                  <option value="normal">Normal</option>
                  <option value="muted">Silenciado</option>
                </select>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
