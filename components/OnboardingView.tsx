'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'
const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors'

async function getToken() {
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.access_token || ''
}

const WARNING_BULLETS = [
  'O MeuDIA vai cuidar do seu WhatsApp enquanto você foca no que importa.',
  'Você tem controle total — desconecte quando quiser, sem perder nenhum dado.',
  'Para funcionar de verdade, você precisa confiar no sistema. Se delegar mas ficar checando cada mensagem que entra, o efeito se perde.',
  'Sua assistente gerencia expectativa, não decisões. Ela não responde, não resolve e não decide nada por você — a menos que você configure explicitamente.',
]

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

function TypingIndicator() {
  return (
    <div className="flex justify-start items-end gap-2">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: PRIMARY }}>BI</div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: PRIMARY, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          Use o mesmo número de WhatsApp que deseja conectar ao MeuDIA. Você pode editar seu perfil depois.
        </div>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <button
        onClick={create}
        disabled={creating || (!!perfilPhone && !confirmed)}
        className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: PRIMARY }}
      >
        {creating ? 'Preparando…' : 'Conectar WhatsApp'}
      </button>
    </div>
  )
}

// ─── Contatos ─────────────────────────────────────────────────────────────────

function ContactsStep() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm text-gray-600">
      <p>Seus contatos aparecem automaticamente em <strong>Contatos</strong> conforme as mensagens chegam.</p>
      <p>Quando quiser organizar, acesse a aba diretamente ou peça à sua assistente no chat — ela pode criar grupos, definir prioridades e mais.</p>
    </div>
  )
}

// ─── Janelas de resposta ──────────────────────────────────────────────────────

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

// ─── Assistente ───────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 0 | 1 | 2 | 3 | 4 | 5

type ChatMsg = {
  id: string
  role: 'bia' | 'user'
  content?: string
  widget?: 'warnings' | 'whatsapp' | 'contacts' | 'digest' | 'assistente'
}

type QuickReply = { label: string; action: () => void }

// ─── Main ─────────────────────────────────────────────────────────────────────

interface OnboardingViewProps {
  userName: string
  initialStep: number
  onComplete: (assistantName: string) => void
}

export default function OnboardingView({ userName, initialStep, onComplete }: OnboardingViewProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [phase, setPhase] = useState<Phase>(0)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mountedRef = useRef(true)
  const conversationId = useRef<string | null>(null)

  // Refs for widget callbacks — prevents stale closures since widgets are rendered
  // from a frozen messages array that never changes after insertion
  const onWhatsAppConnectedRef = useRef<() => void>(() => {})
  const onDigestSavedRef = useRef<() => void>(() => {})
  const onAssistanteCompleteRef = useRef<(name: string) => void>(() => {})

  const stableOnWhatsAppConnected = useCallback(() => onWhatsAppConnectedRef.current(), [])
  const stableOnDigestSaved = useCallback(() => onDigestSavedRef.current(), [])
  const stableOnAssistanteComplete = useCallback((name: string) => onAssistanteCompleteRef.current(name), [])

  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function userSay(content: string) {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }])
  }

  async function biaSay(content?: string, widget?: ChatMsg['widget'], delay = 900) {
    setTyping(true)
    await new Promise(r => setTimeout(r, delay))
    if (!mountedRef.current) return
    setTyping(false)
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content, widget }])
  }

  async function advanceStep(step: number) {
    const token = await getToken()
    await fetch('/api/onboarding/step', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ step })
    })
  }

  // ─── Phase flow ───────────────────────────────────────────────────────────────

  async function initPhase0() {
    await biaSay(
      `Olá${userName ? `, ${userName}` : ''}! Seja bem-vindo ao MeuDIA — organizado e priorizado. Todo dia.\n\nNosso objetivo é te auxiliar a organizar sua agenda, minimizando distrações e tarefas que tiram o seu foco e concentração.\n\nAntes de iniciarmos a configuração, você tem alguma dúvida?`,
      undefined,
      600
    )
    setPhase(0)
    setQuickReplies([{ label: 'Por ora não →', action: skipToPhase1 }])
  }

  async function skipToPhase1() {
    setQuickReplies([])
    userSay('Por ora não →')
    await biaSay('Ok! Antes de iniciarmos, leia estes avisos importantes:')
    await biaSay(undefined, 'warnings', 400)
    await biaSay('Você confirma que leu e entende como o sistema funciona?', undefined, 600)
    setPhase(1)
    setQuickReplies([{ label: 'Li e aceito ✓', action: startPhase2 }])
  }

  async function startPhase2() {
    setQuickReplies([])
    userSay('Li e aceito ✓')
    await advanceStep(1)
    await biaSay('Ótimo! Agora vamos conectar seu WhatsApp. É por aqui que suas mensagens chegam e que sua assistente vai atuar.')
    await biaSay(undefined, 'whatsapp', 400)
    setPhase(2)
  }

  async function handleWhatsAppConnected() {
    await advanceStep(2)
    await biaSay('WhatsApp conectado com sucesso! ✓', undefined, 400)
    await biaSay('Seus contatos aparecem automaticamente conforme as mensagens chegam. Você pode organizá-los na aba Contatos ou pedir à sua assistente depois.')
    await biaSay(undefined, 'contacts', 300)
    setPhase(3)
    setQuickReplies([{ label: 'Entendido →', action: startPhase4 }])
  }

  async function startPhase4() {
    setQuickReplies([])
    userSay('Entendido →')
    await advanceStep(3)
    await biaSay('Configure suas janelas de resposta — os momentos do dia em que você abre o WhatsApp. Fora delas, o WhatsApp não existe para você.')
    await biaSay(undefined, 'digest', 400)
    setPhase(4)
  }

  async function handleDigestSaved() {
    await biaSay('Janelas salvas! ✓', undefined, 400)
    await biaSay('Última etapa! Vamos configurar sua assistente pessoal.')
    await biaSay('Eu, BIA, sou a assistente do produto — estou na aba Dúvidas para qualquer coisa sobre o sistema. Sua assistente pessoal terá o nome e a personalidade que você definir.', undefined, 600)
    await biaSay(undefined, 'assistente', 400)
    setPhase(5)
  }

  async function handleAssistanteComplete(name: string) {
    await biaSay(`Perfeito! ${name} está pronta para trabalhar. Bem-vindo ao MeuDIA!`, undefined, 400)
    onComplete(name)
  }

  // Keep refs current on every render
  onWhatsAppConnectedRef.current = handleWhatsAppConnected
  onDigestSavedRef.current = handleDigestSaved
  onAssistanteCompleteRef.current = handleAssistanteComplete

  // ─── Phase 0: free Q&A ───────────────────────────────────────────────────────

  async function sendQuestion() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setQuickReplies([])
    userSay(text)
    setTyping(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/assistente/comando', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversation_id: conversationId.current, chatSource: 'bia' })
      })
      const data = await res.json()
      if (data.conversation_id) conversationId.current = data.conversation_id
      setTyping(false)
      if (!mountedRef.current) return
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content: data.response || 'Desculpe, não consegui processar sua pergunta.' }])
      await biaSay('Mais alguma dúvida?', undefined, 600)
    } catch {
      setTyping(false)
      if (!mountedRef.current) return
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'bia', content: 'Ocorreu um erro ao conectar. Tente novamente.' }])
    } finally {
      setSending(false)
      setQuickReplies([{ label: 'Por ora não →', action: skipToPhase1 }])
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendQuestion()
    }
  }

  // ─── Resume (initialStep > 0) ─────────────────────────────────────────────────

  function buildResumedMessages(step: number): { msgs: ChatMsg[]; resumePhase: Phase } {
    const msgs: ChatMsg[] = [
      { id: 'r0', role: 'bia', content: `Bem-vindo de volta${userName ? `, ${userName}` : ''}! Vamos continuar de onde paramos.` }
    ]
    if (step === 0) {
      msgs.push({ id: 'r1', role: 'bia', content: 'Conecte seu WhatsApp para continuar:', widget: 'whatsapp' })
      return { msgs, resumePhase: 2 }
    }
    msgs.push({ id: 'r2', role: 'bia', content: 'WhatsApp conectado! ✓' })
    if (step === 1) {
      msgs.push({ id: 'r3', role: 'bia', content: 'Sobre seus contatos:', widget: 'contacts' })
      return { msgs, resumePhase: 3 }
    }
    if (step === 2) {
      msgs.push({ id: 'r4', role: 'bia', content: 'Configure suas janelas de resposta:', widget: 'digest' })
      return { msgs, resumePhase: 4 }
    }
    msgs.push({ id: 'r5', role: 'bia', content: 'Configure sua assistente pessoal:', widget: 'assistente' })
    return { msgs, resumePhase: 5 }
  }

  // ─── Mount ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialStep === 0) {
      initPhase0()
    } else {
      const { msgs, resumePhase } = buildResumedMessages(initialStep)
      setMessages(msgs)
      setPhase(resumePhase)
      if (resumePhase === 3) {
        setQuickReplies([{ label: 'Entendido →', action: startPhase4 }])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────────

  function renderMessage(msg: ChatMsg) {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="flex justify-end">
          <div
            className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
            style={{ background: PRIMARY, color: 'white', borderBottomRightRadius: '4px' }}
          >
            {msg.content}
          </div>
        </div>
      )
    }

    return (
      <div key={msg.id} className="flex justify-start items-end gap-2">
        <BiaAvatar />
        <div className="max-w-[85%] flex flex-col gap-2">
          {msg.content && (
            <div
              className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{ background: 'white', border: '1px solid #e5e7eb', color: '#1f2937', borderBottomLeftRadius: msg.widget ? '12px' : '4px' }}
            >
              {msg.content}
            </div>
          )}
          {msg.widget === 'warnings' && <ReadCard bullets={WARNING_BULLETS} />}
          {msg.widget === 'whatsapp' && (
            <div className="w-full max-w-xs">
              <WhatsAppStep onConnected={stableOnWhatsAppConnected} />
            </div>
          )}
          {msg.widget === 'contacts' && <ContactsStep />}
          {msg.widget === 'digest' && (
            <div className="w-full max-w-xs">
              <DigestStep onSaved={stableOnDigestSaved} />
            </div>
          )}
          {msg.widget === 'assistente' && (
            <div className="w-full max-w-xs">
              <AssistenteStep onComplete={stableOnAssistanteComplete} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: PRIMARY }}
        >BI</div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">BIA</p>
          <p className="text-xs text-gray-400">Configuração inicial · MeuDIA</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map(renderMessage)}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && (
        <div className="flex gap-2 flex-wrap py-3 flex-shrink-0">
          {quickReplies.map(qr => (
            <button
              key={qr.label}
              onClick={qr.action}
              disabled={sending}
              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 hover:opacity-80"
              style={{ borderColor: PRIMARY, color: PRIMARY, background: `${PRIMARY}0D` }}
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {/* Text input — only during phase 0 */}
      {phase === 0 && (
        <div className="pt-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tem alguma dúvida? (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={sendQuestion}
              disabled={!input.trim() || sending}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: PRIMARY }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">Shift+Enter para nova linha · Enter para enviar</p>
        </div>
      )}

    </div>
  )
}
