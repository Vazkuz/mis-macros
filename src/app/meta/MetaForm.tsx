'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveMeta } from '@/app/actions'
import {
  ACTIVITIES,
  PACES,
  computeGoals,
  kgPerWeek,
  todayLima,
  type Activity,
  type Pace,
  type Sex,
} from '@/lib/metas'

export type MetaProfile = {
  sex: Sex | null
  birthDate: string | null
  heightCm: number | null
  activity: Activity | null
  pace: Pace | null
  proteinPerKg: number | null
  fatPerKg: number | null
}

type Editable = {
  sex: Sex | null
  birthDate: string
  height: string
  activity: Activity | null
  pace: Pace | null
}

function toEditable(p: MetaProfile): Editable {
  return {
    sex: p.sex,
    birthDate: p.birthDate ?? '',
    height: p.heightCm != null ? String(p.heightCm) : '',
    activity: p.activity,
    pace: p.pace,
  }
}

const sameEditable = (a: Editable, b: Editable) =>
  a.sex === b.sex &&
  a.birthDate === b.birthDate &&
  Number(a.height || NaN) === Number(b.height || NaN) &&
  a.activity === b.activity &&
  a.pace === b.pace

const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')
const fmtKg = (n: number) => n.toFixed(2)
const fmtFecha = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const parseNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

const cardClass = 'flex flex-col rounded-2xl border border-line bg-card p-4'
const inputClass =
  'min-h-12 w-full min-w-0 rounded-xl border border-line-strong bg-card px-3 text-base focus:outline-3 focus:outline-focus'
const optBase =
  'flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border text-left'
const optState = (on: boolean) => (on ? 'border-acc bg-acc-soft' : 'border-line bg-card')

export default function MetaForm({
  initial,
  lastMeasurement,
  footer,
}: {
  initial: MetaProfile
  lastMeasurement: { weightKg: number; measuredOn: string } | null
  footer?: React.ReactNode
}) {
  const router = useRouter()
  const [baseline, setBaseline] = useState<Editable>(() => toEditable(initial))
  const [form, setForm] = useState<Editable>(() => toEditable(initial))
  const [weightInput, setWeightInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const weightKg = lastMeasurement?.weightKg ?? parseNum(weightInput)

  const goals = useMemo(
    () =>
      computeGoals({
        sex: form.sex,
        birthDate: form.birthDate || null,
        heightCm: parseNum(form.height),
        weightKg,
        activity: form.activity,
        pace: form.pace,
        proteinPerKg: initial.proteinPerKg,
        fatPerKg: initial.fatPerKg,
      }),
    [form, weightKg, initial.proteinPerKg, initial.fatPerKg]
  )

  const weightDirty = !lastMeasurement && weightInput.trim() !== ''
  const dirty = !sameEditable(form, baseline) || weightDirty

  const set = <K extends keyof Editable>(key: K, value: Editable[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }

  function showToast(text: string) {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1600)
  }

  function handleSave() {
    setError(null)
    const heightCm = parseNum(form.height)
    if (!form.sex) return setError('Elige Hombre o Mujer.')
    if (!form.birthDate) return setError('Completa tu fecha de nacimiento.')
    if (!heightCm) return setError('Completa tu talla.')
    if (!form.activity) return setError('Elige tu nivel de actividad.')
    if (!form.pace) return setError('Elige tu objetivo.')
    const newWeight = weightDirty ? parseNum(weightInput) : null
    if (weightDirty && !newWeight) return setError('Revisa tu peso.')

    const sex = form.sex
    const activity = form.activity
    const pace = form.pace
    startTransition(async () => {
      const res = await saveMeta({
        sex,
        birthDate: form.birthDate,
        heightCm,
        activity,
        pace,
        weightKg: newWeight,
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      setBaseline(form)
      setWeightInput('')
      router.refresh()
      showToast('Meta guardada')
    })
  }

  const macros = goals
    ? [
        {
          label: 'Proteína',
          ref: `${goals.proteinPerKg} g/kg`,
          g: goals.proteinG,
          kcal: goals.proteinG * 4,
          bar: 'bg-prot-l',
        },
        {
          label: 'Grasa',
          ref: `${goals.fatPerKg} g/kg`,
          g: goals.fatG,
          kcal: goals.fatG * 9,
          bar: 'bg-fat-l',
        },
        {
          label: 'Carbohidratos',
          ref: 'el resto',
          g: goals.carbsG,
          kcal: goals.carbsG * 4,
          bar: 'bg-carb-l',
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-3.5 min-[900px]:grid min-[900px]:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-5">
      {/* Resultado: arriba en móvil, a la izquierda y sticky desde 900px. */}
      <div className="flex min-w-0 flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-[90px]">
        <div className="flex flex-col gap-2.5 rounded-2xl bg-ink p-4 text-white" aria-live="polite">
          <p className="text-[13px] font-semibold text-disabled">Tu meta diaria</p>
          {goals ? (
            <>
              <p className="num text-5xl leading-none">
                {fmt(goals.kcal)}{' '}
                <span className="text-lg font-medium text-disabled">kcal</span>
              </p>
              <div className="text-sm">
                <Line label="Metabolismo basal" value={`${fmt(goals.bmr)} kcal`} />
                <Line label={`× actividad (${goals.factor})`} value={`${fmt(goals.tdee)} kcal`} />
                <Line
                  label="Déficit"
                  value={goals.deficit ? `−${fmt(goals.deficit)} kcal` : '0'}
                />
                <div className="mt-1 border-t border-ink-line pt-2">
                  <Line
                    label="Ritmo estimado"
                    value={goals.deficit ? `≈ ${fmtKg(goals.kgPerWeek)} kg/sem` : 'Mantener'}
                  />
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-2.5">
                {macros.map((m) => {
                  const pc = goals.kcal > 0 ? Math.round((m.kcal / goals.kcal) * 100) : 0
                  return (
                    <div key={m.label} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span>
                          <b>{m.label}</b> <span className="text-disabled">{m.ref}</span>
                        </span>
                        <b>
                          {m.g} g · {pc}%
                        </b>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-line">
                        <div
                          className={`h-full rounded-full ${m.bar}`}
                          style={{ width: `${Math.min(100, pc)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-[15px] leading-snug">Completa tus datos para calcular tu meta</p>
          )}
        </div>

        {goals?.warnings.map((w) => (
          <p key={w} className="rounded-[10px] bg-warn-bg px-3 py-2.5 text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      {/* Ajustes */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <section className={`${cardClass} gap-3`}>
          <h2 className="text-lg">Tus datos</h2>

          <div className="flex gap-2" role="group" aria-label="Sexo">
            {(
              [
                ['m', 'Hombre'],
                ['f', 'Mujer'],
              ] as const
            ).map(([value, label]) => {
              const on = form.sex === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('sex', value)}
                  className={`min-h-11 cursor-pointer rounded-full border px-[18px] font-semibold ${
                    on ? 'border-acc bg-acc text-white' : 'border-line-strong bg-card'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="birthDate" className="text-sm font-semibold">
                Fecha de nacimiento
              </label>
              <input
                id="birthDate"
                type="date"
                max={todayLima()}
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="height" className="text-sm font-semibold">
                Talla (cm)
              </label>
              <input
                id="height"
                type="number"
                inputMode="numeric"
                min={100}
                max={250}
                placeholder="170"
                value={form.height}
                onChange={(e) => set('height', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {lastMeasurement ? (
              <>
                <span className="text-sm font-semibold">Peso (kg)</span>
                <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-bg px-3 py-2">
                  <span>
                    <span className="num text-lg">{lastMeasurement.weightKg}</span>{' '}
                    <span className="text-sm text-muted">
                      kg · {fmtFecha(lastMeasurement.measuredOn)}
                    </span>
                  </span>
                  <Link
                    href="/progreso"
                    className="inline-flex min-h-9 items-center rounded-lg px-1.5 text-[13px] font-semibold text-acc hover:bg-acc-soft"
                  >
                    Registrar en Peso y cintura
                  </Link>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="weight" className="text-sm font-semibold">
                  Peso (kg)
                </label>
                <input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={30}
                  max={300}
                  placeholder="74.0"
                  value={weightInput}
                  onChange={(e) => {
                    setWeightInput(e.target.value)
                    setError(null)
                  }}
                  className={inputClass}
                />
                <p className="text-xs text-muted">
                  Se guardará como tu primera medición, con fecha de hoy.
                </p>
              </>
            )}
          </div>
        </section>

        <section className={`${cardClass} gap-2`}>
          <h2 className="mb-1 text-lg">Nivel de actividad</h2>
          <div className="flex flex-col gap-2" role="group" aria-label="Nivel de actividad">
            {ACTIVITIES.map((a) => {
              const on = form.activity === a.value
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('activity', a.value)}
                  className={`${optBase} ${optState(on)} min-h-14 px-3.5 py-2.5`}
                >
                  <span>
                    <b className="block text-[15px]">{a.label}</b>
                    <small className="text-[13px] text-muted">{a.detail}</small>
                  </span>
                  <small className="text-[13px] font-semibold whitespace-nowrap text-muted">
                    × {a.factor}
                  </small>
                </button>
              )
            })}
          </div>
        </section>

        <section className={`${cardClass} gap-2`}>
          <h2 className="mb-1 text-lg">Objetivo</h2>
          <div className="flex flex-col gap-2" role="group" aria-label="Objetivo">
            {PACES.map((p) => {
              const on = form.pace === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('pace', p.value)}
                  className={`${optBase} ${optState(on)} min-h-12 px-3.5 py-2`}
                >
                  <b className="text-sm">{p.label}</b>
                  <small className="text-right text-[13px] text-muted">
                    {p.deficit
                      ? `−${p.deficit} kcal/día · ≈${fmtKg(kgPerWeek(p.deficit))} kg/sem`
                      : 'Sin déficit'}
                  </small>
                </button>
              )
            })}
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isPending}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-acc px-[18px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-disabled"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>

        <p className="text-xs text-muted">
          Fórmula Mifflin-St Jeor. Proteína {goals?.proteinPerKg ?? initial.proteinPerKg ?? 1.8}{' '}
          g/kg, grasa {goals?.fatPerKg ?? initial.fatPerKg ?? 0.8} g/kg, carbohidratos el resto.
          Si en 3 semanas la cintura no baja, resta 150 kcal.
        </p>

        {footer}
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-white transition-opacity duration-200 min-[900px]:bottom-8 ${
          toast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-disabled">{label}</span>
      <b>{value}</b>
    </div>
  )
}
