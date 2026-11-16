import { unstable_rethrow } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoodBasis, FoodUnit } from '@/lib/foods'
import {
  LOG_SELECT,
  LOG_SELECT_PLAIN,
  toFoodLog,
  type FoodLog,
  type LogItem,
  type Meal,
} from '@/lib/hoy'

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v))

/**
 * Agrega a cada registro sus ingredientes (food_log_items, por position) con
 * la medida de cada alimento (basis y unit_label). Lanza si falla.
 */
export async function attachItems(supabase: SupabaseClient, logs: FoodLog[]): Promise<FoodLog[]> {
  if (logs.length === 0) return logs
  const { data: rows, error } = await supabase
    .from('food_log_items')
    .select('id, log_id, food_id, food_name, quantity, position, protein, carbs, fat')
    .in(
      'log_id',
      logs.map((l) => Number(l.id))
    )
    .order('position')
  if (error) throw error
  if (!rows?.length) return logs

  // Medida de cada alimento (consulta aparte: no depende de que la relación
  // food_log_items → foods esté declarada).
  const foodIds = [...new Set(rows.map((r) => r.food_id).filter((id) => id != null))]
  const units = new Map<string, { basis: FoodBasis; unit_label: FoodUnit }>()
  if (foodIds.length) {
    const { data: foods, error: foodsError } = await supabase
      .from('foods')
      .select('id, basis, unit_label')
      .in('id', foodIds)
    if (foodsError) throw foodsError
    for (const f of foods ?? []) {
      units.set(String(f.id), { basis: f.basis as FoodBasis, unit_label: f.unit_label as FoodUnit })
    }
  }

  const byLog = new Map<string, LogItem[]>()
  for (const r of rows) {
    const foodId = r.food_id == null ? null : String(r.food_id)
    const u = (foodId && units.get(foodId)) || { basis: '100g' as const, unit_label: 'g' as const }
    const list = byLog.get(String(r.log_id)) ?? []
    list.push({
      id: String(r.id),
      food_id: foodId,
      food_name: String(r.food_name ?? ''),
      quantity: num(r.quantity),
      protein: num(r.protein),
      carbs: num(r.carbs),
      fat: num(r.fat),
      ...u,
    })
    byLog.set(String(r.log_id), list)
  }
  return logs.map((l) => ({ ...l, items: byLog.get(l.id) ?? [] }))
}

/** Registros (food_logs) de un día, o null si falló la carga. Solo servidor. */
export async function loadLogs(supabase: SupabaseClient, date: string): Promise<FoodLog[] | null> {
  try {
    const q = (cols: string) =>
      supabase.from('food_logs').select(cols).eq('log_date', date).order('id')
    let { data, error } = await q(LOG_SELECT)
    // Si la relación food_logs → foods no está declarada, se pide sin ella.
    if (error) ({ data, error } = await q(LOG_SELECT_PLAIN))
    if (error) throw error
    const logs = ((data ?? []) as unknown as Record<string, unknown>[]).map(toFoodLog)
    return await attachItems(supabase, logs)
  } catch (err) {
    unstable_rethrow(err)
    console.error('No se pudieron cargar los registros:', err)
    return null
  }
}

/** Un registro con sus ingredientes, su fecha y su comida (o null). Solo servidor. */
export async function loadLogById(
  supabase: SupabaseClient,
  id: string
): Promise<(FoodLog & { log_date: string }) | null> {
  try {
    const q = (cols: string) =>
      supabase.from('food_logs').select(`log_date, ${cols}`).eq('id', id).maybeSingle()
    let { data, error } = await q(LOG_SELECT)
    if (error) ({ data, error } = await q(LOG_SELECT_PLAIN))
    if (error) throw error
    if (!data) return null
    const row = data as unknown as Record<string, unknown>
    const [log] = await attachItems(supabase, [toFoodLog(row)])
    return { ...log, log_date: String(row.log_date), meal: row.meal as Meal }
  } catch (err) {
    unstable_rethrow(err)
    console.error('No se pudo cargar el registro:', err)
    return null
  }
}
