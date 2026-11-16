'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Botón opcional del aviso (p. ej. "Deshacer"). */
export type ToastAction = { label: string; onClick: () => void }

// Aviso para la PRÓXIMA pantalla: se deja antes de navegar (p. ej. "Plato
// actualizado" al volver del editor) y lo muestra el primer useToast que se
// monte después.
let flash: string | null = null

/** Deja un aviso para mostrarlo en la pantalla a la que se va a navegar. */
export function flashToast(text: string) {
  flash = text
}

/**
 * Aviso breve (mockup: .toast). `show(texto)` lo muestra 1.6 s; con
 * `show(texto, acción)` dura 4 s para que dé tiempo de tocar el botón.
 */
export function useToast() {
  const [state, setState] = useState<{ text: string; action?: ToastAction } | null>(() =>
    flash ? { text: flash } : null
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fromFlash = useRef(state?.text ?? null)

  // Aviso heredado de la pantalla anterior: se consume y se oculta solo.
  useEffect(() => {
    if (!fromFlash.current) return
    if (flash === fromFlash.current) flash = null
    timer.current = setTimeout(() => setState(null), 2400)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setState(null)
  }, [])

  const show = useCallback((text: string, action?: ToastAction) => {
    setState({ text, action })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState(null), action ? 4000 : 1600)
  }, [])

  // El botón cierra el aviso antes de ejecutar la acción.
  const action = state?.action
    ? {
        label: state.action.label,
        onClick: () => {
          const run = state.action!.onClick
          hide()
          run()
        },
      }
    : undefined

  return { text: state?.text ?? null, action, show }
}

/**
 * `inline`: posición absoluta al fondo del contenedor (que debe ser
 * `relative`), en vez de fija sobre la barra de pestañas. Lo usa /agregar,
 * cuyo contenedor sigue al visualViewport: así el aviso no queda detrás del
 * teclado en iOS.
 */
export default function Toast({
  text,
  action,
  inline = false,
}: {
  text: string | null
  action?: ToastAction
  inline?: boolean
}) {
  const pos = inline
    ? 'absolute bottom-4'
    : 'fixed bottom-[calc(96px+env(safe-area-inset-bottom))] min-[900px]:bottom-8'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-white transition-opacity duration-200 ${pos} ${
        text ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span className={action ? 'min-w-0 truncate' : 'whitespace-nowrap'}>{text}</span>
      {text && action && (
        <button
          type="button"
          onClick={action.onClick}
          className="pointer-events-auto -my-1.5 -mr-2 shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-sm font-semibold text-mint hover:bg-ink-line"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
