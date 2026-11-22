import type { SupabaseClient } from '@supabase/supabase-js'
import type { Activity, GoalsInput, Pace, Sex } from '@/lib/metas'

// Carga (servidor) del perfil y la última medición con peso: lo que necesitan
// /meta y Hoy para computeGoals.

export type ProfileData = {
  sex: Sex | null
  birthDate: string | null
  heightCm: number | null
  activity: Activity | null
  pace: Pace | null
  proteinPerKg: number | null
  fatPerKg: number | null
  weightGoalKg: number | null
}

export type LastWeight = { weightKg: number; measuredOn: string } | null

const num = (v: unknown) => (v == null || v === '' ? null : Number(v))

export async function loadProfileAndWeight(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: ProfileData; lastWeight: LastWeight }> {
  const [{ data: p }, { data: w }] = await Promise.all([
    supabase
      .from('profiles')
      .select('sex, birth_date, height_cm, activity, pace, protein_g_per_kg, fat_g_per_kg, weight_goal_kg')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('measurements')
      .select('measured_on, weight_kg')
      .eq('user_id', userId)
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    profile: {
      sex: p?.sex ?? null,
      birthDate: p?.birth_date ?? null,
      heightCm: num(p?.height_cm),
      activity: p?.activity ?? null,
      pace: p?.pace ?? null,
      proteinPerKg: num(p?.protein_g_per_kg),
      fatPerKg: num(p?.fat_g_per_kg),
      weightGoalKg: num(p?.weight_goal_kg),
    },
    lastWeight: w ? { weightKg: Number(w.weight_kg), measuredOn: String(w.measured_on) } : null,
  }
}

export function goalsInputFrom(profile: ProfileData, lastWeight: LastWeight): GoalsInput {
  return {
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg: lastWeight?.weightKg ?? null,
    activity: profile.activity,
    pace: profile.pace,
    proteinPerKg: profile.proteinPerKg,
    fatPerKg: profile.fatPerKg,
  }
}
