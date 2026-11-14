// Cálculo de la meta diaria (kcal y macros). Funciones puras: las usan /meta
// y, más adelante, Hoy. Sin dependencias de React ni de Supabase.

export type Sex = 'm' | 'f'
export type Activity = 'sedentario' | 'ligera' | 'moderada' | 'alta' | 'muy_alta'
export type Pace = 'mantener' | 'suave' | 'moderado' | 'rapido'

export const ACTIVITIES: { value: Activity; label: string; detail: string; factor: number }[] = [
  { value: 'sedentario', label: 'Sedentario', detail: 'Escritorio, casi sin ejercicio', factor: 1.2 },
  { value: 'ligera', label: 'Ligera', detail: '1–3 días/semana', factor: 1.375 },
  { value: 'moderada', label: 'Moderada', detail: '3–5 días/semana', factor: 1.55 },
  { value: 'alta', label: 'Alta', detail: 'Intenso 6–7 días/semana', factor: 1.725 },
  { value: 'muy_alta', label: 'Muy alta', detail: 'Trabajo físico + entrenamiento diario', factor: 1.9 },
]

export const PACES: { value: Pace; label: string; deficit: number }[] = [
  { value: 'mantener', label: 'Mantener', deficit: 0 },
  { value: 'suave', label: 'Bajar suave', deficit: 250 },
  { value: 'moderado', label: 'Bajar moderado', deficit: 450 },
  { value: 'rapido', label: 'Bajar rápido', deficit: 700 },
]

export const DEFAULT_PROTEIN_PER_KG = 1.8
export const DEFAULT_FAT_PER_KG = 0.8

const KCAL_POR_KG_GRASA = 7700

export const AVISO_BAJO_TMB =
  'Tu meta queda por debajo de tu metabolismo basal. Elige un ritmo más suave.'
export const AVISO_RAPIDO =
  'Un déficit de 700 kcal acelera la bajada, pero puede costarte músculo y rendimiento.'

/** Fecha de hoy en Lima como 'YYYY-MM-DD'. */
export function todayLima(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Edad en años cumplidos a la fecha `today` ('YYYY-MM-DD'). */
export function ageFrom(birthDate: string, today: string = todayLima()): number {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}

/** Kg por semana que se bajan con un déficit diario dado. */
export function kgPerWeek(deficit: number): number {
  return (deficit * 7) / KCAL_POR_KG_GRASA
}

export type GoalsInput = {
  sex: Sex | null
  birthDate: string | null
  heightCm: number | null
  weightKg: number | null
  activity: Activity | null
  pace: Pace | null
  proteinPerKg?: number | null
  fatPerKg?: number | null
}

export type Goals = {
  age: number
  bmr: number
  factor: number
  tdee: number
  deficit: number
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
  kgPerWeek: number
  proteinPerKg: number
  fatPerKg: number
  warnings: string[]
}

/**
 * Meta diaria con Mifflin-St Jeor. Devuelve null si falta algún dato
 * (sexo, fecha de nacimiento, talla, peso, actividad u objetivo).
 */
export function computeGoals(input: GoalsInput, today: string = todayLima()): Goals | null {
  const { sex, birthDate, heightCm, weightKg, activity, pace } = input
  if (!sex || !birthDate || !activity || !pace) return null
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return null

  const act = ACTIVITIES.find((a) => a.value === activity)
  const pc = PACES.find((p) => p.value === pace)
  if (!act || !pc) return null

  const age = ageFrom(birthDate, today)
  if (!Number.isFinite(age) || age < 0) return null

  const proteinPerKg = input.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG
  const fatPerKg = input.fatPerKg ?? DEFAULT_FAT_PER_KG

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161)
  const tdee = bmr * act.factor
  const deficit = pc.deficit
  const kcal = Math.round((tdee - deficit) / 50) * 50

  const proteinG = Math.round(weightKg * proteinPerKg)
  const fatG = Math.round(weightKg * fatPerKg)
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))

  const warnings: string[] = []
  if (kcal < bmr) warnings.push(AVISO_BAJO_TMB)
  if (pace === 'rapido') warnings.push(AVISO_RAPIDO)

  return {
    age,
    bmr,
    factor: act.factor,
    tdee,
    deficit,
    kcal,
    proteinG,
    fatG,
    carbsG,
    kgPerWeek: kgPerWeek(deficit),
    proteinPerKg,
    fatPerKg,
    warnings,
  }
}
