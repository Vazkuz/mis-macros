import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth'
import { computeGoals, todayLima } from '@/lib/metas'
import { goalsInputFrom, loadProfileAndWeight } from '@/lib/profile'
import {
  LOG_SELECT,
  LOG_SELECT_PLAIN,
  hourLima,
  isIsoDate,
  mealForHour,
  toFoodLog,
  type FoodLog,
} from '@/lib/hoy'
import HoyView from './HoyView'

async function loadLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string
): Promise<FoodLog[] | null> {
  try {
    const q = (cols: string) =>
      supabase.from('food_logs').select(cols).eq('log_date', date).order('id')
    let { data, error } = await q(LOG_SELECT)
    // Si la relación food_logs → foods no está declarada, se pide sin ella.
    if (error) ({ data, error } = await q(LOG_SELECT_PLAIN))
    if (error) throw error
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(toFoodLog)
  } catch (err) {
    unstable_rethrow(err)
    console.error('Hoy: no se pudieron cargar los registros:', err)
    return null
  }
}

export default async function Hoy({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const { d } = await searchParams
  const today = todayLima()
  // ?d=YYYY-MM-DD; nunca un día futuro.
  const date = isIsoDate(d) && d <= today ? d : today

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ profile, lastWeight }, logs, admin] = await Promise.all([
    loadProfileAndWeight(supabase, user?.id ?? ''),
    loadLogs(supabase, date),
    isAdmin(),
  ])

  const goals = computeGoals(goalsInputFrom(profile, lastWeight))

  return (
    <HoyView
      // Remonta al cambiar de día: el estado optimista es por fecha.
      key={date}
      date={date}
      isToday={date === today}
      initialLogs={logs ?? []}
      loadError={logs === null}
      goals={goals}
      defaultMeal={mealForHour(hourLima())}
      isAdmin={admin}
    />
  )
}
