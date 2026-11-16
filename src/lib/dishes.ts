// Platos propios (tablas dishes y dish_items). Helpers puros: los usan el
// cliente (useDishes, editor) y el servidor (/platos/[id]).

import { kcalOf, quantityLabel, type FoodBasis, type FoodUnit } from '@/lib/foods'

/**
 * Ingrediente con los macros del alimento POR BASE (por 100 g/mL o por
 * unidad), para calcular totales en vivo con cualquier cantidad.
 */
export type DishItem = {
  food_id: string | null
  name: string
  basis: FoodBasis
  unit_label: FoodUnit
  quantity: number
  protein: number
  carbs: number
  fat: number
}

export type Dish = {
  id: string
  name: string
  favorite: boolean
  items: DishItem[]
}

export const DISH_SELECT =
  'id, name, favorite, dish_items(food_id, quantity, position, food:foods(name, basis, unit_label, protein, carbs, fat))'

const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v))
const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

export function toDish(r: Record<string, unknown>): Dish {
  const rows = ((r.dish_items as Record<string, unknown>[] | null) ?? [])
    .slice()
    .sort((a, b) => n(a.position) - n(b.position))
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    favorite: Boolean(r.favorite),
    items: rows.map((it) => {
      const food = one(it.food as Record<string, unknown> | Record<string, unknown>[] | null)
      return {
        food_id: it.food_id == null ? null : String(it.food_id),
        name: String(food?.name ?? 'Alimento'),
        basis: (food?.basis as FoodBasis) ?? '100g',
        unit_label: (food?.unit_label as FoodUnit) ?? 'g',
        quantity: n(it.quantity),
        protein: n(food?.protein),
        carbs: n(food?.carbs),
        fat: n(food?.fat),
      }
    }),
  }
}

/** Factor de una cantidad según la base: por unidad o por 100. */
export const basisFactor = (basis: FoodBasis, quantity: number) =>
  basis === 'unit' ? quantity : quantity / 100

/** Macros y kcal de una lista de ingredientes (× factor, p. ej. porciones). */
export function itemsTotals(
  items: Pick<DishItem, 'basis' | 'quantity' | 'protein' | 'carbs' | 'fat'>[],
  factor = 1
) {
  let protein = 0
  let carbs = 0
  let fat = 0
  for (const it of items) {
    const k = basisFactor(it.basis, it.quantity) * factor
    protein += it.protein * k
    carbs += it.carbs * k
    fat += it.fat * k
  }
  return { protein, carbs, fat, kcal: kcalOf(protein, carbs, fat) }
}

/** "Leche fresca entera 100 mL · Azúcar blanca 5 g · …" */
export const itemsLine = (items: DishItem[]) =>
  items.map((it) => `${it.name} ${quantityLabel(it.basis, it.unit_label, it.quantity)}`).join(' · ')

/** "1 porción" / "1.5 porciones". */
export function portionsLabel(q: number): string {
  return `${(Math.round(q * 100) / 100).toLocaleString('es-PE')} ${q === 1 ? 'porción' : 'porciones'}`
}

/** Cantidad por defecto al agregar un ingrediente: 1 unidad, 100 mL o 5 g. */
export const defaultQty = (f: { basis: FoodBasis; unit_label: FoodUnit }) =>
  f.basis === 'unit' ? 1 : f.unit_label === 'mL' ? 100 : 5
