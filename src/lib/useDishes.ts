'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DISH_SELECT, toDish, type Dish, type DishItem } from '@/lib/dishes'
import type { ToastAction } from '@/components/Toast'

// Platos propios del usuario con sus ingredientes (RLS: solo los ve su
// dueño). Mismo patrón que useFavorites: se cargan una vez por sesión de
// página, se comparten entre pantallas con una tiendita externa y se vuelven
// a pedir si cambia el usuario.

type State = { dishes: Dish[]; status: 'loading' | 'ready' | 'error' }

const INITIAL: State = { dishes: [], status: 'loading' }
let state: State = INITIAL
let loadedFor: string | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const favQueues = new Map<string, Promise<unknown>>()

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

const byName = (a: Dish, b: Dish) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })

function patch(id: string, fn: (d: Dish) => Dish) {
  setState({ dishes: state.dishes.map((d) => (d.id === id ? fn(d) : d)) })
}

async function load() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user.id ?? null
  if (uid && uid === loadedFor && state.status === 'ready') return
  if (uid !== loadedFor) setState({ dishes: [], status: 'loading' })
  const { data, error } = await supabase.from('dishes').select(DISH_SELECT).order('id')
  if (error) throw error
  loadedFor = uid
  const dishes = ((data ?? []) as unknown as Record<string, unknown>[]).map(toDish).sort(byName)
  setState({ dishes, status: 'ready' })
}

function ensureLoaded() {
  if (!inflight) {
    inflight = load()
      .catch((err) => {
        console.error('useDishes: no se pudieron cargar los platos:', err)
        if (state.status !== 'ready') setState({ status: 'error' })
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

type Notify = (text: string, action?: ToastAction) => void

function toggleFavorite(id: string, notify: Notify | undefined, isUndo: boolean) {
  const dish = state.dishes.find((d) => d.id === id)
  if (!dish) return
  const on = !dish.favorite
  patch(id, (d) => ({ ...d, favorite: on }))
  notify?.(
    `${dish.name} ${on ? 'agregado a' : 'quitado de'} destacados`,
    isUndo ? undefined : { label: 'Deshacer', onClick: () => toggleFavorite(id, notify, true) }
  )
  const queued = (favQueues.get(id) ?? Promise.resolve()).then(async () => {
    const { error } = await createClient()
      .from('dishes')
      .update({ favorite: on })
      .eq('id', Number(id))
    if (error) console.error('useDishes: no se pudo cambiar el destacado:', error)
    return !error
  })
  favQueues.set(id, queued)
  queued.then((ok) => {
    if (favQueues.get(id) === queued) favQueues.delete(id)
    if (ok) return
    patch(id, (d) => ({ ...d, favorite: !on }))
    notify?.('No se pudo actualizar tus destacados. Inténtalo de nuevo.')
  })
}

/** Borra un plato (optimista). Devuelve false si falló (y lo repone). */
async function deleteDish(id: string): Promise<boolean> {
  const index = state.dishes.findIndex((d) => d.id === id)
  if (index < 0) return true
  const dish = state.dishes[index]
  setState({ dishes: state.dishes.filter((d) => d.id !== id) })
  const { error } = await createClient().from('dishes').delete().eq('id', Number(id))
  if (!error) return true
  console.error('useDishes: no se pudo borrar el plato:', error)
  const copy = [...state.dishes]
  copy.splice(Math.min(index, copy.length), 0, dish)
  setState({ dishes: copy })
  return false
}

/**
 * Crea (id null) o reemplaza un plato con la RPC save_dish. No es optimista
 * (hace falta el id); al terminar actualiza la caché con lo guardado.
 * Devuelve el id o null si falló.
 */
async function saveDish(
  id: string | null,
  name: string,
  items: DishItem[]
): Promise<string | null> {
  const { data, error } = await createClient().rpc('save_dish', {
    p_id: id == null ? null : Number(id),
    p_name: name,
    p_items: items.map((it) => ({ food_id: Number(it.food_id), quantity: it.quantity })),
  })
  if (error || data == null) {
    console.error('useDishes: save_dish falló:', error)
    return null
  }
  const savedId = String(data)
  const prev = state.dishes.find((d) => d.id === savedId)
  const dish: Dish = { id: savedId, name, favorite: prev ? prev.favorite : true, items }
  setState({
    dishes: [...state.dishes.filter((d) => d.id !== savedId), dish].sort(byName),
  })
  return savedId
}

/**
 * Platos del usuario. `notify` (normalmente toast.show) recibe el aviso de
 * destacados con "Deshacer", o el error.
 */
export function useDishes(notify?: Notify) {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  )

  useEffect(() => {
    void ensureLoaded()
  }, [])

  const byId = useMemo(() => new Map(snap.dishes.map((d) => [d.id, d])), [snap.dishes])

  const toggleDishFavorite = useCallback(
    (id: string) => toggleFavorite(id, notify, false),
    [notify]
  )

  return {
    dishes: snap.dishes,
    status: snap.status,
    dishById: byId,
    toggleDishFavorite,
    deleteDish,
    saveDish,
  }
}
