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

const PERSONAS = [
  { id: 'BIA',    name: 'BIA',         tagline: 'Jovial e próxima',         avatarBg: '#7C3AED', persona_tone: 'descontraido', persona_response_size: 'curto',    persona_description: 'Sou a BIA, assistente digital de quem você está tentando falar. Estou aqui para garantir que nenhuma mensagem importante fique sem atenção!', response_hint: 'Retorno em breve! Fico de olho nas mensagens prioritárias.' },
  { id: 'ADONAI', name: 'ADONAI',      tagline: 'Corporativo e preciso',    avatarBg: '#1E40AF', persona_tone: 'formal',       persona_response_size: 'detalhado', persona_description: 'Sou ADONAI, assistente executivo responsável pela gestão das comunicações.', response_hint: 'Retorno assim que possível. Mensagens urgentes serão escaladas imediatamente.' },
  { id: 'MAIA',   name: 'MAIA',        tagline: 'Equilibrada e profissional',avatarBg: '#059669', persona_tone: 'profissional', persona_response_size: 'curto',    persona_description: 'Sou MAIA, assistente profissional. Estou gerenciando as mensagens e garantindo que as prioridades sejam atendidas.', response_hint: 'Retorno em breve. Mensagens urgentes têm prioridade.', recommended: true },
  { id: 'custom', name: 'Personalizado',tagline: 'Sua própria marca',        avatarBg: '#9CA3AF', persona_tone: 'profissional', persona_response_size: 'curto',    persona_description: '', response_hint: '' },
] as const

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
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [form, setForm] = useState({ persona_name: '', persona_tone: 'profissional', persona_response_size: 'curto', persona_description: '', response_hint: '' })

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('instances').select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint').eq('user_id', session.user.id).eq('active', true).single()
      if (data) {
        setInstance(data)
        const upper = data.persona_name?.toUpperCase()
        const isPreset = ['BIA', 'ADONAI', 'MAIA'].includes(upper)
        if (isPreset) {
          setSelectedPersona(upper)
          setForm({ persona_name: data.persona_name || '', persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
        } else if (data.persona_name) {
          setSelectedPersona('custom')
          setForm({ persona_name: data.persona_name || '', persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  function selectPersona(p: typeof PERSONAS[number]) {
    setSelectedPersona(p.id)
    if (p.id === 'custom') {
      setForm(f => ({ ...f, persona_tone: 'profissional', persona_response_size: 'curto' }))
    } else {
      setForm({ persona_name: p.name, persona_tone: p.persona_tone, persona_response_size: p.persona_response_size, persona_description: p.persona_description, response_hint: p.response_hint })
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instance) return
    setSaving(true)
    const supabase = getSupabase()
    await supabase.from('instances').update(form).eq('id', instance.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Carregando…</p>
  if (!instance) return <p className="text-sm text-gray-500">Nenhuma instância encontrada.</p>

  const isCustom = selectedPersona === 'custom'

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map(p => {
          const active = selectedPersona === p.id
          return (
            <button key={p.id} type="button" onClick={() => selectPersona(p)}
              className="relative text-left p-4 rounded-xl border-2 transition-all"
              style={{ borderColor: active ? p.avatarBg : '#e5e7eb', backgroundColor: active ? `${p.avatarBg}0d` : 'white' }}
            >
              {'recommended' in p && p.recommended && !active && (
                <span className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: p.avatarBg }}>recomendado</span>
              )}
              {active && (
                <span className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: p.avatarBg }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              )}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-2" style={{ backgroundColor: p.avatarBg }}>
                {p.name.slice(0, 1)}
              </div>
              <p className="text-sm font-bold text-gray-900">{p.name}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: p.avatarBg }}>{p.tagline}</p>
            </button>
          )
        })}
      </div>

      {selectedPersona && (
        <div className="space-y-3 pt-2">
          {isCustom && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da assistente</label>
                <input type="text" value={form.persona_name} onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))} placeholder="Ex: LARA, ZEUS, NINA…" className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
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
            </>
          )}
          <button type="submit" disabled={saving} className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors" style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}>
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
          </button>
        </div>
      )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-base font-bold text-gray-900 mb-4">{title}</h2>
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
    </div>
  )
}
