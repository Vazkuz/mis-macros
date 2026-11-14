'use client'

import { useRef } from 'react'
import type { PointerEvent } from 'react'

// Copiado tal cual de Mis Gastos.

/**
 * Cierra el diálogo solo si el gesto (click o touch) empezó Y terminó en el
 * backdrop. El evento `click` del DOM se dispara en el ancestro común más
 * cercano entre el target del `pointerdown` y el del `pointerup`: si el
 * gesto arranca en un input adentro del diálogo y suelta afuera, ese
 * ancestro común es el backdrop, así que un `onClick` directo lo cerraría
 * igual aunque el gesto haya empezado adentro. Por eso se registra
 * dónde empezó y dónde terminó el gesto en vez de confiar en el target del
 * click.
 */
export function useBackdropClose(onClose: () => void) {
  const startedOnBackdrop = useRef(false)
  const endedOnBackdrop = useRef(false)

  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      startedOnBackdrop.current = e.target === e.currentTarget
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      endedOnBackdrop.current = e.target === e.currentTarget
    },
    onClick: () => {
      if (startedOnBackdrop.current && endedOnBackdrop.current) onClose()
      startedOnBackdrop.current = false
      endedOnBackdrop.current = false
    },
  }
}
