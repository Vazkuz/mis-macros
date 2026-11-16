import { createClient } from '@/utils/supabase/server'
import { computeGoals, todayLima } from '@/lib/metas'
import { goalsInputFrom, loadProfileAndWeight } from '@/lib/profile'
import { hourLima, isIsoDate, isMeal, mealForHour } from '@/lib/hoy'
import { loadLogs } from '@/lib/loadLogs'
import HoyView from './HoyView'

export default async function Hoy({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; meal?: string; open?: string }>
}) {
  const { d, meal, open } = await searchParams
  const today = todayLima()
  // ?d=YYYY-MM-DD; nunca un día futuro.
  const date = isIsoDate(d) && d <= today ? d : today

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ profile, lastWeight }, logs] = await Promise.all([
    loadProfileAndWeight(supabase, user?.id ?? ''),
    loadLogs(supabase, date),
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
      // ?meal= al volver de /agregar; si no, según la hora de Lima.
      defaultMeal={isMeal(meal) ? meal : mealForHour(hourLima())}
      // ?open= al volver de /comida: esa fila arranca desplegada.
      initialOpenId={open && /^\d+$/.test(open) ? open : null}
    />
  )
}
