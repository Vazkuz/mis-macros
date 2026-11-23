'use client'

import { useEffect, useRef, useState } from 'react'
import { ddmm, fmtNum, rowDate } from '@/lib/progreso'

type Point = { date: string; value: number }
/** Franja saludable: `lo` null = sin borde inferior. */
export type Band = { lo: number | null; hi: number; label: string }

const H = 190
const PAD = { top: 14, right: 12, bottom: 24, left: 38 }
/** Margen del eje Y: por debajo del menor valor y por encima del mayor. */
const PAD_BELOW = 3
const PAD_ABOVE = 1
/** Distancia mínima (px) entre dos etiquetas del eje Y. */
const LABEL_GAP = 12
/** Radio del área táctil invisible de cada punto. */
const HIT_R = 14
const TIP_H = 22
const TIP_GAP = 10

const dayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

type AxisLabel = { value: number; text: string; edge: boolean }

/**
 * Línea de evolución en SVG, sin librerías. Eje X proporcional a la fecha;
 * etiquetas en la primera y la última fecha. El eje Y va del menor valor
 * (datos, meta y borde de la franja saludable) − 3 al mayor (datos y meta) + 1,
 * así siempre se ve un tramo de la franja. Tocar o pasar el mouse sobre un
 * punto muestra un globo con la fecha y el valor.
 * El ancho del viewBox sigue al ancho real del contenedor para que el texto
 * no se agrande en laptop.
 */
export default function TrendChart({
  points,
  goal,
  band = null,
  unit,
  currentYear,
  label,
}: {
  /** Ordenados de la más antigua a la más reciente. */
  points: Point[]
  goal: number | null
  /** Se dibuja detrás de la línea, recortada al rango Y visible. */
  band?: Band | null
  unit: string
  currentYear: string
  label: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setWidth(Math.max(240, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // En celular el globo queda hasta tocar fuera del gráfico (u otro punto).
  useEffect(() => {
    if (active == null) return
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active])

  const values = points.map((p) => p.value)
  const withGoal = [...values, ...(goal != null ? [goal] : [])]
  // Bordes enteros: así las etiquetas del máximo y el mínimo caen justo en el borde.
  const lo = Math.floor(Math.min(...withGoal, ...(band ? [band.hi] : [])) - PAD_BELOW)
  const hi = Math.ceil(Math.max(...withGoal) + PAD_ABOVE)

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

  // Etiquetas del eje Y por prioridad: borde saludable > máximo > mínimo.
  // Una etiqueta a menos de LABEL_GAP px de otra ya puesta se oculta.
  const candidates: AxisLabel[] = [
    ...(band && band.hi >= lo && band.hi <= hi ? [{ value: band.hi, text: fmtNum(band.hi), edge: true }] : []),
    { value: hi, text: String(hi), edge: false },
    { value: lo, text: String(lo), edge: false },
  ]
  const axisLabels: AxisLabel[] = []
  for (const c of candidates) {
    if (axisLabels.every((a) => Math.abs(yOf(a.value) - yOf(c.value)) >= LABEL_GAP)) axisLabels.push(c)
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  // Globo del punto activo: encima del punto; si no entra, debajo. Corrido
  // hacia adentro cerca de los bordes para no salirse de la tarjeta.
  const activePoint = active != null ? (points.find((p) => p.date === active) ?? null) : null
  let tip: { x: number; y: number; w: number; text: string } | null = null
  if (activePoint) {
    const text = `${rowDate(activePoint.date, currentYear)} · ${fmtNum(activePoint.value)} ${unit}`
    const w = Math.round(text.length * 6.2 + 18)
    const px = xOf(activePoint.date)
    const py = yOf(activePoint.value)
    const x = Math.min(Math.max(px - w / 2, 0), width - w)
    const above = py - TIP_GAP - TIP_H
    const y = above >= 0 ? above : py + TIP_GAP
    tip = { x, y, w, text }
  }

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

        {/* Guías y etiquetas del eje Y */}
        {axisLabels.map((a) => (
          <g key={`${a.edge ? 'e' : 'v'}${a.value}`}>
            <line x1={x0} x2={x1} y1={yOf(a.value)} y2={yOf(a.value)} className="stroke-line2" strokeWidth={1} />
            <text
              x={x0 - 6}
              y={yOf(a.value)}
              textAnchor="end"
              dominantBaseline="middle"
              className={`num text-[11px] ${a.edge ? 'fill-acc font-semibold' : 'fill-muted'}`}
            >
              {a.text}
            </text>
          </g>
        ))}

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
            r={p.date === active ? 5.75 : 3.75}
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

        {/* Áreas táctiles invisibles, encima de todo */}
        {points.map((p) => (
          <circle
            key={`hit${p.date}`}
            cx={xOf(p.date)}
            cy={yOf(p.value)}
            r={HIT_R}
            fill="transparent"
            className="cursor-pointer outline-none"
            tabIndex={0}
            aria-label={`${rowDate(p.date, currentYear)}: ${fmtNum(p.value)} ${unit}`}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') setActive(p.date)
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setActive((a) => (a === p.date ? null : a))
            }}
            onPointerDown={() => setActive(p.date)}
            onFocus={() => setActive(p.date)}
          />
        ))}

        {tip && (
          <g pointerEvents="none">
            <rect x={tip.x} y={tip.y} width={tip.w} height={TIP_H} rx={7} className="fill-ink" />
            <text
              x={tip.x + tip.w / 2}
              y={tip.y + TIP_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="num fill-card text-[11px] font-semibold"
            >
              {tip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
