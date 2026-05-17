'use client'

import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function CallbackPage() {
  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const supabase = getSupabase()

    // Recovery de senha — redireciona para a tela de nova senha
    if (hash.includes('type=recovery')) {
      window.location.href = '/reset-password' + hash
      return
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        const code = params.get('code')
        if (code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
            window.location.href = err ? '/login?erro=link-invalido' : '/dashboard'
          })
        } else {
          window.location.href = '/login?erro=link-invalido'
        }
        return
      }
      window.location.href = '/dashboard'
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F5F6' }}>
      <p className="text-sm text-gray-400">Verificando acesso…</p>
    </div>
  )
}
