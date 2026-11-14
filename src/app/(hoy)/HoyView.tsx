'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Trash2 } from 'lucide-react'
import Toast, { useToast } from '@/components/Toast'
import { useFabAction } from '@/lib/fab'
import { round1 } from '@/lib/foods'
import type { Goals } from '@/lib/metas'
import { MEALS, MEAL_LABEL, equivalence, qtyUnit, type FoodLog, type Meal } from '@/lib/hoy'
import { isTempLog, useFoodLogs } from '@/lib/useFoodLogs'

const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')

export default function HoyView({
  date,
  isToday,
  initialLogs,
  loadError,
  goals,
  defaultMeal,
}: {
  date: string
  isToday: boolean
  initialLogs: FoodLog[]
  loadError: boolean
  goals: Goals | null
  defaultMeal: Meal
}) {
  const router = useRouter()
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  const toast = useToast()
  const { logs, toggle, changeQty, remove } = useFoodLogs(initialLogs, date, toast.show)

  // El botón flotante abre /agregar con la comida y la fecha actuales.
  const agregarHref = `/agregar?meal=${meal}&d=${date}`
  const hrefRef = useRef(agregarHref)
  useEffect(() => {
    hrefRef.current = agregarHref
    router.prefetch(agregarHref)
  }, [agregarHref, router])
  const openAgregar = useCallback(() => router.push(hrefRef.current), [router])
  useFabAction(openAgregar)

  function removeWithToast(log: FoodLog) {
    remove(log)
    toast.show(`${log.food_name} quitado`)
  }

  // ---------- Totales ----------
  const totals = useMemo(() => {
    let eaten = 0
    let planned = 0
    let p = 0
    let c = 0
    let g = 0
    const perMeal: Record<Meal, number> = { desayuno: 0, almuerzo: 0, snack: 0, cena: 0 }
    for (const l of logs) {
      perMeal[l.meal] += l.kcal
      if (l.eaten) {
        eaten += l.kcal
        p += l.protein
        c += l.carbs
        g += l.fat
      } else {
        planned += l.kcal
      }
    }
    return { eaten, planned, p, c, g, perMeal }
  }, [logs])

  const mealLogs = logs.filter((l) => l.meal === meal)
  const mealMacros = mealLogs.reduce(
    (a, l) => ({ p: a.p + l.protein, c: a.c + l.carbs, g: a.g + l.fat }),
    { p: 0, c: 0, g: 0 }
  )

  // ---------- Render ----------
  const goal = goals?.kcal ?? 0
  const over = goals != null && totals.eaten > goal
  const eatenPct = goal > 0 ? Math.min(100, (totals.eaten / goal) * 100) : 0
  const plannedPct =
    goal > 0 ? Math.max(0, Math.min(100 - eatenPct, (totals.planned / goal) * 100)) : 0

  return (
    <>
      <h1 className="sr-only">Hoy</h1>

      <div className="flex flex-col gap-3.5 min-[900px]:grid min-[900px]:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-5">
        {/* Resumen + chips: izquierda y sticky desde 900px */}
        <div className="flex min-w-0 flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-[90px]">
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-muted">
                  {isToday ? 'Comido hoy' : 'Comido este día'}
                </p>
                <p className="num mt-0.5 text-[34px] leading-none">
                  {fmt(totals.eaten)}{' '}
                  <span className="text-base font-medium text-muted">
                    {goals ? `/ ${fmt(goal)} kcal` : 'kcal'}
                  </span>
                </p>
              </div>
              <div className="text-right">
                {goals ? (
                  <>
                    <p className="text-[13px] font-semibold text-muted">Te quedan</p>
                    <p className={`num mt-0.5 text-2xl ${over ? 'text-danger' : 'text-acc'}`}>
                      {fmt(goal - totals.eaten)}
                    </p>
                  </>
                ) : (
                  <Link
                    href="/meta"
                    className="inline-flex min-h-9 items-center rounded-lg px-1.5 text-[13px] font-semibold text-acc hover:bg-acc-soft"
                  >
                    Completa tu meta
                  </Link>
                )}
              </div>
            </div>

            {goals && (
              <div className="flex h-3 overflow-hidden rounded-full bg-track" aria-hidden="true">
                <div
                  className={`h-full ${over ? 'bg-danger' : 'bg-acc'}`}
                  style={{ width: `${eatenPct}%` }}
                />
                <div className="h-full bg-acc-plan" style={{ width: `${plannedPct}%` }} />
              </div>
            )}
            <p className="text-xs text-muted">
              {totals.planned > 0
                ? `+${fmt(totals.planned)} kcal planificadas sin marcar`
                : 'Todo lo registrado está marcado como comido'}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['Proteína', totals.p, goals?.proteinG, 'bg-prot'],
                  ['Carbos', totals.c, goals?.carbsG, 'bg-carb'],
                  ['Grasa', totals.g, goals?.fatG, 'bg-fat'],
                ] as const
              ).map(([label, value, target, color]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1.5">
                  <b className="text-[13px]">{label}</b>
                  <div className="h-1.5 overflow-hidden rounded-full bg-track">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: target ? `${Math.min(100, (value / target) * 100)}%` : 0 }}
                    />
                  </div>
                  <span className="text-xs text-muted">
                    {Math.round(value)}
                    {target != null ? ` / ${target}` : ''} g
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Móvil: 4 columnas iguales que siempre entran en una fila (~360px).
              Desde 900px: lista vertical con nombre a la izquierda y kcal a la derecha. */}
          <div
            role="group"
            aria-label="Comida"
            className="grid grid-cols-4 gap-1.5 min-[900px]:flex min-[900px]:flex-col min-[900px]:gap-2"
          >
            {MEALS.map((m) => {
              const on = m.value === meal
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMeal(m.value)}
                  className={`flex h-12 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border px-1 leading-tight min-[900px]:h-auto min-[900px]:min-h-11 min-[900px]:w-full min-[900px]:flex-row min-[900px]:justify-between min-[900px]:px-3.5 min-[900px]:py-1.5 ${
                    on ? 'border-acc bg-acc text-white' : 'border-line bg-card'
                  }`}
                >
                  <b className="text-[13px] whitespace-nowrap min-[900px]:text-sm">{m.label}</b>
                  <small
                    className={`text-[11px] whitespace-nowrap min-[900px]:text-xs ${on ? 'text-acc-soft' : 'text-muted'}`}
                  >
                    {fmt(totals.perMeal[m.value])} kcal
                  </small>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de la comida elegida */}
        <section className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-card p-4">
          <div className="mb-1">
            <h2 className="text-lg">{MEAL_LABEL[meal]}</h2>
            {mealLogs.length > 0 && (
              <span className="text-[13px] font-semibold text-muted">
                P {Math.round(mealMacros.p)} · C {Math.round(mealMacros.c)} · G{' '}
                {Math.round(mealMacros.g)}
              </span>
            )}
          </div>

          {loadError ? (
            <div className="rounded-xl border border-dashed border-line-strong p-[18px] text-center text-sm text-danger">
              No se pudieron cargar tus registros. Recarga la página.
            </div>
          ) : mealLogs.length > 0 ? (
            <ul className="flex flex-col">
              {mealLogs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  onToggle={() => toggle(log)}
                  onQty={(q) => changeQty(log, q)}
                  onDelete={() => removeWithToast(log)}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong p-[18px] text-center text-sm text-muted">
              Aún no hay nada en {MEAL_LABEL[meal].toLowerCase()}. Toca + para agregar.
            </div>
          )}

          <div className="mt-1 flex justify-between gap-2 border-t border-line2 pt-2 text-[13px] text-muted">
            <span>
              {mealLogs.length} {mealLogs.length === 1 ? 'alimento' : 'alimentos'}
            </span>
            <span className="text-right">Toca el círculo para marcar como comido</span>
          </div>
        </section>
      </div>

      <Toast text={toast.text} />
    </>
  )
}

function LogRow({
  log,
  onToggle,
  onQty,
  onDelete,
}: {
  log: FoodLog
  onToggle: () => void
  onQty: (q: number) => void
  onDelete: () => void
}) {
  const pending = isTempLog(log.id)
  const eq = equivalence(log, log.quantity)
  return (
    <li className="grid grid-cols-[44px_1fr_auto] items-center gap-1.5 border-t border-line2 py-2.5 first:border-t-0">
      <button
        type="button"
        aria-pressed={log.eaten}
        aria-label={`${log.eaten ? 'Desmarcar' : 'Marcar'} ${log.food_name} como comido`}
        onClick={onToggle}
        disabled={pending}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] disabled:cursor-wait"
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            log.eaten ? 'border-acc bg-acc text-white' : 'border-check'
          }`}
        >
          {log.eaten && <Check size={14} strokeWidth={3.5} aria-hidden="true" />}
        </span>
      </button>

      <div className="min-w-0">
        <div
          className={`text-[15px] leading-tight font-semibold ${log.eaten ? '' : 'text-muted'}`}
        >
          {log.food_name}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {eq && <span className="font-semibold text-acc">{eq} · </span>}
          <span className="text-prot">P {round1(log.protein)}</span> ·{' '}
          <span className="text-carb-t">C {round1(log.carbs)}</span> ·{' '}
          <span className="text-fat">G {round1(log.fat)}</span>
          {!log.eaten && (
            <>
              {' '}
              · <b>Planificado</b>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {/* key: si la cantidad cambia desde fuera, el input se reinicia */}
        <QtyInput
          key={log.quantity}
          value={log.quantity}
          unit={qtyUnit(log)}
          label={`Cantidad de ${log.food_name}`}
          disabled={pending}
          onCommit={onQty}
        />
        <div className="flex items-center gap-0.5 text-[13px] font-semibold">
          <span>{fmt(log.kcal)} kcal</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label={`Quitar ${log.food_name}`}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-del hover:bg-del-bg disabled:cursor-wait"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  )
}

function QtyInput({
  value,
  unit,
  label,
  disabled,
  onCommit,
}: {
  value: number
  unit: string
  label: string
  disabled: boolean
  onCommit: (q: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  // Esc descarta: el blur que sigue no debe guardar el borrador.
  const skipCommit = useRef(false)

  function commit() {
    if (skipCommit.current) {
      skipCommit.current = false
      setDraft(String(value))
      return
    }
    const q = parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(q) && q > 0) onCommit(Math.round(q * 100) / 100)
    else setDraft(String(value))
  }

  return (
    <div className="flex h-10 w-28 items-center rounded-[10px] border border-line-strong bg-card focus-within:outline-3 focus-within:outline-focus">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        value={draft}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            skipCommit.current = true
            e.currentTarget.blur()
          }
        }}
        className="h-[38px] w-full min-w-0 bg-transparent px-1.5 text-right text-base outline-none"
      />
      <span className="pr-2 text-[13px] font-semibold text-muted">{unit}</span>
    </div>
  )
}
