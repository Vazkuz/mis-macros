'use client'

import { useMemo, useState } from 'react'
import { MAX_RESULTS, normalize, type Food, type FoodSource } from '@/lib/foods'
import type { Dish } from '@/lib/dishes'

/** Resultado de búsqueda: un alimento de la base o un plato propio. */
export type CatalogEntry =
  | { kind: 'food'; id: string; key: string; name: string; food: Food }
  | { kind: 'dish'; id: string; key: string; name: string; dish: Dish }

const NONE: ReadonlySet<string> = new Set()

/**
 * Busca alimentos y platos propios a la vez (sin tildes ni mayúsculas; todas
 * las palabras deben aparecer en el nombre). Orden por grupos, alfabético
 * dentro de cada uno: platos destacados, alimentos destacados, platos y
 * alimentos.
 *
 * - favOnly: solo destacados (alimentos y platos).
 * - dishes: 'all' mezcla platos y alimentos, 'only' solo platos, 'none' solo
 *   alimentos (p. ej. al filtrar por fuente).
 * - source: solo alimentos de esa fuente (implica dishes 'none').
 *
 * Orden estable (igual que useFoodSearch): el orden y el filtro de
 * destacados usan una FOTO de los destacados tomada al montar y cada vez que
 * cambian la búsqueda, los filtros o `ready`. Alternar una estrella no mueve
 * la fila ni la saca de la lista; la estrella se pinta en vivo.
 */
export function useCatalogSearch(
  foods: Food[],
  dishes: Dish[],
  query: string,
  {
    favOnly = false,
    dishMode = 'all',
    source,
    favorites = NONE,
    ready = true,
    limit = MAX_RESULTS,
  }: {
    favOnly?: boolean
    dishMode?: 'all' | 'only' | 'none'
    source?: FoodSource
    favorites?: ReadonlySet<string>
    ready?: boolean
    limit?: number
  } = {}
): { results: CatalogEntry[]; total: number } {
  const liveDishFavs = useMemo(
    () => new Set(dishes.filter((d) => d.favorite).map((d) => d.id)),
    [dishes]
  )

  // Foto de destacados (alimentos y platos), renovada solo cuando cambia la clave.
  const key = [favOnly, dishMode, source ?? '', query, ready].join('\u0000')
  const [snap, setSnap] = useState({ key, favs: favorites, dishFavs: liveDishFavs })
  let frozen = snap
  if (snap.key !== key) {
    frozen = { key, favs: favorites, dishFavs: liveDishFavs }
    setSnap(frozen)
  }
  const { favs, dishFavs } = frozen

  const indexed = useMemo(() => {
    const entries: { e: CatalogEntry; key: string; fav: boolean; group: number }[] = []
    for (const d of dishes) {
      const fav = dishFavs.has(d.id)
      entries.push({
        e: { kind: 'dish', id: d.id, key: `dish:${d.id}`, name: d.name, dish: d },
        key: normalize(d.name),
        fav,
        group: fav ? 0 : 2,
      })
    }
    for (const f of foods) {
      const fav = favs.has(f.id)
      entries.push({
        e: { kind: 'food', id: f.id, key: `food:${f.id}`, name: f.name, food: f },
        key: normalize(f.name),
        fav,
        group: fav ? 1 : 3,
      })
    }
    return entries.sort((a, b) =>
      a.group !== b.group
        ? a.group - b.group
        : a.e.name.localeCompare(b.e.name, 'es', { sensitivity: 'base' })
    )
  }, [foods, dishes, favs, dishFavs])

  return useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    const mode = source ? 'none' : dishMode
    const matches = indexed.filter(({ e, key, fav }) => {
      if (favOnly && !fav) return false
      if (e.kind === 'dish' && mode === 'none') return false
      if (e.kind === 'food' && mode === 'only') return false
      if (e.kind === 'food' && source && e.food.source !== source) return false
      return words.every((w) => key.includes(w))
    })
    return { results: matches.slice(0, limit).map((m) => m.e), total: matches.length }
  }, [indexed, query, favOnly, dishMode, source, limit])
}
