'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { ToastAction } from '@/components/Toast'

// Destacados POR USUARIO (tabla user_favorite_foods; RLS: cada uno ve, crea y
// borra solo los suyos). Se cargan UNA vez por sesión de página y se
// comparten entre pantallas (mismo patrón de caché que useFoods), con una
// tiendita externa para que todas las estrellas se enteren de los cambios.
// Si cambia el usuario (cerrar sesión y entrar con otra cuenta sin recargar),
// se vuelven a pedir.

type State = { ids: ReadonlySet<string>; status: 'loading' | 'ready' | 'error' }

const INITIAL: State = { ids: new Set(), status: 'loading' }
let state: State = INITIAL
let loadedFor: string | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
// Escrituras en cola por alimento: un "Deshacer" rápido no se adelanta al
// insert/delete anterior.
const queues = new Map<string, Promise<unknown>>()

function setState(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function withId(id: string, on: boolean) {
  const ids = new Set(state.ids)
  if (on) ids.add(id)
  else ids.delete(id)
  setState({ ids })
}

async function load() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user.id ?? null
  if (uid && uid === loadedFor && state.status === 'ready') return
  if (uid !== loadedFor) setState({ ids: new Set(), status: 'loading' })
  const { data, error } = await supabase.from('user_favorite_foods').select('food_id')
  if (error) throw error
  loadedFor = uid
  setState({ ids: new Set((data ?? []).map((r) => String(r.food_id))), status: 'ready' })
}

function ensureLoaded() {
  if (!inflight) {
    inflight = load()
      .catch((err) => {
        console.error('useFavorites: no se pudieron cargar los destacados:', err)
        if (state.status !== 'ready') setState({ status: 'error' })
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

async function write(id: string, on: boolean): Promise<boolean> {
  const table = createClient().from('user_favorite_foods')
  const { error } = on
    ? await table.insert({ food_id: Number(id) })
    : await table.delete().eq('food_id', Number(id))
  // 23505: ya estaba (p. ej. otra pestaña lo agregó). Para el usuario es lo mismo.
  if (error && error.code !== '23505') {
    console.error('useFavorites: no se pudo guardar:', error)
    return false
  }
  return true
}

type Notify = (text: string, action?: ToastAction) => void

function toggle(id: string, name: string, notify: Notify | undefined, isUndo: boolean) {
  const on = !state.ids.has(id)
  withId(id, on)
  notify?.(
    `${name} ${on ? 'agregado a' : 'quitado de'} destacados`,
    isUndo ? undefined : { label: 'Deshacer', onClick: () => toggle(id, name, notify, true) }
  )
  const queued = (queues.get(id) ?? Promise.resolve()).then(() => write(id, on))
  queues.set(id, queued)
  queued.then((ok) => {
    if (queues.get(id) === queued) queues.delete(id)
    if (ok) return
    withId(id, !on)
    notify?.('No se pudo actualizar tus destacados. Inténtalo de nuevo.')
  })
}

/**
 * Destacados del usuario. `notify` (normalmente toast.show) recibe el aviso
 * "<nombre> agregado a destacados" con la acción Deshacer, o el error.
 */
export function useFavorites(notify?: Notify) {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  )

  useEffect(() => {
    void ensureLoaded()
  }, [])

  const isFavorite = useCallback(
    (id: string | null | undefined) => id != null && snap.ids.has(id),
    [snap.ids]
  )

  const toggleFavorite = useCallback(
    (id: string, name: string) => toggle(id, name, notify, false),
    [notify]
  )

  return { favorites: snap.ids, status: snap.status, isFavorite, toggleFavorite }
}
