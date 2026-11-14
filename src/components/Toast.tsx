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

export default function Toast({ text }: { text: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[70] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-white transition-opacity duration-200 min-[900px]:bottom-8 ${
        text ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {text}
    </div>
  )
}
