'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Aviso breve (mockup: .toast). `show(texto)` lo muestra 1.6 s. */
export function useToast() {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const show = useCallback((t: string) => {
    setText(t)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setText(null), 1600)
  }, [])

  return { text, show }
}

/**
 * `inline`: posición absoluta al fondo del contenedor (que debe ser
 * `relative`), en vez de fija sobre la barra de pestañas. Lo usa /agregar,
 * cuyo contenedor sigue al visualViewport: así el aviso no queda detrás del
 * teclado en iOS.
 */
export default function Toast({ text, inline = false }: { text: string | null; inline?: boolean }) {
  const pos = inline
    ? 'absolute bottom-4'
    : 'fixed bottom-[calc(96px+env(safe-area-inset-bottom))] min-[900px]:bottom-8'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none left-1/2 z-[70] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm whitespace-nowrap text-white transition-opacity duration-200 ${pos} ${
        text ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {text}
    </div>
  )
}
