'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'
const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors'

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token || ''
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function BiaAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PRIMARY }}>
      BI
    </div>
  )
}

function ReadCard({ bullets }: { bullets: string[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2.5">
      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Leia com atenção</p>
      <ul className="space-y-2.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor: i < current ? `${PRIMARY}80` : i === current ? PRIMARY : '#d1d5db',
          }}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">Passo {current + 1} de {total}</span>
    </div>
  )
}

// ─── Step 1: WhatsApp ─────────────────────────────────────────────────────────

type WaState = 'loading' | 'disconnected' | 'awaiting_qr' | 'connected'

function WhatsAppStep({ onConnected }: { onConnected: () => void }) {
  const [state, setState] = useState<WaState>('loading')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [perfilPhone, setPerfilPhone] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const alreadyNotified = useRef(false)

  const checkStatus = useCallback(async (silent = false) => {
    const token = await getToken()
    try {
      const res = await fetch('/api/whatsapp', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { if (!silent) setState('disconnected'); return }
      const data = await res.json()
      if (data.connected) {
        setPhone(data.phone)
        setState('connected')
        if (!alreadyNotified.current) { alreadyNotified.current = true; onConnected() }
      } else if (data.instance) {
        setState('awaiting_qr')
        if (data.qrcode) setQrcode(data.qrcode)
      } else {
        if (!silent) setState('disconnected')
      }
    } catch { if (!silent) setState('disconnected') }
  }, [onConnected])

  useEffect(() => {
    async function init() {
      const token = await getToken()
      const res = await fetch('/api/perfil', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setPerfilPhone(d.whatsapp || null)
      await checkStatus(false)
    }
    init()
  }, [checkStatus])

  useEffect(() => {
    if (state !== 'awaiting_qr') return
    const id = setInterval(() => checkStatus(true), 5000)
    return () => clearInterval(id)
  }, [state, checkStatus])

  async function create() {
    setCreating(true); setError('')
    const token = await getToken()
    const res = await fetch('/api/whatsapp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.error) { setError(data.error); setCreating(false); return }
    if (data.connected) {
      setPhone(data.phone); setState('connected')
      if (!alreadyNotified.current) { alreadyNotified.current = true; onConnected() }
      setCreating(false); return
    }
    setQrcode(data.qrcode); setState('awaiting_qr'); setCreating(false)
    setTimeout(() => checkStatus(true), 6000)
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, '')
    if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
    if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
    return p
  }

  if (state === 'loading') return <p className="text-sm text-gray-400 py-2">Verificando conexão…</p>

  if (state === 'connected') return (
    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">WhatsApp conectado</p>
        {phone && <p className="text-xs text-gray-500">{formatPhone(phone)}</p>}
      </div>
    </div>
  )

  if (state === 'awaiting_qr') return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
      <div className="flex justify-center">
        {qrcode ? (
          <div className="border-2 border-gray-100 rounded-2xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrcode} alt="QR Code" width={180} height={180} style={{ width: 180, height: 180 }} />
          </div>
        ) : (
          <div className="py-8 flex justify-center">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
      <p className="text-xs text-center text-gray-400">Verificando a cada 5 segundos…</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {perfilPhone ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500">Número do seu perfil:</p>
          <p className="text-sm font-bold text-gray-900">{formatPhone(perfilPhone)}</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-teal-700" />
            <span className="text-xs text-gray-600">Confirmo que vou escanear o QR com este número</span>
          </label>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Nenhum número salvo no perfil. Edite seu perfil (canto inferior esquerdo) antes de continuar.
        </div>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <button
        onClick={create}
        disabled={creating || !confirmed || !perfilPhone}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        {creating ? 'Preparando…' : 'Conectar WhatsApp'}
      </button>
    </div>
  )
}

// ─── Step 2: Contatos ─────────────────────────────────────────────────────────

function ContactsStep() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm text-gray-600">
      <p>Seus contatos aparecem automaticamente em <strong>Contatos</strong> conforme as mensagens chegam.</p>
      <p>Quando quiser organizar, acesse a aba diretamente ou peça à sua assistente no chat — ela pode criar grupos, definir prioridades e mais.</p>
    </div>
  )
}

// ─── Step 3: Janelas de resposta ──────────────────────────────────────────────

function DigestStep({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ morning_time: '08:00', afternoon_time: '17:00' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data: inst } = await sb.from('instances').select('id').eq('user_id', session.user.id).eq('active', true).single()
      if (!inst) return
      setInstanceId(inst.id)
      const { data: sched } = await sb.from('digest_schedule').select('id, morning_time, afternoon_time').eq('instance_id', inst.id).single()
      if (sched) {
        setScheduleId(sched.id)
        setForm({ morning_time: sched.morning_time?.slice(0, 5) || '08:00', afternoon_time: sched.afternoon_time?.slice(0, 5) || '17:00' })
      }
    }
    load()
  }, [])

  async function save() {
    if (!instanceId) return
    setSaving(true)
    const sb = getSupabase()
    const payload = { ...form, active: true, instance_id: instanceId }
    if (scheduleId) {
      await sb.from('digest_schedule').update(form).eq('id', scheduleId)
    } else {
      const { data } = await sb.from('digest_schedule').insert(payload).select('id').single()
      if (data?.id) setScheduleId(data.id)
    }
    setSaving(false)
    setSaved(true)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Janela da manhã</label>
          <input type="time" value={form.morning_time} onChange={e => setForm(f => ({ ...f, morning_time: e.target.value }))} className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Janela da tarde</label>
          <input type="time" value={form.afternoon_time} onChange={e => setForm(f => ({ ...f, afternoon_time: e.target.value }))} className={inputClass} onFocus={e => e.target.style.borderColor = PRIMARY} onBlur={e => e.target.style.borderColor = ''} />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving || saved}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}
      >
        {saving ? 'Salvando…' : saved ? '✓ Janelas salvas' : 'Salvar janelas de resposta'}
      </button>
    </div>
  )
}

// ─── Step 4: Assistente ───────────────────────────────────────────────────────

function AssistenteStep({ onComplete }: { onComplete: (name: string) => void }) {
  const [form, setForm] = useState({ persona_name: '', persona_tone: 'profissional', persona_response_size: 'curto', persona_description: '', response_hint: '' })
  const [saving, setSaving] = useState(false)
  const [instanceId, setInstanceId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data } = await sb.from('instances').select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint').eq('user_id', session.user.id).eq('active', true).single()
      if (data) {
        setInstanceId(data.id)
        if (data.persona_name) setForm({ persona_name: data.persona_name, persona_tone: data.persona_tone || 'profissional', persona_response_size: data.persona_response_size || 'curto', persona_description: data.persona_description || '', response_hint: data.response_hint || '' })
      }
    }
    load()
  }, [])

  async function complete() {
    if (!instanceId || !form.persona_name.trim()) return
    setSaving(true)
    const sb = getSupabase()
    await sb.from('instances').update(form).eq('id', instanceId)
    const token = await getToken()
    await fetch('/api/onboarding/step', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ completed: true })
    })
    window.dispatchEvent(new CustomEvent('assistantNameChanged', { detail: form.persona_name }))
    onComplete(form.persona_name)
  }

  const nameIsBia = form.persona_name.trim().toUpperCase() === 'BIA'
  const canSubmit = form.persona_name.trim().length > 0 && !nameIsBia && !saving

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome da assistente</label>
        <input
          type="text"
          value={form.persona_name}
          onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))}
          placeholder="Ex: MAIA, LARA, ZEUS, NINA…"
          className={inputClass}
          style={{ borderColor: nameIsBia ? '#f59e0b' : '' }}
          onFocus={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : PRIMARY}
          onBlur={e => e.target.style.borderColor = nameIsBia ? '#f59e0b' : ''}
        />
        {nameIsBia && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            BIA é o nome da assistente do produto. Escolha outro nome para a sua assistente pessoal.
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
      <button
        onClick={complete}
        disabled={!canSubmit}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        {saving ? 'Finalizando…' : 'Concluir configuração →'}
      </button>
    </div>
  )
}

// ─── Config dos passos ────────────────────────────────────────────────────────

interface StepConfig {
  title: string
  biaIntro: string
  bullets: string[]
  continueLabel?: string
}

const STEPS: StepConfig[] = [
  {
    title: 'WhatsApp',
    biaIntro: 'Antes de conectar seu WhatsApp, leia isso com atenção:',
    bullets: [
      'O MeuDIA vai cuidar do seu WhatsApp enquanto você foca no que importa.',
      'Você tem controle total — desconecte quando quiser, sem perder nenhum dado.',
      'Para funcionar de verdade, você precisa confiar no sistema. Se delegar mas ficar checando cada mensagem que entra, o efeito se perde.',
      'Sua assistente gerencia expectativa, não decisões. Ela não responde, não resolve e não decide nada por você — a menos que você configure explicitamente.',
    ],
  },
  {
    title: 'Contatos',
    biaIntro: 'Ótimo, WhatsApp conectado! Agora sobre seus contatos:',
    bullets: [
      'Nem todos os seus contatos entram automaticamente — só os que já têm histórico de mensagens.',
      'Alguns precisarão ser adicionados manualmente. Você decide quem importa.',
      'A classificação por grupos é fundamental: define quem pode interromper o seu dia e quem pode esperar.',
      'Você faz isso na aba Contatos, ou pede para a sua assistente ajudar depois de concluir a configuração.',
    ],
    continueLabel: 'Entendido, continuar →',
  },
  {
    title: 'Meu Dia',
    biaIntro: 'Esse é o coração do MeuDIA. Configure suas janelas de resposta:',
    bullets: [
      'A tela "Meu Dia" é a sua central diária — abre assim que você faz login.',
      'Ela mostra as mensagens acumuladas organizadas por prioridade.',
      'As janelas de resposta são os momentos do dia em que você abre o WhatsApp. Fora delas, o WhatsApp não existe para você.',
    ],
    continueLabel: 'Continuar →',
  },
  {
    title: 'Sua Assistente',
    biaIntro: 'Última etapa. Um detalhe importante antes de começar:',
    bullets: [
      'Eu, BIA, sou a assistente do produto — estou na aba Dúvidas para qualquer coisa sobre o sistema.',
      'Sua assistente pessoal tem nome e personalidade que você define. É ela que seus contatos vão conhecer.',
    ],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

interface OnboardingViewProps {
  userName: string
  initialStep: number
  onComplete: (assistantName: string) => void
}

export default function OnboardingView({ userName, initialStep, onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), 3))
  const [stepReady, setStepReady] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const config = STEPS[step]

  // Contacts step is always ready to advance
  const canAdvance =
    step === 1 ? true :
    step < 3 ? stepReady :
    false

  async function advance() {
    if (advancing || !canAdvance) return
    setAdvancing(true)
    const token = await getToken()
    const nextStep = step + 1
    await fetch('/api/onboarding/step', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ step: nextStep })
    })
    setStep(nextStep)
    setStepReady(false)
    setAdvancing(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F5F6' }}>

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/meudia_logo.jpg" alt="MeuDIA" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-semibold text-gray-800 text-sm">MeuDIA</span>
        </div>
        <span className="text-xs text-gray-400">Configuração inicial</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-lg space-y-6">

          <StepDots current={step} total={4} />

          {/* BIA message */}
          <div className="flex items-start gap-3">
            <BiaAvatar />
            <p className="text-sm text-gray-700 leading-relaxed pt-1">
              {step === 0 && userName ? `Olá, ${userName}! Sou a BIA. ` : ''}{config.biaIntro}
            </p>
          </div>

          {/* Leia com atenção */}
          <ReadCard bullets={config.bullets} />

          {/* Action area */}
          <div>
            {step === 0 && <WhatsAppStep onConnected={() => setStepReady(true)} />}
            {step === 1 && <ContactsStep />}
            {step === 2 && <DigestStep onSaved={() => setStepReady(true)} />}
            {step === 3 && <AssistenteStep onComplete={onComplete} />}
          </div>

          {/* Advance button (steps 0–2) */}
          {step < 3 && (
            <button
              onClick={advance}
              disabled={!canAdvance || advancing}
              className="w-full text-white text-sm font-medium rounded-xl py-3 disabled:opacity-40 transition-all"
              style={{ backgroundColor: PRIMARY }}
            >
              {advancing ? 'Avançando…' : config.continueLabel || 'Continuar →'}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
