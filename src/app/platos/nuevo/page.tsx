import type { Metadata } from 'next'
import { isIsoDate, isMeal } from '@/lib/hoy'
import PlatoEditor from '../PlatoEditor'

export const metadata: Metadata = { title: 'Nuevo plato · Mis Macros' }

// /platos/nuevo?meal=desayuno&d=2026-11-14 — pantalla completa (sin Shell).
// meal y d solo se conservan para volver a /agregar.
export default async function NuevoPlatoPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; meal?: string }>
}) {
  const { d, meal } = await searchParams
  const params = new URLSearchParams()
  if (isMeal(meal)) params.set('meal', meal)
  if (isIsoDate(d)) params.set('d', d)
  const qs = params.toString()
  return <PlatoEditor dish={null} agregarHref={`/agregar${qs ? `?${qs}` : ''}`} />
}
