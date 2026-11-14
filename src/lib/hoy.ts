// Helpers puros de la pantalla Hoy: comidas, fechas y registros (food_logs).

import type { FoodBasis, FoodUnit } from '@/lib/foods'

export type Meal = 'desayuno' | 'almuerzo' | 'snack' | 'cena'

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'snack', label: 'Snack' },
  { value: 'cena', label: 'Cena' },
]

export const MEAL_LABEL: Record<Meal, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  snack: 'Snack',
  cena: 'Cena',
}

export const isMeal = (v: unknown): v is Meal =>
  v === 'desayuno' || v === 'almuerzo' || v === 'snack' || v === 'cena'

/** Hora actual en Lima (0–23). */
export function hourLima(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now)
  return Number(h) % 24
}

/** Comida por defecto según la hora: <11 desayuno, 11–16 almuerzo, 16–19 snack, luego cena. */
export function mealForHour(hour: number): Meal {
  if (hour < 11) return 'desayuno'
  if (hour < 16) return 'almuerzo'
  if (hour < 19) return 'snack'
  return 'cena'
}

export const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** Suma días a 'YYYY-MM-DD' (en UTC, sin problemas de horario). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** 'YYYY-MM-DD' → "Vie 14/11". */
export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${DIAS[d.getUTCDay()]} ${dd}/${mm}`
}

/** Fila de food_logs con la medida del alimento (para unidad y equivalencia). */
export type FoodLog = {
  id: string
  meal: Meal
  food_id: string | null
  food_name: string
  quantity: number
  eaten: boolean
  /** Macros y kcal ya calculados para `quantity` (los pone el trigger). */
  protein: number
  carbs: number
  fat: number
  kcal: number
  basis: FoodBasis
  unit_label: FoodUnit
  grams_per_unit: number | null
}

/** Columnas a pedir; `food` es el alimento relacionado (puede ser null si se borró). */
export const LOG_SELECT =
  'id, meal, food_id, food_name, quantity, eaten, protein, carbs, fat, kcal, food:foods(basis, unit_label, grams_per_unit)'
export const LOG_SELECT_PLAIN =
  'id, meal, food_id, food_name, quantity, eaten, protein, carbs, fat, kcal'

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v))

export function toFoodLog(r: Record<string, unknown>): FoodLog {
  const raw = r.food as Record<string, unknown> | Record<string, unknown>[] | null | undefined
  const food = Array.isArray(raw) ? raw[0] : raw
  return {
    id: String(r.id),
    meal: r.meal as Meal,
    food_id: r.food_id == null ? null : String(r.food_id),
    food_name: String(r.food_name ?? ''),
    quantity: num(r.quantity),
    eaten: Boolean(r.eaten),
    protein: num(r.protein),
    carbs: num(r.carbs),
    fat: num(r.fat),
    kcal: num(r.kcal),
    basis: (food?.basis as FoodBasis) ?? '100g',
    unit_label: (food?.unit_label as FoodUnit) ?? 'g',
    grams_per_unit: food?.grams_per_unit == null ? null : Number(food.grams_per_unit),
  }
}

/** Unidad que se muestra junto a la cantidad: g, mL o u. */
export const qtyUnit = (l: Pick<FoodLog, 'basis' | 'unit_label'>) =>
  l.basis === 'unit' ? 'u' : l.unit_label

/** "= 100 g" para alimentos por unidad (o null si no aplica). */
export function equivalence(
  l: Pick<FoodLog, 'basis' | 'unit_label' | 'grams_per_unit'>,
  quantity: number
): string | null {
  if (l.basis !== 'unit' || !l.grams_per_unit) return null
  const total = Math.round(quantity * l.grams_per_unit * 10) / 10
  return `= ${total.toLocaleString('es-PE')} ${l.unit_label}`
}

/** Macros de `quantity` de un alimento (por 100 g/mL o por unidad). */
export function macrosFor(
  f: { basis: FoodBasis; protein: number; carbs: number; fat: number },
  quantity: number
) {
  const k = f.basis === 'unit' ? quantity : quantity / 100
  const protein = f.protein * k
  const carbs = f.carbs * k
  const fat = f.fat * k
  return { protein, carbs, fat, kcal: 4 * protein + 4 * carbs + 9 * fat }
}
