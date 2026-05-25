'use client'

// ─────────────────────────────────────────────────────────────
// Sidebar SAACS — template reutilizável para todos os produtos
// Troque: logoSrc, productName, primaryColor, navItems
// Mantém: estrutura, AvatarMenu, "powered by SAACS"
// ─────────────────────────────────────────────────────────────

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AvatarMenu from './AvatarMenu'

export interface NavItem {
  href: string
  label: string
  icon: string
}

// Durante o onboarding, cada item do nav desbloqueia num step específico.
// -1 = sempre acessível | 4 = só após completar o onboarding
const UNLOCK_AT: Record<string, number> = {
  '/dashboard/chat':          -1,
  '/dashboard/contatos':       1,
  '/dashboard':                2,
  '/dashboard/assistente':     3,
  '/dashboard/configuracoes':  4,
}

interface Props {
  logoSrc: string
  productName: string
  navItems: NavItem[]
  userName: string
  userEmail: string
  primaryColor?: string
  onLogout: () => void
  onEditarPerfil: () => void
  onGerenciarPlano: () => void
  onUsoCredits: () => void
  onboardingStep?: number
  onboardingCompleted?: boolean
}

function initials(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

export default function Sidebar({
  logoSrc,
  productName,
  navItems,
  userName,
  userEmail,
  primaryColor = '#2A5F6B',
  onLogout,
  onEditarPerfil,
  onGerenciarPlano,
  onUsoCredits,
  onboardingStep = 4,
  onboardingCompleted = true,
}: Props) {
  const pathname = usePathname()

  return (
    <aside
      style={{ position: 'fixed', top: 0, left: 0, width: '256px', height: '100vh', zIndex: 10 }}
      className="flex flex-col bg-white border-r border-gray-200"
    >
      {/* Logo */}
      <div className="flex justify-center pt-5 pb-4 px-4">
        <Image
          src={logoSrc}
          alt={productName}
          width={160}
          height={160}
          className="rounded-xl object-cover"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 overflow-y-auto space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          const unlockAt = UNLOCK_AT[item.href] ?? 4
          const locked = !onboardingCompleted && onboardingStep < unlockAt
          const done = !onboardingCompleted && onboardingStep >= unlockAt && unlockAt >= 0

          if (locked) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm select-none"
                style={{ color: '#d1d5db', cursor: 'default' }}
              >
                <span className="text-base leading-none opacity-40">{item.icon}</span>
                <span className="opacity-40">{item.label}</span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: active ? `${primaryColor}18` : 'transparent',
                color: active ? primaryColor : done ? '#374151' : '#6b7280',
                fontWeight: active ? 600 : done ? 500 : 400,
              }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {done && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: primaryColor }}>
                  <polyline points="1.5 6 4.5 9 10.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé: avatar + SAACS */}
      <div className="border-t border-gray-100">
        <div className="px-2 pt-2">
          <AvatarMenu
            nomeExibido={userName || userEmail}
            email={userEmail}
            initials={initials(userName || userEmail)}
            onEditarPerfil={onEditarPerfil}
            onGerenciarPlano={onGerenciarPlano}
            onUsoCredits={onUsoCredits}
            onSair={onLogout}
          />
        </div>
        <div className="flex flex-col items-center gap-1 py-3 border-t border-gray-100 mt-1">
          <span className="text-[10px] text-gray-400 tracking-wide">powered by</span>
          <Image src="/logo_saacs.png" alt="SAACS" width={120} height={38} className="object-contain opacity-60" />
        </div>
      </div>
    </aside>
  )
}
