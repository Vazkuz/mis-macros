'use client'

import { useMemo, useState } from 'react'
import { MAX_RESULTS, normalize, type Food, type FoodFilter } from '@/lib/foods'

const NONE: ReadonlySet<string> = new Set()

/**
 * Busca en memoria: ignora tildes y mayúsculas, todas las palabras deben
 * aparecer en el nombre. Orden: primero los destacados del usuario
 * (`favorites`), luego el resto; alfabético dentro de cada grupo.
 * Con filter 'destacados' solo busca dentro de los destacados.
 * Devuelve como máximo `limit` filas (MAX_RESULTS por defecto) y el total.
 *
 * Orden estable: el orden y el filtro 'destacados' usan una FOTO de
 * `favorites` tomada al montar y cada vez que cambian la búsqueda, el filtro
 * o `favoritesReady` (cuando terminan de cargar). Alternar una estrella no
 * mueve la fila ni la saca de la lista; la estrella en sí se pinta en vivo
 * con isFavorite. La foto se renueva en la próxima tecla o cambio de filtro.
 */
export function useFoodSearch(
  foods: Food[],
  query: string,
  {
    filter = 'todos',
    favorites = NONE,
    favoritesReady = true,
    limit = MAX_RESULTS,
  }: {
    filter?: FoodFilter
    favorites?: ReadonlySet<string>
    favoritesReady?: boolean
    limit?: number
  } = {}
): { results: Food[]; total: number } {
  // Foto de favoritos: se actualiza en el render en que cambia la clave
  // (patrón "estado derivado de props"; sin efecto ni render extra visible).
  const key = `${filter}\u0000${query}\u0000${favoritesReady}`
  const [snap, setSnap] = useState({ key, favs: favorites })
  let frozen = snap.favs
  if (snap.key !== key) {
    setSnap({ key, favs: favorites })
    frozen = favorites
  }

  // Índice ordenado una sola vez por lista de alimentos (y por foto).
  const indexed = useMemo(
    () =>
      foods
        .map((f) => ({ f, key: normalize(f.name), fav: frozen.has(f.id) }))
        .sort((a, b) =>
          a.fav !== b.fav
            ? a.fav
              ? -1
              : 1
            : a.f.name.localeCompare(b.f.name, 'es', { sensitivity: 'base' })
        ),
    [foods, frozen]
  )

  return useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    const matches = indexed.filter(({ f, key, fav }) => {
      if (filter === 'destacados' && !fav) return false
      if (filter !== 'todos' && filter !== 'destacados' && f.source !== filter) return false
      return words.every((w) => key.includes(w))
    })
    return { results: matches.slice(0, limit).map((m) => m.f), total: matches.length }
  }, [indexed, query, filter, limit])
}
