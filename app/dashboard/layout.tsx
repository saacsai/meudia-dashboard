'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import EditarPerfilPage from '@/components/EditarPerfilPage'
import GerenciarPlanoPage from '@/components/GerenciarPlanoPage'

const PRIMARY = '#2A5F6B'

const NAV = [
  { href: '/dashboard',            label: 'Início',     icon: '⊞' },
  { href: '/dashboard/assistente', label: 'Assistente', icon: '✦' },
  { href: '/dashboard/contatos',   label: 'Contatos',   icon: '☰' },
  { href: '/dashboard/digest',     label: 'Agenda',     icon: '◷' },
]

type View = 'main' | 'perfil' | 'plano'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [view, setView] = useState<View>('main')

  // Fecha perfil/plano ao navegar entre páginas
  useEffect(() => { setView('main') }, [pathname])

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
      } else {
        setUserEmail(session.user.email || '')
        setUserName(
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          ''
        )
        setLoading(false)
      }
    })
  }, [])

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
