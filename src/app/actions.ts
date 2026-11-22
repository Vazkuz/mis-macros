'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ACTIVITIES, PACES, todayLima, type Activity, type Pace, type Sex } from '@/lib/metas'
import { createClient } from '@/utils/supabase/server'
import { loadLogById } from '@/lib/loadLogs'
import { isAdmin } from '@/lib/auth'
import type { FoodBasis, FoodSource, FoodUnit } from '@/lib/foods'
import {
  LOG_SELECT,
  LOG_SELECT_PLAIN,
  isIsoDate,
  isMeal,
  toFoodLog,
  type FoodLog,
  type Meal,
} from '@/lib/hoy'
import {
  ERR_CINTURA,
  ERR_FECHA_OCUPADA,
  ERR_NINGUNO,
  ERR_PESO,
  ERR_PESO_META,
  WEIGHT_GOAL_MAX,
  WEIGHT_GOAL_MIN,
  MEASUREMENT_SELECT,
  toMeasurement,
  validWaist,
  validWeight,
  type Measurement,
} from '@/lib/progreso'

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
  /** Meta de peso opcional (null = sin meta). */
  weightGoalKg: number | null
}

export async function saveMeta(input: MetaInput): Promise<{ error: string } | { ok: true }> {
  const { sex, birthDate, heightCm, activity, pace, weightKg, weightGoalKg } = input

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
  if (
    weightGoalKg != null &&
    (!Number.isFinite(weightGoalKg) ||
      weightGoalKg < WEIGHT_GOAL_MIN ||
      weightGoalKg > WEIGHT_GOAL_MAX)
  ) {
    return { error: ERR_PESO_META }
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
    .update({
      sex,
      birth_date: birthDate,
      height_cm: heightCm,
      activity,
      pace,
      weight_goal_kg: weightGoalKg,
    })
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
  revalidatePath('/progreso')
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

// ---------- Hoy: registros de comidas (food_logs) ----------
// El trigger de la base copia nombre y macros del alimento al insertar o al
// cambiar quantity/food_id; aquí solo se envía log_date, meal, food_id,
// quantity y eaten. Cada acción devuelve la fila guardada para reemplazar la
// optimista del cliente. Sin revalidatePath: el estado optimista del cliente
// es la fuente de verdad mientras la pantalla está abierta.

type LogResult = { error: string } | { ok: true; log: FoodLog }

const MAX_QTY = 100000

/** Select con el alimento relacionado; si la relación no existe, sin él. */
async function selectLog(
  query: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const first = await query(LOG_SELECT)
  if (!first.error) return first as { data: Record<string, unknown> | null; error: null }
  const plain = await query(LOG_SELECT_PLAIN)
  return plain as { data: Record<string, unknown> | null; error: { message: string } | null }
}

export async function addFoodLog(input: {
  date: string
  meal: Meal
  foodId: string
  quantity: number
}): Promise<LogResult> {
  const { date, meal, foodId, quantity } = input
  if (!isIsoDate(date) || date > todayLima()) return { error: 'Fecha inválida.' }
  if (!isMeal(meal)) return { error: 'Elige una comida.' }
  if (!foodId) return { error: 'Elige un alimento.' }
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QTY) {
    return { error: 'Revisa la cantidad.' }
  }

  const supabase = await createClient()

  // Si ya está ese alimento en esa comida ese día, se suma la cantidad.
  const { data: existing, error: findError } = await supabase
    .from('food_logs')
    .select('id, quantity')
    .eq('log_date', date)
    .eq('meal', meal)
    .eq('food_id', foodId)
    .order('id')
    .limit(1)
    .maybeSingle()
  if (findError) {
    console.error('addFoodLog: búsqueda falló:', findError)
    return { error: 'No se pudo agregar. Inténtalo de nuevo.' }
  }

  const { data, error } = existing
    ? await selectLog((cols) =>
        supabase
          .from('food_logs')
          .update({ quantity: Math.round((Number(existing.quantity) + quantity) * 100) / 100 })
          .eq('id', existing.id)
          .select(cols)
          .single()
      )
    : await selectLog((cols) =>
        supabase
          .from('food_logs')
          .insert({ log_date: date, meal, food_id: foodId, quantity, eaten: true })
          .select(cols)
          .single()
      )
  if (error || !data) {
    console.error('addFoodLog falló:', error)
    return { error: 'No se pudo agregar. Inténtalo de nuevo.' }
  }
  // Se agrega desde /agregar: en una server action, revalidatePath también
  // limpia la caché del router del cliente, así Hoy se ve al día al volver
  // (incluso con el botón atrás del navegador).
  revalidatePath('/')
  return { ok: true, log: toFoodLog(data) }
}

export async function updateFoodLogQuantity(id: string, quantity: number): Promise<LogResult> {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QTY) {
    return { error: 'Revisa la cantidad.' }
  }
  const supabase = await createClient()
  const { data, error } = await selectLog((cols) =>
    supabase.from('food_logs').update({ quantity }).eq('id', id).select(cols).single()
  )
  if (error || !data) {
    console.error('updateFoodLogQuantity falló:', error)
    return { error: 'No se pudo cambiar la cantidad.' }
  }
  return { ok: true, log: toFoodLog(data) }
}

export async function setFoodLogEaten(id: string, eaten: boolean): Promise<LogResult> {
  const supabase = await createClient()
  const { data, error } = await selectLog((cols) =>
    supabase.from('food_logs').update({ eaten }).eq('id', id).select(cols).single()
  )
  if (error || !data) {
    console.error('setFoodLogEaten falló:', error)
    return { error: 'No se pudo actualizar.' }
  }
  return { ok: true, log: toFoodLog(data) }
}

export async function deleteFoodLog(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('food_logs').delete().eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('deleteFoodLog falló:', error ?? '0 filas eliminadas')
    return { error: 'No se pudo quitar.' }
  }
  return { ok: true }
}

// ---------- Platos en una comida (RPCs add_dish_to_log y set_log_items) ----------
// Los triggers copian los macros de cada ingrediente (food_log_items) y
// recalculan los del registro padre como la suma: aquí no se calcula nada.

export async function addDishLog(input: {
  date: string
  meal: Meal
  dishId: string
  portions: number
}): Promise<LogResult> {
  const { date, meal, dishId, portions } = input
  if (!isIsoDate(date) || date > todayLima()) return { error: 'Fecha inválida.' }
  if (!isMeal(meal)) return { error: 'Elige una comida.' }
  if (!dishId) return { error: 'Elige un plato.' }
  if (!Number.isFinite(portions) || portions <= 0 || portions > 1000) {
    return { error: 'Revisa las porciones.' }
  }

  const supabase = await createClient()
  const { data: logId, error } = await supabase.rpc('add_dish_to_log', {
    p_dish_id: Number(dishId),
    p_log_date: date,
    p_meal: meal,
    p_portions: portions,
    // Igual que un alimento agregado desde /agregar: entra como comido.
    p_eaten: true,
  })
  if (error || logId == null) {
    console.error('add_dish_to_log falló:', error)
    return { error: 'No se pudo agregar el plato. Inténtalo de nuevo.' }
  }
  revalidatePath('/')
  const log = await loadLogById(supabase, String(logId))
  if (!log) return { error: 'Se agregó el plato, pero no se pudo leer. Recarga la página.' }
  const { log_date: _date, ...plain } = log
  void _date
  return { ok: true, log: plain }
}

export type LogItemInput = { foodId: string; quantity: number }

/** Reemplaza los ingredientes de un registro de plato (solo esa comida). */
export async function setLogItems(
  logId: string,
  items: LogItemInput[]
): Promise<{ error: string } | { ok: true }> {
  if (!logId) return { error: 'Registro inválido.' }
  if (!items.length) return { error: 'Agrega al menos un ingrediente.' }
  if (items.some((i) => !i.foodId || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
    return { error: 'Todas las cantidades deben ser mayores a 0.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_log_items', {
    p_log_id: Number(logId),
    p_items: items.map((i) => ({ food_id: Number(i.foodId), quantity: i.quantity })),
  })
  if (error) {
    console.error('set_log_items falló:', error)
    return { error: 'No se pudieron guardar los ingredientes. Inténtalo de nuevo.' }
  }
  revalidatePath('/')
  return { ok: true }
}

// ---------- Peso y cintura (measurements) ----------
// Una fila por día (unique user_id + measured_on), con al menos peso o
// cintura. Cada acción devuelve la fila guardada para reemplazar la optimista.
// revalidatePath de Meta y Hoy: las dos calculan la meta con el último peso.

type MeasurementInput = { date: string; weightKg: number | null; waistCm: number | null }
type MeasurementResult = { error: string } | { ok: true; measurement: Measurement }

function validateMeasurement({ date, weightKg, waistCm }: MeasurementInput): string | null {
  if (!isIsoDate(date) || date > todayLima()) return 'Elige una fecha que no sea futura.'
  if (weightKg == null && waistCm == null) return ERR_NINGUNO
  if (weightKg != null && !validWeight(weightKg)) return ERR_PESO
  if (waistCm != null && !validWaist(waistCm)) return ERR_CINTURA
  return null
}

const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

function revalidateMeasurements() {
  revalidatePath('/meta')
  revalidatePath('/')
}

/** Nueva medición: si ya hay una ese día, se completa (un campo vacío no borra). */
export async function saveMeasurement(input: MeasurementInput): Promise<MeasurementResult> {
  const invalid = validateMeasurement(input)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Tu sesión expiró. Vuelve a ingresar.' }

  const { data: existing, error: findError } = await supabase
    .from('measurements')
    .select('weight_kg, waist_cm')
    .eq('user_id', user.id)
    .eq('measured_on', input.date)
    .maybeSingle()
  if (findError) {
    console.error('saveMeasurement: búsqueda falló:', findError)
    return { error: 'No se pudo guardar la medición.' }
  }

  const { data, error } = await supabase
    .from('measurements')
    .upsert(
      {
        user_id: user.id,
        measured_on: input.date,
        weight_kg: round2(input.weightKg) ?? existing?.weight_kg ?? null,
        waist_cm: round2(input.waistCm) ?? existing?.waist_cm ?? null,
      },
      { onConflict: 'user_id,measured_on' }
    )
    .select(MEASUREMENT_SELECT)
    .single()
  if (error || !data) {
    console.error('saveMeasurement falló:', error)
    return { error: 'No se pudo guardar la medición.' }
  }
  revalidateMeasurements()
  return { ok: true, measurement: toMeasurement(data as unknown as Record<string, unknown>) }
}

/** Editar: los valores quedan tal cual (se puede vaciar uno, no los dos). */
export async function updateMeasurement(
  id: string,
  input: MeasurementInput
): Promise<MeasurementResult> {
  const invalid = validateMeasurement(input)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { data: clash, error: clashError } = await supabase
    .from('measurements')
    .select('id')
    .eq('measured_on', input.date)
    .neq('id', id)
    .limit(1)
    .maybeSingle()
  if (clashError) {
    console.error('updateMeasurement: búsqueda falló:', clashError)
    return { error: 'No se pudo guardar la medición.' }
  }
  if (clash) return { error: ERR_FECHA_OCUPADA }

  const { data, error } = await supabase
    .from('measurements')
    .update({
      measured_on: input.date,
      weight_kg: round2(input.weightKg),
      waist_cm: round2(input.waistCm),
    })
    .eq('id', id)
    .select(MEASUREMENT_SELECT)
    .single()
  if (error || !data) {
    console.error('updateMeasurement falló:', error)
    // 23505: unique (user_id, measured_on), por si otra pestaña ganó la carrera.
    return { error: error?.code === '23505' ? ERR_FECHA_OCUPADA : 'No se pudo guardar la medición.' }
  }
  revalidateMeasurements()
  return { ok: true, measurement: toMeasurement(data as unknown as Record<string, unknown>) }
}

export async function deleteMeasurement(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('measurements').delete().eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('deleteMeasurement falló:', error ?? '0 filas eliminadas')
    return { error: 'No se pudo eliminar la medición.' }
  }
  revalidateMeasurements()
  return { ok: true }
}
