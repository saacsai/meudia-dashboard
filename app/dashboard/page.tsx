'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'

const PRIMARY = '#2A5F6B'

interface Instance {
  id: string
  instance_name: string
  phone_number: string
  status: string
  paused: boolean
  persona_name: string
}

interface QueueMessage {
  id: string
  contact_name: string | null
  contact_remote_jid: string
  contact_priority: string
  message_summary: string | null
  original_message: string | null
  received_at: string
}

const PRIORITY_COLOR: Record<string, string> = {
  priority: PRIMARY,
  normal: '#6b7280',
  muted: '#d1d5db',
}

export default function DashboardPage() {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [pendentes, setPendentes] = useState(0)
  const [queue, setQueue] = useState<QueueMessage[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: rows } = await supabase
      .from('instances')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .limit(1)
    const inst = rows?.[0] ?? null

    if (inst) {
      setInstance(inst)
      const { count } = await supabase
        .from('message_queue')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', inst.id)
        .eq('included_in_digest', false)
        .eq('replied', false)
      setPendentes(count || 0)

      const { data: msgs } = await supabase
        .from('message_queue')
        .select('id, contact_name, contact_remote_jid, contact_priority, message_summary, original_message, received_at')
        .eq('instance_id', inst.id)
        .eq('included_in_digest', false)
        .eq('replied', false)
        .order('received_at', { ascending: false })
        .limit(50)
      setQueue(msgs || [])
    }
    setLoading(false)
  }

  async function togglePause() {
    if (!instance) return
    setToggling(true)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('instances')
      .update({ paused: !instance.paused })
      .eq('id', instance.id)
      .select()
      .single()
    if (data) setInstance(data)
    setToggling(false)
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>

  if (!instance) return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500 mb-4">Nenhuma instância configurada.</p>
        <a href="/dashboard/assistente" className="text-sm font-medium" style={{ color: PRIMARY }}>
          Configurar agora →
        </a>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Assistente</p>
            <h2 className="text-xl font-bold text-gray-900">{instance.persona_name}</h2>
            <p className="text-sm text-gray-500 mt-1">{instance.phone_number}</p>
          </div>
          <a href="/dashboard/conectar" className="text-xs font-medium hover:underline" style={{ color: PRIMARY }}>
            WhatsApp →
          </a>
        </div>
      </div>

      {/* Pause toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300"
                style={{ backgroundColor: instance.paused ? '#d1d5db' : '#22c55e' }}
              />
              <p className="text-sm font-semibold text-gray-900">
                {instance.paused ? 'IA pausada' : 'IA ativa'}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {instance.paused
                ? 'Acumulando mensagens para o digest'
                : `${instance.persona_name} está respondendo automaticamente`}
            </p>
          </div>
          <Toggle
            value={!instance.paused}
            onToggle={togglePause}
            loading={toggling}
            color={PRIMARY}
          />
        </div>
      </div>

      {/* Métricas */}
      {/* Fila de mensagens */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Mensagens acumuladas</h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: pendentes > 0 ? PRIMARY : '#9ca3af' }}
          >
            {pendentes}
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
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(msg.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
