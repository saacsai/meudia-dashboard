'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const UNLOCK_AT: Record<string, number> = {
  '/dashboard/chat':          -1,
  '/dashboard/contatos':       1,
  '/dashboard':                2,
  '/dashboard/assistente':     3,
  '/dashboard/configuracoes':  4,
}

interface Props {
  navItems: NavItem[]
  primaryColor: string
  onboardingStep?: number
  onboardingCompleted?: boolean
}

export default function BottomNav({
  navItems,
  primaryColor,
  onboardingStep = 4,
  onboardingCompleted = true,
}: Props) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-stretch md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {navItems.map(item => {
        const unlockAt = UNLOCK_AT[item.href] ?? 4
        const isLocked = !onboardingCompleted && onboardingStep < unlockAt && unlockAt !== -1
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

        if (isLocked) {
          return (
            <div key={item.href} className="flex-1 flex flex-col items-center justify-center py-5 gap-0.5 opacity-30">
              <span className="leading-none">{item.icon}</span>
              <span className="text-[10px] text-gray-400 leading-none truncate w-full text-center px-1">{item.label}</span>
            </div>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-5 gap-0.5 transition-colors"
          >
            <span
              className="text-lg leading-none"
              style={{ color: isActive ? primaryColor : '#9ca3af' }}
            >
              <span className="leading-none">{item.icon}</span>
            </span>
            <span
              className="text-[10px] leading-none truncate w-full text-center px-1 font-medium"
              style={{ color: isActive ? primaryColor : '#9ca3af' }}
            >
              {item.label}
            </span>
            {isActive && (
              <span
                className="absolute bottom-0 w-8 h-0.5 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
