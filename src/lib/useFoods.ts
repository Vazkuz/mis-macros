'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { loadFoods, type Food } from '@/lib/foods'

// Base de alimentos en el navegador, cargada UNA vez por sesión de página y
// compartida (cambiar de día en Hoy no la vuelve a pedir).

let cache: Food[] | null = null
let inflight: Promise<Food[]> | null = null

function fetchOnce(): Promise<Food[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = loadFoods(createClient())
      .then((rows) => {
        cache = rows
        return rows
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useFoods(): { foods: Food[]; status: 'loading' | 'ready' | 'error' } {
  const [foods, setFoods] = useState<Food[] | null>(cache)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (cache) return
    let alive = true
    fetchOnce()
      .then((rows) => alive && setFoods(rows))
      .catch((err) => {
        console.error('useFoods: no se pudo cargar la base:', err)
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [])

  return {
    foods: foods ?? [],
    status: foods ? 'ready' : error ? 'error' : 'loading',
  }
}
