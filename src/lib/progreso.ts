// Helpers puros de Peso y cintura (measurements). Sin React ni Supabase:
// los usan la página, la vista, el sheet y las server actions.

import { dayLabel } from '@/lib/hoy'

export type Measurement = {
  id: string
  measuredOn: string // 'YYYY-MM-DD'
  weightKg: number | null
  waistCm: number | null
}

export const MEASUREMENT_SELECT = 'id, measured_on, weight_kg, waist_cm'

export const WEIGHT_MIN = 20
export const WEIGHT_MAX = 300
export const WAIST_MIN = 40
export const WAIST_MAX = 200
/** Cintura/altura por debajo de este valor se considera saludable. */
export const RATIO_SALUDABLE = 0.5

const numOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v))

export function toMeasurement(row: Record<string, unknown>): Measurement {
  return {
    id: String(row.id),
    measuredOn: String(row.measured_on),
    weightKg: numOrNull(row.weight_kg),
    waistCm: numOrNull(row.waist_cm),
  }
}

/** De la más reciente a la más antigua. */
export const sortDesc = (ms: Measurement[]) =>
  [...ms].sort((a, b) => (a.measuredOn < b.measuredOn ? 1 : a.measuredOn > b.measuredOn ? -1 : 0))

/** Meta de cintura: la mitad de la talla, redondeada a 0.5 cm. */
export const waistGoalFor = (heightCm: number | null) =>
  heightCm && heightCm > 0 ? Math.round(heightCm * 0.5 * 2) / 2 : null

/** Hasta `max` decimales, sin ceros sobrantes ("92", "92.5"). */
export function fmtNum(n: number, max = 1): string {
  const k = 10 ** max
  return String(Math.round(n * k) / k)
}

/** Delta con signo tipográfico: "−1", "+0.5", "0". */
export function fmtDelta(d: number): string {
  const r = Math.round(d * 10) / 10
  if (r === 0) return '0'
  return `${r < 0 ? '−' : '+'}${fmtNum(Math.abs(r))}`
}

/** 'YYYY-MM-DD' → "14/11". */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** "Vie 14/11", con el año si no es el actual: "Vie 14/11/2025". */
export const rowDate = (iso: string, currentYear: string) =>
  iso.slice(0, 4) === currentYear ? dayLabel(iso) : `${dayLabel(iso)}/${iso.slice(0, 4)}`

/**
 * Texto del formulario → número. Acepta coma o punto. '' → null;
 * algo que no sea un número → NaN.
 */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  return /^\d+(\.\d+)?$|^\.\d+$/.test(t) ? Number(t) : NaN
}

export const validWeight = (n: number) => Number.isFinite(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX
export const validWaist = (n: number) => Number.isFinite(n) && n >= WAIST_MIN && n <= WAIST_MAX

export const ERR_PESO = `El peso debe estar entre ${WEIGHT_MIN} y ${WEIGHT_MAX} kg.`
export const ERR_CINTURA = `La cintura debe estar entre ${WAIST_MIN} y ${WAIST_MAX} cm.`
export const ERR_NINGUNO = 'Llena al menos uno: peso o cintura.'
export const ERR_FECHA_OCUPADA = 'Ya hay una medición ese día'

export type Summary = {
  latest: Measurement
  waist: number | null
  firstWaist: number | null
  waistDelta: number | null
  waistGoal: number | null
  /** 0–1: avance desde la primera cintura hasta la meta. */
  progress: number
  /** Cintura/altura redondeado a 2 decimales. */
  ratio: number | null
  weight: number | null
  weightDelta: number | null
  bmi: number | null
}

/** Indicadores de la pantalla. `ms` ordenadas de la más reciente a la más antigua. */
export function summarize(ms: Measurement[], heightCm: number | null): Summary | null {
  if (!ms.length) return null
  const waists = ms.filter((m) => m.waistCm != null).map((m) => m.waistCm as number)
  const weights = ms.filter((m) => m.weightKg != null).map((m) => m.weightKg as number)

  const waist = waists[0] ?? null
  const firstWaist = waists.length ? waists[waists.length - 1] : null
  const waistGoal = waistGoalFor(heightCm)

  let progress = 0
  if (waist != null && waistGoal != null) {
    if (waist <= waistGoal) progress = 1
    else if (waists.length > 1 && firstWaist != null && firstWaist > waistGoal) {
      progress = Math.min(1, Math.max(0, (firstWaist - waist) / (firstWaist - waistGoal)))
    }
  }

  const weight = weights[0] ?? null
  const h = heightCm && heightCm > 0 ? heightCm / 100 : null

  return {
    latest: ms[0],
    waist,
    firstWaist,
    waistDelta: waists.length > 1 ? waists[0] - waists[1] : null,
    waistGoal,
    progress,
    ratio: waist != null && heightCm ? Math.round((waist / heightCm) * 100) / 100 : null,
    weight,
    weightDelta: weights.length > 1 ? weights[0] - weights[1] : null,
    bmi: weight != null && h ? Math.round((weight / (h * h)) * 10) / 10 : null,
  }
}
