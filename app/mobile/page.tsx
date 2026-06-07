'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSupabase } from '@/lib/supabase'

const PRIMARY = '#2A5F6B'

interface Task {
  id: string
  title: string
  due_date: string | null
}

interface InstanceInfo {
  id: string
  pause_mode: boolean
}

export default function MobileHub() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [queueCount, setQueueCount] = useState(0)
  const [instance, setInstance] = useState<InstanceInfo | null>(null)
  const [toggling, setToggling] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login?next=/mobile'); return }

    const userId = session.user.id
    const firstName = (session.user.user_metadata?.full_name || '').split(' ')[0]
    setUserName(firstName)

    const today = new Date().toISOString().split('T')[0]

    const [tasksRes, instRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, due_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .lte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(6),
      supabase.from('instances')
        .select('id, pause_mode')
        .eq('user_id', userId)
        .eq('active', true)
        .single(),
    ])

    if (tasksRes.data) setTasks(tasksRes.data)

    if (instRes.data) {
      setInstance(instRes.data)
      const { count } = await supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('instance_id', instRes.data.id)
        .eq('replied', false)
        .eq('contact_priority', 'priority')
      setQueueCount(count || 0)
    }

    setLoading(false)
  }

  async function togglePause() {
    if (!instance) return
    setToggling(true)
    const newMode = !instance.pause_mode
    await getSupabase().from('instances').update({ pause_mode: newMode }).eq('id', instance.id)
    setInstance(prev => prev ? { ...prev, pause_mode: newMode } : prev)
    setToggling(false)
  }

  async function completeTask(id: string) {
    setCompleting(id)
    await getSupabase().from('tasks').update({ completed: true }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setCompleting(null)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: PRIMARY }}>
      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const overdueCount = tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0]).length

  return (
    <div className="min-h-screen pb-8" style={{ background: '#F0F5F6' }}>

      {/* Header verde */}
      <div className="px-5 pt-10 pb-6" style={{ background: PRIMARY }}>
        <Image
          src="/meudia_marca.png"
          alt="MeuDIA"
          width={150}
          height={56}
          className="object-contain mb-4"
          priority
        />
        <p className="text-white text-xl font-semibold">
          {greeting}{userName ? `, ${userName}` : ''}.
        </p>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {tasks.length === 0
            ? 'Nenhuma tarefa pendente para hoje.'
            : `${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} pendente${tasks.length > 1 ? 's' : ''}${overdueCount > 0 ? ` (${overdueCount} atrasada${overdueCount > 1 ? 's' : ''})` : ''}.`
          }
        </p>
      </div>

      <div className="px-4 space-y-3 mt-4">

        {/* Tarefas */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarefas</p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PRIMARY }}>
                {tasks.length}
              </span>
            </div>
            {tasks.map(task => {
              const overdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0]
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={() => completeTask(task.id)}
                    disabled={completing === task.id}
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-50"
                    style={{ borderColor: overdue ? '#ef4444' : PRIMARY }}
                  >
                    {completing === task.id && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PRIMARY }} />
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
                    {task.title}
                  </span>
                  {overdue && (
                    <span className="text-xs font-medium text-red-500 flex-shrink-0">atrasada</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Fila de mensagens prioritárias */}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full text-left bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mensagens prioritárias</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {queueCount > 0
                ? `${queueCount} aguardando sua resposta`
                : 'Nenhuma na fila agora'
              }
            </p>
          </div>
          {queueCount > 0 ? (
            <span
              className="text-white text-sm font-bold rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#ef4444' }}
            >
              {queueCount > 9 ? '9+' : queueCount}
            </span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </button>

        {/* Status Olivia */}
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Olivia</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: instance?.pause_mode ? '#f59e0b' : '#22c55e' }}
                />
                <p className="text-sm font-semibold text-gray-900">
                  {instance?.pause_mode ? 'Pausada' : 'Ativa'}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 ml-4">
                {instance?.pause_mode
                  ? 'Não está respondendo mensagens'
                  : 'Respondendo mensagens por você'
                }
              </p>
            </div>
            <button
              onClick={togglePause}
              disabled={toggling || !instance}
              className="text-xs font-semibold px-4 py-2 rounded-xl flex-shrink-0 transition-all disabled:opacity-50"
              style={{
                background: instance?.pause_mode ? '#dcfce7' : '#fef9c3',
                color: instance?.pause_mode ? '#16a34a' : '#92400e',
              }}
            >
              {toggling ? '…' : instance?.pause_mode ? 'Retomar' : 'Pausar'}
            </button>
          </div>
        </div>

        {/* Abrir dashboard */}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full text-white text-sm font-semibold rounded-2xl py-4"
          style={{ backgroundColor: PRIMARY }}
        >
          Abrir Dashboard completo
        </button>

      </div>
    </div>
  )
}
