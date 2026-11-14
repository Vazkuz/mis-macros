'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

// Acción del botón flotante. El botón vive en el Shell, pero lo que hace lo
// decide cada página: la página registra su handler con useFabAction y el
// Shell lo ejecuta al tocar el botón. En pestañas marcadas con
// `fab.needsAction`, el botón solo aparece si hay un handler registrado
// (p. ej. en Alimentos solo el admin registra uno).

let action: (() => void) | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setAction(next: (() => void) | null) {
  action = next
  listeners.forEach((l) => l())
}

/** Registra (o quita, con null) la acción del botón flotante de esta página. */
export function useFabAction(handler: (() => void) | null) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  const enabled = handler != null
  useEffect(() => {
    if (!enabled) return
    const run = () => ref.current?.()
    setAction(run)
    return () => {
      if (action === run) setAction(null)
    }
  }, [enabled])
}

/** Para el Shell: la acción registrada actualmente, o null. */
export function useCurrentFabAction(): (() => void) | null {
  return useSyncExternalStore(
    subscribe,
    () => action,
    () => null
  )
}
