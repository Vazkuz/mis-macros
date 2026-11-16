import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth'
import { todayLima } from '@/lib/metas'
import { hourLima, isIsoDate, isMeal, mealForHour } from '@/lib/hoy'
import { loadLogs } from '@/lib/loadLogs'
import AgregarView from './AgregarView'

export const metadata: Metadata = { title: 'Agregar comida · Mis Macros' }

// /agregar?meal=desayuno&d=2026-11-14[&sel=dish:<id>] — pantalla completa (sin Shell).
// sel: al volver de crear un plato, ese plato aparece ya elegido.
export default async function AgregarPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; meal?: string; sel?: string }>
}) {
  const { d, meal, sel } = await searchParams
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
      initialDishId={sel?.match(/^dish:(\d+)$/)?.[1] ?? null}
      isAdmin={admin}
    />
  )
}
