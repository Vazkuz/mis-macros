import { unstable_rethrow } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOG_SELECT, LOG_SELECT_PLAIN, toFoodLog, type FoodLog } from '@/lib/hoy'

/** Registros (food_logs) de un día, o null si falló la carga. Solo servidor. */
export async function loadLogs(supabase: SupabaseClient, date: string): Promise<FoodLog[] | null> {
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
    console.error('No se pudieron cargar los registros:', err)
    return null
  }
}
