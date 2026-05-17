'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Instance {
  id: string
  persona_name: string
  persona_tone: string
  persona_response_size: string
  persona_description: string | null
  response_hint: string | null
}

interface Persona {
  id: string
  name: string
  tagline: string
  description: string
  summary: string
  avatar: string
  avatarBg: string
  persona_tone: string
  persona_response_size: string
  persona_description: string
  response_hint: string
  recommended?: boolean
}

const PERSONAS: Persona[] = [
  {
    id: 'BIA',
    name: 'BIA',
    tagline: 'Jovial e próxima',
    description: 'Comunicação leve, simpática e direta. Ideal para profissionais liberais e pequenos negócios.',
    summary: 'Ela é jovial e próxima — responde de forma descontraída, com mensagens curtas e uma pitada de simpatia. Perfeita para manter seus contatos por perto sem perder tempo.',
    avatar: 'B',
    avatarBg: '#7C3AED',
    persona_tone: 'descontraido',
    persona_response_size: 'curto',
    persona_description: 'Sou a BIA, assistente digital de quem você está tentando falar. Estou aqui para garantir que nenhuma mensagem importante fique sem atenção!',
    response_hint: 'Retorno em breve! Fico de olho nas mensagens prioritárias.',
  },
  {
    id: 'ADONAI',
    name: 'ADONAI',
    tagline: 'Corporativo e preciso',
    description: 'Linguagem formal e impecável. Para executivos, consultores e advogados.',
    summary: 'Ele é corporativo e preciso — usa linguagem formal, respostas detalhadas e trata cada interação com discrição. Ideal para quem precisa de uma comunicação executiva impecável.',
    avatar: 'A',
    avatarBg: '#1E40AF',
    persona_tone: 'formal',
    persona_response_size: 'detalhado',
    persona_description: 'Sou ADONAI, assistente executivo responsável pela gestão das comunicações. Estou garantindo que suas mensagens sejam tratadas com a devida atenção e prioridade.',
    response_hint: 'Retorno assim que possível. Mensagens urgentes serão escaladas imediatamente.',
  },
  {
    id: 'MAIA',
    name: 'MAIA',
    tagline: 'Equilibrada e profissional',
    description: 'O ponto certo entre eficiência e cordialidade. Funciona para a maioria dos perfis.',
    summary: 'Ela é equilibrada e profissional — combina cordialidade com eficiência, respostas diretas e atenção às prioridades. A escolha certa para a maioria dos perfis.',
    avatar: 'M',
    avatarBg: '#059669',
    persona_tone: 'profissional',
    persona_response_size: 'curto',
    persona_description: 'Sou MAIA, assistente profissional. Estou gerenciando as mensagens e garantindo que as prioridades sejam atendidas com atenção.',
    response_hint: 'Retorno em breve. Mensagens urgentes têm prioridade.',
    recommended: true,
  },
  {
    id: 'custom',
    name: 'Personalizado',
    tagline: 'Sua própria marca',
    description: 'Defina nome, tom e personalidade do seu jeito. Para quem quer identidade própria.',
    summary: '',
    avatar: '+',
    avatarBg: '#9CA3AF',
    persona_tone: 'profissional',
    persona_response_size: 'curto',
    persona_description: '',
    response_hint: '',
  },
]

const PRESET_NAMES = ['BIA', 'ADONAI', 'MAIA']

function detectPersonaId(name: string): string {
  const upper = name?.toUpperCase()
  if (PRESET_NAMES.includes(upper)) return upper
  return 'custom'
}

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none transition-colors"

export default function AssistentePage() {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [form, setForm] = useState({
    persona_name: '',
    persona_tone: 'profissional',
    persona_response_size: 'curto',
    persona_description: '',
    response_hint: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('instances')
      .select('id, persona_name, persona_tone, persona_response_size, persona_description, response_hint')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()
    if (data) {
      setInstance(data)
      const pid = detectPersonaId(data.persona_name)
      // Só pré-seleciona se o usuário já escolheu um preset válido antes
      if (pid !== 'custom') {
        setSelectedPersona(pid)
        setForm({
          persona_name: data.persona_name || '',
          persona_tone: data.persona_tone || 'profissional',
          persona_response_size: data.persona_response_size || 'curto',
          persona_description: data.persona_description || '',
          response_hint: data.response_hint || '',
        })
      }
    }
    setLoading(false)
  }

  function selectPersona(persona: Persona) {
    setSelectedPersona(persona.id)
    if (persona.id === 'custom') {
      setForm(f => ({ ...f, persona_tone: 'profissional', persona_response_size: 'curto' }))
    } else {
      setForm({
        persona_name: persona.name,
        persona_tone: persona.persona_tone,
        persona_response_size: persona.persona_response_size,
        persona_description: persona.persona_description,
        response_hint: persona.response_hint,
      })
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!instance) return
    setSaving(true)
    const supabase = getSupabase()
    await supabase.from('instances').update(form).eq('id', instance.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const isCustom = selectedPersona === 'custom'
  const hasSelection = selectedPersona !== null

  if (loading) return <div className="text-sm text-gray-400">Carregando…</div>
  if (!instance) return <div className="text-sm text-gray-500">Nenhuma instância encontrada.</div>

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Cards de persona */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Escolha o perfil do assistente</h2>
        <p className="text-xs text-gray-500 mb-5">
          Cada perfil já vem configurado com nome, tom e personalidade. Você pode ajustar depois.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PERSONAS.map(persona => {
            const active = selectedPersona === persona.id
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => selectPersona(persona)}
                className="relative text-left p-4 rounded-xl border-2 transition-all"
                style={{
                  borderColor: active ? persona.avatarBg : '#e5e7eb',
                  backgroundColor: active ? `${persona.avatarBg}0d` : 'white',
                }}
              >
                {persona.recommended && (
                  <span
                    className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: persona.avatarBg }}
                  >
                    recomendado
                  </span>
                )}
                {active && (
                  <span
                    className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: persona.avatarBg }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}

                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
                  style={{ backgroundColor: persona.avatarBg }}
                >
                  {persona.avatar}
                </div>

                <p className="text-sm font-bold text-gray-900 leading-tight">{persona.name}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: persona.avatarBg }}>{persona.tagline}</p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{persona.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Prompt quando nada foi selecionado ainda */}
      {!hasSelection && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400">← Selecione um perfil acima para continuar</p>
        </div>
      )}

      {/* Resumo (presets) ou Formulário (personalizado) */}
      {hasSelection && <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <form onSubmit={handleSave}>
          {isCustom ? (
            <>
              <h2 className="text-base font-bold text-gray-900 mb-1">Configure seu assistente</h2>
              <p className="text-xs text-gray-500 mb-5">Defina como ele vai se apresentar e se comportar.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome do assistente</label>
                  <input
                    type="text"
                    value={form.persona_name}
                    onChange={e => setForm(f => ({ ...f, persona_name: e.target.value }))}
                    placeholder="Ex: LARA, ZEUS, NINA…"
                    className={inputClass}
                    onFocus={e => e.target.style.borderColor = PRIMARY}
                    onBlur={e => e.target.style.borderColor = ''}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tom de comunicação</label>
                    <select
                      value={form.persona_tone}
                      onChange={e => setForm(f => ({ ...f, persona_tone: e.target.value }))}
                      className={inputClass + ' cursor-pointer'}
                      onFocus={e => e.target.style.borderColor = PRIMARY}
                      onBlur={e => e.target.style.borderColor = ''}
                    >
                      <option value="formal">Formal</option>
                      <option value="profissional">Profissional</option>
                      <option value="descontraido">Descontraído</option>
                      <option value="amigavel">Amigável</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tamanho das respostas</label>
                    <select
                      value={form.persona_response_size}
                      onChange={e => setForm(f => ({ ...f, persona_response_size: e.target.value }))}
                      className={inputClass + ' cursor-pointer'}
                      onFocus={e => e.target.style.borderColor = PRIMARY}
                      onBlur={e => e.target.style.borderColor = ''}
                    >
                      <option value="curto">Curto e direto</option>
                      <option value="detalhado">Mais detalhado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personalidade</label>
                  <textarea
                    value={form.persona_description}
                    onChange={e => setForm(f => ({ ...f, persona_description: e.target.value }))}
                    placeholder="Como o assistente se apresenta e descreve sua função…"
                    rows={3}
                    className={inputClass + ' resize-none'}
                    onFocus={e => e.target.style.borderColor = PRIMARY}
                    onBlur={e => e.target.style.borderColor = ''}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Previsão de retorno</label>
                  <input
                    type="text"
                    value={form.response_hint}
                    onChange={e => setForm(f => ({ ...f, response_hint: e.target.value }))}
                    placeholder="Ex: Retorno ainda hoje, até as 17h…"
                    className={inputClass}
                    onFocus={e => e.target.style.borderColor = PRIMARY}
                    onBlur={e => e.target.style.borderColor = ''}
                  />
                </div>
              </div>
            </>
          ) : (() => {
            const p = PERSONAS.find(x => x.id === selectedPersona)!
            return (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: p.avatarBg }}
                  >
                    {p.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Você escolheu {p.name} como sua assistente.</p>
                    <p className="text-xs font-medium" style={{ color: p.avatarBg }}>{p.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{p.summary}</p>
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-100">
                  <span className="font-medium text-gray-700">Previsão de retorno: </span>
                  {p.response_hint}
                </div>
              </>
            )
          })()}

          <button
            type="submit"
            disabled={saving}
            className="w-full text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50 transition-colors mt-5"
            style={{ backgroundColor: saved ? '#16a34a' : PRIMARY }}
          >
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar configurações'}
          </button>
        </form>
      </div>}

    </div>
  )
}
