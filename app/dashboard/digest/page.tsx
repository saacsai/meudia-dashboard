'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'

const PRIMARY = '#2A5F6B'

interface DigestSchedule {
  id: string
  morning_time: string
  afternoon_time: string
  timezone: string
  active: boolean
}

interface QueueMessage {
  id: string
  contact_name: string | null
  contact_remote_jid: string
  contact_priority: string
  original_message: string | null
  message_summary: string | null
  received_at: string
}

const PRIORITY_COLOR: Record<string, string> = {
  priority: '#2A5F6B',
  normal: '#6b7280',
  muted: '#d1d5db',
}

export default function DigestPage() {
  const [schedule, setSchedule] = useState<DigestSchedule | null>(null)
  const [queue, setQueue] = useState<QueueMessage[]>([])
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ morning_time: '08:00', afternoon_time: '17:00', active: true })

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
    const { data: sched } = await supabase
      .from('digest_schedule')
      .select('*')
      .eq('instance_id', inst.id)
      .single()
    if (sched) {
      setSchedule(sched)
      setForm({
        morning_time: sched.morning_time?.slice(0, 5) || '08:00',
        afternoon_time: sched.afternoon_time?.slice(0, 5) || '17:00',
        active: sched.active,
      })
    }
    const { data: msgs } = await supabase
      .from('message_queue')
      .select('id, contact_name, contact_remote_jid, contact_priority, original_message, message_summary, received_at')
      .eq('instance_id', inst.id)
      .eq('included_in_digest', false)
      .eq('replied', false)
      .order('received_at', { ascending: false })
      .limit(50)
    setQueue(msgs || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instanceId) return
    setSaving(true)
    const supabase = getSupabase()
    if (schedule) {
      await supabase.from('digest_schedule').update(form).eq('id', schedule.id)
    } else {
      await supabase.from('digest_schedule').insert({ ...form, instance_id: instanceId })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Horários */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Horários do Digest</h2>
        <p className="text-xs text-gray-500 mb-5">Quando você vai revisar e responder as mensagens acumuladas.</p>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Período da manhã</label>
              <input
                type="time" value={form.morning_time}
                onChange={e => setForm(f => ({ ...f, morning_time: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
                onFocus={e => e.target.style.borderColor = PRIMARY}
                onBlur={e => e.target.style.borderColor = ''}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Período da tarde</label>
              <input
                type="time" value={form.afternoon_time}
                onChange={e => setForm(f => ({ ...f, afternoon_time: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
                onFocus={e => e.target.style.borderColor = PRIMARY}
                onBlur={e => e.target.style.borderColor = ''}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Toggle
              value={form.active}
              onToggle={() => setForm(f => ({ ...f, active: !f.active }))}
              color={PRIMARY}
              size="sm"
            />
            <span className="text-xs text-gray-600">
              {form.active ? 'Digest ativo' : 'Digest desativado'}
            </span>
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50"
            style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}
          >
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar horários'}
          </button>
        </form>
      </div>

      {/* Fila de mensagens */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Fila de mensagens</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PRIMARY }}>
            {queue.length}
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma mensagem na fila.</p>
        ) : (
          <div className="space-y-3">
            {queue.map(msg => (
              <div key={msg.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div
                  className="w-2 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: PRIORITY_COLOR[msg.contact_priority] || '#d1d5db', minHeight: '16px' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {msg.contact_name || msg.contact_remote_jid}
                    </p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.received_at)}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {msg.message_summary || msg.original_message || '…'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
