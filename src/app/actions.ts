'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ACTIVITIES, PACES, todayLima, type Activity, type Pace, type Sex } from '@/lib/metas'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth'
import type { FoodBasis, FoodSource, FoodUnit } from '@/lib/foods'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}

const CODIGO_INVALIDO = 'Código inválido o ya usado'

export async function redeemInviteCode(code: string): Promise<{ error: string } | undefined> {
  // No lanza nunca por un canje fallido: en producción Next enmascara el
  // mensaje de cualquier excepción de una server action, así que el motivo
  // real se loguea y al cliente vuelve { error }. El redirect va FUERA del
  // try: internamente lanza y no debe confundirse con un fallo del canje.
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('redeem_invite', { p_code: code })
    if (error) {
      console.error('redeem_invite devolvió error:', error)
      return { error: CODIGO_INVALIDO }
    }
  } catch (err) {
    console.error('redeem_invite lanzó una excepción inesperada:', err)
    return { error: CODIGO_INVALIDO }
  }

  redirect('/')
}

export type MetaInput = {
  sex: Sex
  birthDate: string
  heightCm: number
  activity: Activity
  pace: Pace
  /** Solo si el usuario aún no tiene ninguna medición: crea una con fecha de hoy. */
  weightKg?: number | null
}

export async function saveMeta(input: MetaInput): Promise<{ error: string } | { ok: true }> {
  const { sex, birthDate, heightCm, activity, pace, weightKg } = input

  if (sex !== 'm' && sex !== 'f') return { error: 'Elige Hombre o Mujer.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate >= todayLima()) {
    return { error: 'Revisa tu fecha de nacimiento.' }
  }
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
    return { error: 'La talla debe estar entre 100 y 250 cm.' }
  }
  if (!ACTIVITIES.some((a) => a.value === activity)) return { error: 'Elige tu nivel de actividad.' }
  if (!PACES.some((p) => p.value === pace)) return { error: 'Elige tu objetivo.' }
  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300)) {
    return { error: 'El peso debe estar entre 30 y 300 kg.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Tu sesión expiró. Vuelve a ingresar.' }

  // .select() para detectar el caso "0 filas actualizadas" (sin perfil o
  // bloqueado por RLS), que de otro modo no devuelve error.
  const { data: actualizados, error } = await supabase
    .from('profiles')
    .update({ sex, birth_date: birthDate, height_cm: heightCm, activity, pace })
    .eq('id', user.id)
    .select('id')
  if (error || !actualizados?.length) {
    console.error('saveMeta: update de profiles falló:', error ?? '0 filas actualizadas')
    return { error: 'No se pudo guardar. Inténtalo de nuevo.' }
  }

  if (weightKg != null) {
    // Solo se crea si de verdad no hay ninguna medición con peso (por si la
    // pantalla estaba desactualizada).
    const { count } = await supabase
      .from('measurements')
      .select('weight_kg', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('weight_kg', 'is', null)
    if (!count) {
      const { error: medError } = await supabase
        .from('measurements')
        .insert({ user_id: user.id, measured_on: todayLima(), weight_kg: weightKg })
      if (medError) {
        console.error('saveMeta: insert de measurements falló:', medError)
        return { error: 'Se guardaron tus datos, pero no tu peso. Inténtalo de nuevo.' }
      }
    }
  }

  revalidatePath('/meta')
  return { ok: true }
}

// ---------- Alimentos (solo admin; RLS con is_admin() es la barrera real) ----------

export type FoodInput = {
  name: string
  source: FoodSource
  basis: FoodBasis
  unitLabel: FoodUnit
  gramsPerUnit: number | null
  protein: number
  carbs: number
  fat: number
  featured: boolean
}

type FoodResult = { error: string } | { ok: true }

function validateFood(f: FoodInput): string | null {
  if (!f.name?.trim()) return 'Ponle un nombre al alimento.'
  if (f.name.trim().length > 120) return 'El nombre es muy largo.'
  if (!['ins', 'plato', 'producto'].includes(f.source)) return 'Elige la fuente.'
  if (!['100g', 'unit'].includes(f.basis)) return 'Elige la medida.'
  if (!['g', 'mL'].includes(f.unitLabel)) return 'Elige la unidad.'
  if (f.basis === 'unit' && !(f.gramsPerUnit != null && f.gramsPerUnit > 0)) {
    return 'Pon la cantidad por unidad.'
  }
  for (const [label, v] of [
    ['proteína', f.protein],
    ['carbos', f.carbs],
    ['grasa', f.fat],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v > 1000) return `Revisa el valor de ${label}.`
  }
  return null
}

function foodRow(f: FoodInput) {
  return {
    name: f.name.trim(),
    source: f.source,
    basis: f.basis,
    unit_label: f.unitLabel,
    grams_per_unit: f.basis === 'unit' ? f.gramsPerUnit : null,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    featured: f.featured,
  }
}

const SIN_PERMISO = 'Solo el administrador puede editar alimentos.'

export async function createFood(input: FoodInput): Promise<FoodResult> {
  const invalid = validateFood(input)
  if (invalid) return { error: invalid }
  if (!(await isAdmin())) return { error: SIN_PERMISO }

  const supabase = await createClient()
  const { error } = await supabase.from('foods').insert(foodRow(input))
  if (error) {
    console.error('createFood falló:', error)
    return { error: 'No se pudo guardar el alimento. Inténtalo de nuevo.' }
  }
  revalidatePath('/alimentos')
  return { ok: true }
}

export async function updateFood(id: string, input: FoodInput): Promise<FoodResult> {
  const invalid = validateFood(input)
  if (invalid) return { error: invalid }
  if (!(await isAdmin())) return { error: SIN_PERMISO }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('foods')
    .update(foodRow(input))
    .eq('id', id)
    .select('id')
  if (error || !data?.length) {
    console.error('updateFood falló:', error ?? '0 filas actualizadas')
    return { error: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' }
  }
  revalidatePath('/alimentos')
  return { ok: true }
}

export async function deleteFood(id: string): Promise<FoodResult> {
  if (!(await isAdmin())) return { error: SIN_PERMISO }

  const supabase = await createClient()
  const { data, error } = await supabase.from('foods').delete().eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('deleteFood falló:', error ?? '0 filas eliminadas')
    return { error: 'No se pudo eliminar el alimento. Inténtalo de nuevo.' }
  }
  revalidatePath('/alimentos')
  return { ok: true }
}
