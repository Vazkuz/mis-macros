'use client'

import { useEffect, useState } from 'react'

/**
 * Estilo para una pantalla completa con la altura VISIBLE (cabecera fija y
 * solo el contenido de abajo se desplaza). Lo usan /agregar, /platos y
 * /comida.
 * - Android: el viewport raíz usa interactiveWidget 'resizes-content', así
 *   que 100dvh ya se achica con el teclado.
 * - iOS: el teclado no achica la página; se sigue al visualViewport (alto y
 *   desplazamiento) para que lo enfocado nunca quede tapado.
 */
export function useVisibleViewportStyle(): React.CSSProperties {
  const [vv, setVv] = useState<{ height: number; top: number } | null>(null)

  useEffect(() => {
    const view = window.visualViewport
    if (!view) return
    const sync = () => setVv({ height: view.height, top: view.offsetTop })
    sync()
    view.addEventListener('resize', sync)
    view.addEventListener('scroll', sync)
    return () => {
      view.removeEventListener('resize', sync)
      view.removeEventListener('scroll', sync)
    }
  }, [])

  return {
    height: vv ? `${vv.height}px` : '100dvh',
    transform: vv && vv.top ? `translateY(${vv.top}px)` : undefined,
  }
}
