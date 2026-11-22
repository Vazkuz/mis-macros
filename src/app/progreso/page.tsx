import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { todayLima } from '@/lib/metas'
import { MEASUREMENT_SELECT, toMeasurement, type Measurement } from '@/lib/progreso'
import ProgresoView from './ProgresoView'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const [{ data: profile }, measurements] = await Promise.all([
    supabase.from('profiles').select('height_cm, weight_goal_kg').eq('id', userId).maybeSingle(),
    loadMeasurements(),
  ])

  async function loadMeasurements(): Promise<Measurement[] | null> {
    try {
      const { data, error } = await supabase
        .from('measurements')
        .select(MEASUREMENT_SELECT)
        .eq('user_id', userId)
        .order('measured_on', { ascending: false })
      if (error) throw error
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(toMeasurement)
    } catch (err) {
      unstable_rethrow(err)
      console.error('No se pudieron cargar las mediciones:', err)
      return null
    }
  }

  const height = profile?.height_cm != null ? Number(profile.height_cm) : null
  const weightGoal = profile?.weight_goal_kg != null ? Number(profile.weight_goal_kg) : null

  return (
    <>
      <h1 className="text-[26px]">Peso y cintura</h1>
      <ProgresoView
        initial={measurements ?? []}
        loadError={measurements === null}
        heightCm={height && height > 0 ? height : null}
        weightGoalKg={weightGoal && weightGoal > 0 ? weightGoal : null}
        today={todayLima()}
      />
    </>
  )
}
