'use client'

import { useEffect, useState } from 'react'
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

const PRIORITY_COLOR: Record<string, string> = {
  priority: '#2A5F6B',
  normal: '#6b7280',
  muted: '#d1d5db',
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [, setInstanceId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: inst } = await supabase
      .from('instances')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()
    if (!inst) { setLoading(false); return }
    setInstanceId(inst.id)
    const { data } = await supabase
      .from('contacts')
      .select('id, name, remote_jid, priority, auto_score, msg_count_30d, last_interaction, classified_manually')
      .eq('instance_id', inst.id)
      .order('auto_score', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }

  async function setPriority(contactId: string, priority: string) {
    setSaving(contactId)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('contacts')
      .update({ priority, classified_manually: true })
      .eq('id', contactId)
      .select()
      .single()
    if (data) setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data } : c))
    setSaving(null)
  }

  const filtered = contacts.filter(c =>
    (c.name || c.remote_jid).toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar contato…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors bg-white"
          onFocus={e => e.target.style.borderColor = PRIMARY}
          onBlur={e => e.target.style.borderColor = ''}
        />
        <span className="text-xs text-gray-400">{contacts.length} contatos</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">Nenhum contato encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map(contact => (
            <div key={contact.id} className="flex items-center gap-4 px-5 py-4">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: PRIORITY_COLOR[contact.priority] || '#9ca3af' }}
              >
                {(contact.name || contact.remote_jid)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {contact.name || contact.remote_jid}
                </p>
                <p className="text-xs text-gray-400 truncate">{contact.remote_jid}</p>
              </div>

              {/* Score */}
              <div className="text-center hidden sm:block">
                <p className="text-sm font-bold" style={{ color: PRIMARY }}>{Math.round(contact.auto_score)}</p>
                <p className="text-xs text-gray-400">score</p>
              </div>

              {/* Priority selector */}
              <select
                value={contact.priority}
                onChange={e => setPriority(contact.id, e.target.value)}
                disabled={saving === contact.id}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium outline-none transition-colors disabled:opacity-50"
                style={{
                  color: PRIORITY_COLOR[contact.priority],
                  borderColor: contact.classified_manually ? PRIMARY : '',
                }}
              >
                <option value="priority">Prioridade</option>
                <option value="normal">Normal</option>
                <option value="muted">Silenciado</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
