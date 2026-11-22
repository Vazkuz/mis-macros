'use client'

import { useEffect, useRef, useState } from 'react'
import { ddmm, fmtNum } from '@/lib/progreso'

type Point = { date: string; value: number }
/** Franja saludable: `lo` null = sin borde inferior. */
export type Band = { lo: number | null; hi: number; label: string }

const H = 190
const PAD = { top: 14, right: 12, bottom: 24, left: 38 }

const dayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

/**
 * Línea de evolución en SVG, sin librerías. Eje X proporcional a la fecha;
 * etiquetas solo en la primera y la última fecha, y en el mínimo y el máximo.
 * El ancho del viewBox sigue al ancho real del contenedor para que el texto
 * no se agrande en laptop.
 */
export default function TrendChart({
  points,
  goal,
  band = null,
  extent = [],
  label,
}: {
  /** Ordenados de la más antigua a la más reciente. */
  points: Point[]
  goal: number | null
  /** Se dibuja detrás de la línea, recortada al rango Y visible. */
  band?: Band | null
  /** Valores extra que el rango Y debe incluir (p. ej. el borde superior de la franja). */
  extent?: number[]
  label: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = points.map((p) => p.value)
  const all = [...values, ...(goal != null ? [goal] : []), ...extent]
  const min = Math.min(...all)
  const max = Math.max(...all)
  // Margen para que los puntos no toquen el borde; con un solo valor, ±1.
  const span = max - min || 2
  const lo = max === min ? min - 1 : min - span * 0.08
  const hi = max === min ? max + 1 : max + span * 0.08

  const x0 = PAD.left
  const x1 = width - PAD.right
  const y0 = PAD.top
  const y1 = H - PAD.bottom
  const d0 = points.length ? dayNum(points[0].date) : 0
  const d1 = points.length ? dayNum(points[points.length - 1].date) : 0

  const xOf = (iso: string) => (d1 === d0 ? (x0 + x1) / 2 : x0 + ((dayNum(iso) - d0) / (d1 - d0)) * (x1 - x0))
  const yOf = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0)

  // Tramo de la franja que cae dentro del rango Y visible.
  const bandTop = band ? Math.min(band.hi, hi) : 0
  const bandBottom = band ? Math.max(band.lo ?? -Infinity, lo) : 0
  const showBand = band != null && bandTop > bandBottom
  const bandY = showBand ? yOf(bandTop) : 0
  const bandH = showBand ? yOf(bandBottom) - bandY : 0

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div ref={boxRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={label}
        className="block overflow-visible"
      >
        {showBand && (
          <g>
            <rect x={x0} y={bandY} width={x1 - x0} height={bandH} className="fill-acc-soft" />
            {bandH >= 16 && (
              <text
                x={x1 - 4}
                y={bandY + 12}
                textAnchor="end"
                className="fill-acc text-[10px] font-semibold"
              >
                {band.label}
              </text>
            )}
          </g>
        )}

        {/* Guías del mínimo y el máximo */}
        {[min, max].map((v, i) =>
          i === 1 && max === min ? null : (
            <g key={i}>
              <line x1={x0} x2={x1} y1={yOf(v)} y2={yOf(v)} className="stroke-line2" strokeWidth={1} />
              <text
                x={x0 - 6}
                y={yOf(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="num fill-muted text-[11px]"
              >
                {fmtNum(v)}
              </text>
            </g>
          )
        )}

        {goal != null && (
          <g>
            <line
              x1={x0}
              x2={x1}
              y1={yOf(goal)}
              y2={yOf(goal)}
              className="stroke-acc"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={x1} y={yOf(goal) - 5} textAnchor="end" className="fill-acc text-[11px] font-semibold">
              Meta {fmtNum(goal)}
            </text>
          </g>
        )}

        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            className="stroke-prot"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p) => (
          <circle
            key={p.date}
            cx={xOf(p.date)}
            cy={yOf(p.value)}
            r={3.75}
            className="fill-prot stroke-card"
            strokeWidth={1.5}
          />
        ))}

        {first && (
          <text
            x={points.length > 1 ? x0 : xOf(first.date)}
            y={H - 6}
            textAnchor={points.length > 1 ? 'start' : 'middle'}
            className="fill-muted text-[11px]"
          >
            {ddmm(first.date)}
          </text>
        )}
        {last && points.length > 1 && (
          <text x={x1} y={H - 6} textAnchor="end" className="fill-muted text-[11px]">
            {ddmm(last.date)}
          </text>
        )}
      </svg>
    </div>
  )
}
