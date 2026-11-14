import type { SupabaseClient } from '@supabase/supabase-js'

// Base de alimentos. Son ~1000 filas: se cargan todas una vez y se buscan en
// memoria con useFoodSearch (src/lib/useFoodSearch.ts), que también usará
// el sheet de Hoy.

export type FoodSource = 'ins' | 'plato' | 'producto'
export type FoodBasis = '100g' | 'unit'
export type FoodUnit = 'g' | 'mL'

export type Food = {
  id: string
  name: string
  source: FoodSource
  basis: FoodBasis
  unit_label: FoodUnit
  grams_per_unit: number | null
  protein: number
  carbs: number
  fat: number
  kcal: number
  ins_code: string | null
  featured: boolean
}

export const SOURCE_LABEL: Record<FoodSource, string> = {
  ins: 'INS',
  plato: 'Plato',
  producto: 'Producto',
}

const COLUMNS =
  'id, name, source, basis, unit_label, grams_per_unit, protein, carbs, fat, kcal, ins_code, featured'

const PAGE = 1000

/** Carga todas las filas de foods (pagina de a 1000 por el tope de PostgREST). */
export async function loadFoods(supabase: SupabaseClient): Promise<Food[]> {
  const all: Food[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('foods')
      .select(COLUMNS)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []).map(toFood)
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v))

function toFood(r: Record<string, unknown>): Food {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    source: r.source as FoodSource,
    basis: r.basis as FoodBasis,
    unit_label: (r.unit_label as FoodUnit) ?? 'g',
    grams_per_unit: r.grams_per_unit == null ? null : Number(r.grams_per_unit),
    protein: n(r.protein),
    carbs: n(r.carbs),
    fat: n(r.fat),
    kcal: n(r.kcal),
    ins_code: (r.ins_code as string | null) ?? null,
    featured: Boolean(r.featured),
  }
}

/** kcal a partir de los macros (misma fórmula que la columna generada). */
export const kcalOf = (p: number, c: number, g: number) => 4 * p + 4 * c + 9 * g

/** "por 100 g", "por 100 mL", "por unidad (50 g)" o "por unidad (200 mL)". */
export function basisLabel(f: Pick<Food, 'basis' | 'unit_label' | 'grams_per_unit'>): string {
  if (f.basis === 'unit') {
    return f.grams_per_unit
      ? `por unidad (${round1(f.grams_per_unit)} ${f.unit_label})`
      : 'por unidad'
  }
  return `por 100 ${f.unit_label}`
}

export const round1 = (x: number) => Math.round(x * 10) / 10

/** Minúsculas y sin tildes, para comparar "Camote" con "camóte". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export type FoodFilter = 'todos' | 'destacados' | FoodSource

export const FOOD_FILTERS: { value: FoodFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'destacados', label: 'Destacados' },
  { value: 'ins', label: 'INS' },
  { value: 'plato', label: 'Platos' },
  { value: 'producto', label: 'Productos' },
]

export const MAX_RESULTS = 60
