'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: Array<{ tool: string; args: Record<string, unknown> }>
}

interface Persona {
  name: string
  tone: string
  responseSize: string
}

const TOOL_LABELS: Record<string, string> = {
  listar_contatos: 'Listou contatos',
  buscar_contatos: 'Buscou contatos',
  definir_prioridade: 'Ajustou prioridade',
  consultar_fila: 'Consultou fila',
  criar_grupo: 'Criou grupo',
  adicionar_ao_grupo: 'Adicionou ao grupo',
  listar_grupos: 'Listou grupos',
  criar_contato: 'Cadastrou contato',
}

function buildWelcome(name: string): Message {
  return {
    role: 'assistant',
    content: `Olá! Sou ${name}. Como posso ajudar você hoje?`,
  }
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [persona, setPersona] = useState<Persona | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function getToken() {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    async function loadHistory() {
      const token = await getToken()
      const res = await fetch('/api/assistente/olivia/historico', {
        headers: { authorization: `Bearer ${token}` }
      })
      if (!res.ok) { setLoadingHistory(false); return }
      const data = await res.json()
      setPersona(data.persona)
      const msgs: Message[] = data.messages
      setMessages(msgs.length ? msgs : [buildWelcome(data.persona?.name || 'Assistente')])
      setLoadingHistory(false)
    }
    loadHistory()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch('/api/assistente/olivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text })
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || 'Não consegui processar. Tente novamente.',
          toolsUsed: data.toolsUsed
        }
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Erro ao conectar. Verifique sua conexão e tente novamente.' }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const assistantName = persona?.name || 'Assistente'

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <p className="text-sm text-gray-400">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: PRIMARY }}
        >
          {assistantName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{assistantName}</p>
          <p className="text-xs text-gray-400">Sua assistente pessoal</p>
        </div>
        <a
          href="/dashboard/configuracoes"
          className="ml-auto text-xs hover:underline"
          style={{ color: PRIMARY }}
        >
          Configurar →
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {msg.toolsUsed.map((t, ti) => (
                    <span
                      key={ti}
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: `${PRIMARY}18`, color: PRIMARY }}
                    >
                      ✓ {TOOL_LABELS[t.tool] || t.tool}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === 'user'
                    ? { background: PRIMARY, color: 'white', borderBottomRightRadius: '4px' }
                    : { background: 'white', color: '#1f2937', border: '1px solid #e5e7eb', borderBottomLeftRadius: '4px' }
                }
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center"
              style={{ background: 'white', border: '1px solid #e5e7eb' }}
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: PRIMARY, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Fale com ${assistantName}… (Enter para enviar)`}
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
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-40"
            style={{ background: PRIMARY }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 text-center">
          Shift+Enter para nova linha · Enter para enviar
        </p>
      </div>
    </div>
  )
}
