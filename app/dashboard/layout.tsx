'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import EditarPerfilPage from '@/components/EditarPerfilPage'
import GerenciarPlanoPage from '@/components/GerenciarPlanoPage'
import OnboardingView from '@/components/OnboardingView'

const PRIMARY = '#2A5F6B'

type View = 'main' | 'perfil' | 'plano'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assistantName, setAssistantName] = useState('Assistente')
  const [onboardingCompleted, setOnboardingCompleted] = useState(true) // default true evita flash
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [view, setView] = useState<View>('main')

  useEffect(() => { setView('main') }, [pathname])

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
        return
      }
      setUserEmail(session.user.email || '')
      setUserName(
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        ''
      )
      let { data: rows } = await supabase
        .from('instances')
        .select('persona_name, onboarding_completed, onboarding_step')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .limit(1)

      // Novo usuário sem instância: cria via setup e retorna ao onboarding
      if (!rows || rows.length === 0) {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const inst = await res.json()
          rows = [inst]
        }
      }

      if (rows?.[0]) {
        if (rows[0].persona_name) setAssistantName(rows[0].persona_name)
        setOnboardingCompleted(rows[0].onboarding_completed ?? false)
        setOnboardingStep(rows[0].onboarding_step ?? 0)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    function onNameChange(e: CustomEvent<string>) {
      setAssistantName(e.detail)
    }
    window.addEventListener('assistantNameChanged', onNameChange as EventListener)
    return () => window.removeEventListener('assistantNameChanged', onNameChange as EventListener)
  }, [])

  const NAV = [
    { href: '/dashboard',               label: 'Meu Dia',       icon: '◈' },
    { href: '/dashboard/assistente',    label: assistantName,   icon: '✦' },
    { href: '/dashboard/contatos',      label: 'Contatos',      icon: '☰' },
    { href: '/dashboard/configuracoes', label: 'Configurações', icon: '⚙' },
    { href: '/dashboard/chat',          label: 'Dúvidas',       icon: '?' },
  ]

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F5F6' }}>
      <p className="text-sm text-gray-400">Carregando…</p>
    </div>
  )

  if (!onboardingCompleted) return (
    <OnboardingView
      userName={userName}
      initialStep={onboardingStep}
      onComplete={(name) => {
        if (name) setAssistantName(name)
        setOnboardingCompleted(true)
      }}
    />
  )

  return (
    <div className="min-h-screen" style={{ background: '#F0F5F6' }}>
      <Sidebar
        logoSrc="/meudia_logo.jpg"
        productName="MeuDIA"
        navItems={NAV}
        userName={userName}
        userEmail={userEmail}
        primaryColor={PRIMARY}
        onLogout={handleLogout}
        onEditarPerfil={() => setView('perfil')}
        onGerenciarPlano={() => setView('plano')}
      />
      <main className="p-6 min-h-screen" style={{ marginLeft: '256px' }}>
        {view === 'main' && children}
        {view === 'perfil' && (
          <EditarPerfilPage
            onVoltar={() => setView('main')}
            onSaved={nome => { setUserName(nome); setView('main') }}
          />
        )}
        {view === 'plano' && (
          <GerenciarPlanoPage onVoltar={() => setView('main')} />
        )}
      </main>
    </div>
  )
}
