'use client'

import { useMemo } from 'react'
import { MAX_RESULTS, normalize, type Food, type FoodFilter } from '@/lib/foods'

/**
 * Busca en memoria: ignora tildes y mayúsculas, todas las palabras deben
 * aparecer en el nombre. Orden: destacados primero, luego alfabético.
 * Devuelve como máximo MAX_RESULTS filas y el total encontrado.
 */
export function useFoodSearch(
  foods: Food[],
  query: string,
  filter: FoodFilter = 'todos'
): { results: Food[]; total: number } {
  // Índice ordenado una sola vez por lista de alimentos.
  const indexed = useMemo(
    () =>
      foods
        .map((f) => ({ f, key: normalize(f.name) }))
        .sort((a, b) =>
          a.f.featured !== b.f.featured
            ? a.f.featured
              ? -1
              : 1
            : a.f.name.localeCompare(b.f.name, 'es', { sensitivity: 'base' })
        ),
    [foods]
  )

  return useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    const matches = indexed.filter(({ f, key }) => {
      if (filter === 'destacados' && !f.featured) return false
      if (filter !== 'todos' && filter !== 'destacados' && f.source !== filter) return false
      return words.every((w) => key.includes(w))
    })
    return { results: matches.slice(0, MAX_RESULTS).map((m) => m.f), total: matches.length }
  }, [indexed, query, filter])
}
