import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { loadLogById } from '@/lib/loadLogs'
import { isDishLog } from '@/lib/hoy'
import { todayLima } from '@/lib/metas'
import ComidaEditor from './ComidaEditor'

export const metadata: Metadata = { title: 'Ingredientes · Mis Macros' }

// /comida/[logId] — ingredientes de UN registro de plato (pantalla completa,
// sin Shell). Editar aquí no cambia el plato, salvo que se marque la casilla.
export default async function ComidaPage({ params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params
  if (!/^\d+$/.test(logId)) notFound()

  const supabase = await createClient()
  const log = await loadLogById(supabase, logId)
  if (!log) notFound()
  // Un alimento suelto no tiene ingredientes: se edita en Hoy. (Fuera de try.)
  if (!isDishLog(log)) redirect('/')

  // Nombre ACTUAL del plato (para "Guardar también en el plato").
  let dishName: string | null = null
  if (log.dish_id) {
    const { data } = await supabase
      .from('dishes')
      .select('name')
      .eq('id', log.dish_id)
      .maybeSingle()
    dishName = data?.name ?? null
  }

  return (
    <ComidaEditor
      key={log.id}
      log={log}
      isToday={log.log_date === todayLima()}
      dishName={dishName}
    />
  )
}
