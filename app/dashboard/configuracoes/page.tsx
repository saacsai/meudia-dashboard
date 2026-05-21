'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import Toggle from '@/components/Toggle'

const PRIMARY = '#2A5F6B'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Instance {
  id: string
  persona_name: string
  persona_tone: string
  persona_response_size: string
  persona_description: string | null
  response_hint: string | null
}

interface DigestSchedule {
  id: string
  morning_time: string
  afternoon_time: string
  timezone: string
  active: boolean
}

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"

// ─── WhatsApp Section ─────────────────────────────────────────────────────────

type WaEstado = 'carregando' | 'sem_instancia' | 'aguardando_qr' | 'conectado'

function WhatsAppSection() {
  const [estado, setEstado] = useState<WaEstado>('carregando')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [perfilPhone, setPerfilPhone] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [criando, setCriando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [erro, setErro] = useState('')

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  const verificarStatus = useCallback(async (isPolling = false) => {
    const token = await getToken()
    try {
      const res = await fetch('/api/whatsapp', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (!isPolling) setEstado('sem_instancia'); return }
      const data = await res.json()
      if (data.connected) { setEstado('conectado'); setPhone(data.phone) }
      else if (data.instance) { setEstado('aguardando_qr'); if (data.qrcode) setQrcode(data.qrcode) }
      else { if (!isPolling) setEstado('sem_instancia') }
    } catch { if (!isPolling) setEstado('sem_instancia') }
  }, [])

  useEffect(() => {
    async function init() {
      const token = await getToken()
      const res = await fetch('/api/perfil', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setPerfilPhone(d.whatsapp || null)
      await verificarStatus(false)
    }
    init()
  }, [verificarStatus])

  useEffect(() => {
    if (estado !== 'aguardando_qr') return
    const interval = setInterval(() => verificarStatus(true), 5000)
    return () => clearInterval(interval)
  }, [estado, verificarStatus])

  async function criarInstancia() {
    setCriando(true); setErro('')
    const token = await getToken()
    const res = await fetch('/api/whatsapp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.error) { setErro(data.error); setCriando(false); return }
    if (data.connected) { setPhone(data.phone); setEstado('conectado'); setCriando(false); return }
    setQrcode(data.qrcode); setEstado('aguardando_qr'); setCriando(false)
    setTimeout(() => verificarStatus(true), 6000)
  }

  async function desconectar() {
    setDesconectando(true)
    const token = await getToken()
    await fetch('/api/whatsapp', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setEstado('sem_instancia'); setQrcode(null); setPhone(null); setConfirmado(false); setDesconectando(false)
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
    return p
  }

  if (estado === 'carregando') return <p className="text-sm text-gray-400">Verificando conexão…</p>

  return (
    <div className="space-y-3">
      {estado === 'conectado' && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#dcfce7' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">WhatsApp conectado</p>
              <p className="text-xs text-gray-500">{phone ? formatPhone(phone) : '—'}</p>
            </div>
          </div>
          <button onClick={desconectar} disabled={desconectando} className="w-full border border-red-200 text-red-600 text-sm font-medium rounded-xl py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
            {desconectando ? 'Desconectando…' : 'Desconectar WhatsApp'}
          </button>
        </>
      )}

      {estado === 'sem_instancia' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">Antes de conectar:</p>
            <p>O número conectado aqui será gerenciado pela IA. Recomendamos ter um <strong>segundo número</strong> para uso pessoal.</p>
          </div>
          {perfilPhone ? (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-600">QR Code vinculado ao número do seu perfil:</p>
              <p className="text-sm font-bold text-gray-900">{formatPhone(perfilPhone)}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-0.5 accent-teal-700" />
                <span className="text-xs text-gray-600">Confirmo que vou escanear o QR com este número</span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nenhum número salvo no perfil. Edite seu perfil antes de conectar.</p>
          )}
          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{erro}</p>}
          <button onClick={criarInstancia} disabled={criando || !confirmado || !perfilPhone} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors" style={{ backgroundColor: PRIMARY }}>
            {criando ? 'Preparando…' : 'Gerar QR Code'}
          </button>
        </>
      )}

      {estado === 'aguardando_qr' && (
        <>
          <p className="text-xs text-gray-500">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
          {qrcode ? (
            <div className="flex justify-center">
              <div className="border-2 border-gray-100 rounded-2xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrcode} alt="QR Code" width={200} height={200} style={{ width: 200, height: 200 }} />
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-6">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
            </div>
          )}
          <p className="text-xs text-center text-gray-400">Atualizando a cada 5 segundos…</p>
          <button onClick={() => verificarStatus(false)} className="w-full border border-gray-200 text-gray-600 text-sm font-medium rounded-xl py-2 hover:bg-gray-50 transition-colors">
            Atualizar agora
          </button>
        </>
      )}
    </div>
  )
}

// ─── Assistente Section ───────────────────────────────────────────────────────

function AssistenteSection() {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ persona_name: '', persona_tone: 'profissional', persona_response_size: 'curto', persona_description: '', response_hint: '' })

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('instances').select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint').eq('user_id', session.user.id).eq('active', true).single()
      if (data) {
        setInstance(data)
        setForm({ persona_name: data.persona_name || '', persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instance) return
    setSaving(true)
    const supabase = getSupabase()
    await supabase.from('instances').update(form).eq('id', instance.id)
    if (form.persona_name) {
      window.dispatchEvent(new CustomEvent('assistantNameChanged', { detail: form.persona_name }))
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>
  if (!instance) return <p className="text-sm text-gray-500">Nenhuma instância encontrada.</p>

  const nameIsBia = form.persona_name.trim().toUpperCase() === 'BIA'

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome da assistente</label>
        <input
          type="text"
          value={form.persona_name}
          onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))}
          placeholder="Ex: MAIA, LARA, ZEUS, NINA…"
          className={inputClass}
          onFocus={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : PRIMARY}
          onBlur={e => e.target.style.borderColor = ''}
          style={{ borderColor: nameIsBia ? '#f59e0b' : '' }}
        />
        {nameIsBia && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            BIA é o nome da assistente oficial do MeuDIA. Escolha outro nome para evitar confusões — sua assistente pessoal deve ter uma identidade própria.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tom</label>
          <select value={form.persona_tone} onChange={e => setForm(f => ({ ...f, persona_tone: e.target.value }))} className={inputClass + ' cursor-pointer'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''}>
            <option value="formal">Formal</option>
            <option value="profissional">Profissional</option>
            <option value="descontraido">Descontraído</option>
            <option value="amigavel">Amigável</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Respostas</label>
          <select value={form.persona_response_size} onChange={e => setForm(f => ({ ...f, persona_response_size: e.target.value }))} className={inputClass + ' cursor-pointer'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''}>
            <option value="curto">Curtas</option>
            <option value="detalhado">Detalhadas</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Personalidade</label>
        <textarea value={form.persona_description} onChange={e => setForm(f => ({ ...f, persona_description: e.target.value }))} placeholder="Como a assistente se apresenta…" rows={3} className={inputClass + ' resize-none'} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Previsão de retorno</label>
        <input type="text" value={form.response_hint} onChange={e => setForm(f => ({ ...f, response_hint: e.target.value }))} placeholder="Ex: Retorno ainda hoje, até as 17h…" className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
      </div>
      <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
      </button>
    </form>
  )
}

// ─── Digest Section ───────────────────────────────────────────────────────────

function DigestSection() {
  const [schedule, setSchedule] = useState<DigestSchedule | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ morning_time: '08:00', afternoon_time: '17:00', active: true })

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: inst } = await supabase.from('instances').select('id').eq('user_id', session.user.id).eq('active', true).single()
      if (!inst) { setLoading(false); return }
      setInstanceId(inst.id)
      const { data: sched } = await supabase.from('digest_schedule').select('*').eq('instance_id', inst.id).single()
      if (sched) { setSchedule(sched); setForm({ morning_time: sched.morning_time?.slice(0, 5) || '08:00', afternoon_time: sched.afternoon_time?.slice(0, 5) || '17:00', active: sched.active }) }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instanceId) return
    setSaving(true)
    const supabase = getSupabase()
    if (schedule) { await supabase.from('digest_schedule').update(form).eq('id', schedule.id) }
    else { await supabase.from('digest_schedule').insert({ ...form, instance_id: instanceId }) }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-xs text-gray-500">Quando você vai revisar e responder as mensagens acumuladas.</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Manhã</label>
          <input type="time" value={form.morning_time} onChange={e => setForm(f => ({ ...f, morning_time: e.target.value }))} className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tarde</label>
          <input type="time" value={form.afternoon_time} onChange={e => setForm(f => ({ ...f, afternoon_time: e.target.value }))} className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Toggle value={form.active} onToggle={() => setForm(f => ({ ...f, active: !f.active }))} color={PRIMARY} size="sm" />
        <span className="text-xs text-gray-600">{form.active ? 'Resumos ativos' : 'Resumos desativados'}</span>
      </div>
      <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
        {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar horários'}
      </button>
    </form>
  )
}

// ─── Memórias Section ─────────────────────────────────────────────────────────

interface Memory {
  id: string
  type: string
  content: string
  created_at: string
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  contact_note: 'Contato',
  agenda: 'Agenda',
  instruction: 'Instrução',
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  contact_note: '#7C3AED',
  agenda: '#059669',
  instruction: '#2A5F6B',
}

function MemoriasSection() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: inst } = await supabase.from('instances').select('id').eq('user_id', session.user.id).eq('active', true).single()
      if (!inst) { setLoading(false); return }
      setInstanceId(inst.id)
      const { data } = await supabase.from('assistant_memory').select('id, type, content, created_at').eq('instance_id', inst.id).order('created_at', { ascending: false })
      setMemories(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function deleteMemory(id: string) {
    if (!instanceId) return
    setDeletingId(id)
    const supabase = getSupabase()
    await supabase.from('assistant_memory').delete().eq('id', id).eq('instance_id', instanceId)
    setMemories(prev => prev.filter(m => m.id !== id))
    setDeletingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>

  if (!memories.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Nenhuma memória salva ainda.<br />
        <span className="text-xs">Diga para a assistente &ldquo;lembra que o Anderson é sócio&rdquo; para ela começar a guardar contexto.</span>
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {memories.map(m => (
        <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 mt-0.5"
            style={{ backgroundColor: MEMORY_TYPE_COLORS[m.type] || '#6b7280' }}
          >
            {MEMORY_TYPE_LABELS[m.type] || m.type}
          </span>
          <p className="flex-1 text-xs text-gray-700 leading-relaxed">{m.content}</p>
          <button
            onClick={() => deleteMemory(m.id)}
            disabled={deletingId === m.id}
            className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Section title="WhatsApp">
        <WhatsAppSection />
      </Section>
      <Section title="Assistente">
        <AssistenteSection />
      </Section>
      <Section title="Horários do Resumo">
        <DigestSection />
      </Section>
      <Section title="Memórias" subtitle="O que a assistente lembra entre conversas. Você pode apagar qualquer item.">
        <MemoriasSection />
      </Section>
    </div>
  )
}
