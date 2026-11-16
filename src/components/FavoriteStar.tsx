'use client'

import { Star } from 'lucide-react'

/**
 * Estrella para alternar un destacado. Rellena en ámbar si lo es, contorno
 * gris si no. Área táctil de 36px. No propaga el clic (la fila de abajo no
 * se selecciona ni se despliega) y no le quita el foco al buscador.
 */
export default function FavoriteStar({
  on,
  name,
  onToggle,
  disabled = false,
}: {
  on: boolean
  name: string
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Quitar ${name} de destacados` : `Agregar ${name} a destacados`}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-bg disabled:cursor-wait ${
        on ? 'text-carb' : 'text-star-off'
      }`}
    >
      <Star size={18} strokeWidth={2} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )
}
