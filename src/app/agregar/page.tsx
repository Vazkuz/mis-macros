import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth'
import { todayLima } from '@/lib/metas'
import { hourLima, isIsoDate, isMeal, mealForHour } from '@/lib/hoy'
import { loadLogs } from '@/lib/loadLogs'
import AgregarView from './AgregarView'

export const metadata: Metadata = { title: 'Agregar comida · Mis Macros' }

// /agregar?meal=desayuno&d=2026-11-14 — pantalla completa (sin Shell).
export default async function AgregarPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; meal?: string }>
}) {
  const { d, meal } = await searchParams
  const today = todayLima()
  const date = isIsoDate(d) && d <= today ? d : today
  const initialMeal = isMeal(meal) ? meal : mealForHour(hourLima())

  const supabase = await createClient()
  const [logs, admin] = await Promise.all([loadLogs(supabase, date), isAdmin()])

  return (
    <AgregarView
      key={date}
      date={date}
      isToday={date === today}
      initialMeal={initialMeal}
      initialLogs={logs ?? []}
      isAdmin={admin}
    />
  )
}
