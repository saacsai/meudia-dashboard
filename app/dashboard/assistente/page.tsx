'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import ChatWithSidebar from '@/components/ChatWithSidebar'

export default function AssistentePage() {
  const [assistantName, setAssistantName] = useState<string | null>(null)

  useEffect(() => {
    async function loadPersona() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('instances')
        .select('persona_name')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .single()
      setAssistantName(data?.persona_name || 'Assistente')
    }
    loadPersona()
  }, [])

  if (assistantName === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <p className="text-sm text-gray-400">Carregando…</p>
      </div>
    )
  }

  return (
    <ChatWithSidebar
      chatSource="olivia"
      sendPath="/api/assistente/olivia"
      historyPath="/api/assistente/olivia/historico"
      conversasPath="/api/assistente/conversas"
      headerName={assistantName}
      headerSubtitle="Sua assistente pessoal"
      welcomeMessage={`Olá! Sou ${assistantName}, sua assistente pessoal. Como posso ajudar você hoje?`}
      configLink="/dashboard/configuracoes"
    />
  )
}
