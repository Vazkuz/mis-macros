import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { DISH_SELECT, toDish } from '@/lib/dishes'
import PlatoEditor from '../PlatoEditor'

export const metadata: Metadata = { title: 'Editar plato · Mis Macros' }

// /platos/[id] — pantalla completa (sin Shell). RLS: solo el dueño lo ve.
export default async function EditarPlatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .select(DISH_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('No se pudo cargar el plato:', error)
  if (!data) notFound()

  const dish = toDish(data as unknown as Record<string, unknown>)
  return <PlatoEditor key={dish.id} dish={dish} agregarHref="/agregar" />
}
