'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Trash2 } from 'lucide-react'
import Toast, { useToast } from '@/components/Toast'
import FavoriteStar from '@/components/FavoriteStar'
import { useFabAction } from '@/lib/fab'
import { round1 } from '@/lib/foods'
import type { Goals } from '@/lib/metas'
import { MEALS, MEAL_LABEL, qtyUnit, type FoodLog, type Meal } from '@/lib/hoy'
import { isTempLog, useFoodLogs } from '@/lib/useFoodLogs'
import { useFavorites } from '@/lib/useFavorites'

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
  const { isFavorite, toggleFavorite } = useFavorites(toast.show)
  // Fila desplegada (macros): solo una a la vez.
  const [openId, setOpenId] = useState<string | null>(null)

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
                  open={openId === log.id}
                  onOpen={() => setOpenId((id) => (id === log.id ? null : log.id))}
                  favorite={isFavorite(log.food_id)}
                  onFavorite={
                    log.food_id ? () => toggleFavorite(log.food_id!, log.food_name) : null
                  }
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

      <Toast text={toast.text} action={toast.action} />
    </>
  )
}

/** "150 g", "1 unidad" o "2 unidades". */
function qtyLabel(log: FoodLog, quantity: number): string {
  const q = round1(quantity).toLocaleString('es-PE')
  if (log.basis === 'unit') return `${q} ${quantity === 1 ? 'unidad' : 'unidades'}`
  return `${q} ${log.unit_label}`
}

const MACRO_PILLS = [
  { key: 'protein', label: 'Proteína', cls: 'bg-prot-bg text-prot' },
  { key: 'carbs', label: 'Carbos', cls: 'bg-carb-bg text-carb' },
  { key: 'fat', label: 'Grasa', cls: 'bg-fat-bg text-fat' },
] as const

const iconBtn =
  'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-icon disabled:cursor-wait'

function LogRow({
  log,
  open,
  onOpen,
  favorite,
  onFavorite,
  onToggle,
  onQty,
  onDelete,
}: {
  log: FoodLog
  open: boolean
  onOpen: () => void
  favorite: boolean
  /** null si el alimento ya no existe (food_id null): no hay estrella. */
  onFavorite: (() => void) | null
  onToggle: () => void
  onQty: (q: number) => void
  onDelete: () => void
}) {
  const pending = isTempLog(log.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const rowRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = parseFloat(draft.replace(',', '.'))
  const draftOk = Number.isFinite(q) && q > 0
  // kcal en vivo mientras editas (proporcional a la cantidad guardada).
  const kcal = editing && draftOk && log.quantity > 0 ? (log.kcal * q) / log.quantity : log.kcal

  // Tocar fuera de la fila cancela la edición.
  useEffect(() => {
    if (!editing) return
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setEditing(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [editing])

  // iOS solo abre el teclado si focus() corre dentro del mismo toque.
  function startEdit() {
    flushSync(() => {
      setDraft(String(round1(log.quantity)))
      setEditing(true)
    })
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  function save() {
    if (!draftOk) return
    onQty(Math.round(q * 100) / 100)
    setEditing(false)
  }

  return (
    <li ref={rowRef} className="border-t border-line2 first:border-t-0">
      <div
        className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1 py-1.5"
        onClick={() => {
          if (!editing) onOpen()
        }}
      >
        <button
          type="button"
          aria-pressed={log.eaten}
          aria-label={`${log.eaten ? 'Desmarcar' : 'Marcar'} ${log.food_name} como comido`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
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

        <div
          className="min-w-0"
          role={editing ? undefined : 'button'}
          tabIndex={editing ? undefined : 0}
          aria-expanded={editing ? undefined : open}
          onKeyDown={(e) => {
            if (editing || e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen()
            }
          }}
        >
          <div
            className={`text-[15px] leading-tight font-semibold break-words ${log.eaten ? '' : 'text-muted'}`}
          >
            {log.food_name}
          </div>
          {editing ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <div className="flex h-9 items-center rounded-[10px] border border-line-strong bg-card focus-within:outline-3 focus-within:outline-focus">
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  enterKeyHint="done"
                  step="any"
                  min={0}
                  value={draft}
                  aria-label={`Cantidad de ${log.food_name}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      save()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditing(false)
                    }
                  }}
                  // 16px a propósito: con menos, el iPhone hace zoom al enfocar.
                  className="h-[34px] w-16 min-w-0 bg-transparent px-1.5 text-right text-base text-ink outline-none"
                />
                <span className="pr-2 text-[13px] font-semibold">{qtyUnit(log)}</span>
              </div>
              <span className="whitespace-nowrap">· {fmt(kcal)} kcal</span>
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-muted">
              {qtyLabel(log, log.quantity)} · {fmt(kcal)} kcal
            </div>
          )}
        </div>

        {/* Ancho fijo (3 × 36px): los íconos nunca se mueven. */}
        {editing ? (
          <div className="flex w-[108px] justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                save()
              }}
              disabled={!draftOk}
              aria-label="Guardar cantidad"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-acc text-white disabled:cursor-not-allowed disabled:bg-disabled"
            >
              <Check size={18} strokeWidth={3} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex w-[108px] items-center justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
              disabled={pending}
              aria-label={`Cambiar cantidad de ${log.food_name}`}
              className={`${iconBtn} hover:bg-bg hover:text-muted`}
            >
              <Pencil size={17} aria-hidden="true" />
            </button>
            {onFavorite ? (
              <FavoriteStar on={favorite} name={log.food_name} onToggle={onFavorite} />
            ) : (
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={pending}
              aria-label={`Quitar ${log.food_name}`}
              className={`${iconBtn} hover:bg-del-bg hover:text-del`}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Macros de la fila: altura animada con grid-template-rows 0fr → 1fr. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-3 gap-2 pb-2.5 pl-12">
            {MACRO_PILLS.map((m) => (
              <div
                key={m.key}
                className={`flex flex-col items-center rounded-xl px-1 py-2 leading-tight ${m.cls}`}
              >
                <span className="num text-lg font-semibold">{Math.round(log[m.key])} g</span>
                <span className="text-[11px] font-semibold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  )
}
