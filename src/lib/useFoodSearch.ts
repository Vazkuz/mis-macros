'use client'

import { useMemo } from 'react'
import { MAX_RESULTS, normalize, type Food, type FoodFilter } from '@/lib/foods'

const NONE: ReadonlySet<string> = new Set()

/**
 * Busca en memoria: ignora tildes y mayúsculas, todas las palabras deben
 * aparecer en el nombre. Orden: primero los destacados del usuario
 * (`favorites`), luego el resto; alfabético dentro de cada grupo.
 * Con filter 'destacados' solo busca dentro de los destacados.
 * Devuelve como máximo `limit` filas (MAX_RESULTS por defecto) y el total.
 */
export function useFoodSearch(
  foods: Food[],
  query: string,
  {
    filter = 'todos',
    favorites = NONE,
    limit = MAX_RESULTS,
  }: { filter?: FoodFilter; favorites?: ReadonlySet<string>; limit?: number } = {}
): { results: Food[]; total: number } {
  // Índice ordenado una sola vez por lista de alimentos (y de destacados).
  const indexed = useMemo(
    () =>
      foods
        .map((f) => ({ f, key: normalize(f.name), fav: favorites.has(f.id) }))
        .sort((a, b) =>
          a.fav !== b.fav
            ? a.fav
              ? -1
              : 1
            : a.f.name.localeCompare(b.f.name, 'es', { sensitivity: 'base' })
        ),
    [foods, favorites]
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
