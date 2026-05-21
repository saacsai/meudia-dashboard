'use client'

import ChatWithSidebar from '@/components/ChatWithSidebar'

export default function ChatPage() {
  return (
    <ChatWithSidebar
      chatSource="bia"
      sendPath="/api/assistente/comando"
      historyPath="/api/assistente/historico"
      conversasPath="/api/assistente/conversas"
      headerName="BIA"
      headerSubtitle="Assistente MeuDIA"
      welcomeMessage="Olá! Sou a BIA, sua assistente no MeuDIA. Posso ajudar você a gerenciar seus contatos, consultar a fila de mensagens, criar grupos e muito mais. O que você precisa hoje?"
    />
  )
}
