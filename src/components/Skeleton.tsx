// Esqueletos para los loading.tsx: bloques grises con la forma de cada
// pantalla, para que el cambio de pestaña se sienta instantáneo.

export function Bone({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-pulse rounded-xl bg-track motion-reduce:animate-none ${className}`}
    />
  )
}

/** Tarjeta blanca con bloques adentro (mismo borde y padding que .card). */
export function CardBones({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 ${className}`}
    >
      {children}
    </div>
  )
}

/** Envoltorio con texto para lectores de pantalla. */
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="contents">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  )
}

/** Dos columnas desde 900px (izquierda 320–380px), igual que Meta y Hoy. */
export const twoCols =
  'flex flex-col gap-3.5 min-[900px]:grid min-[900px]:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-5'
