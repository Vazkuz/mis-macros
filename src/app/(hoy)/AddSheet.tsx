'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import { basisLabel, round1, type Food } from '@/lib/foods'
import { useFoods } from '@/lib/useFoods'
import { useFoodSearch } from '@/lib/useFoodSearch'
import { MEALS, MEAL_LABEL, equivalence, macrosFor, type Meal } from '@/lib/hoy'

const MAX_SHOWN = 20
const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')

/**
 * Sheet "Agregar a <comida>". Cambiar de comida solo cambia el título (no
 * cierra ni re-anima). Teclado: ↑↓ + Enter elige, Enter en cantidad agrega,
 * Esc cancela la selección (y, sin selección, cierra el sheet). Se cierra
 * con la X, tocando fuera o arrastrando hacia abajo (no hay botón "Listo").
 */
export default function AddSheet({
  open,
  meal,
  onMealChange,
  onClose,
  onAdd,
  isAdmin,
}: {
  open: boolean
  meal: Meal
  onMealChange: (m: Meal) => void
  onClose: () => void
  onAdd: (food: Food, quantity: number, meal: Meal) => void
  isAdmin: boolean
}) {
  const { foods, status } = useFoods()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [qty, setQty] = useState('')
  const [hi, setHi] = useState(0)
  const [listOpen, setListOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const { results } = useFoodSearch(foods, selected ? '' : query)
  const shown = query.trim() && !selected ? results.slice(0, MAX_SHOWN) : []
  const showList = listOpen && query.trim() !== '' && !selected

  function reset() {
    setQuery('')
    setSelected(null)
    setQty('')
    setHi(0)
    setListOpen(false)
  }

  function close() {
    reset()
    onClose()
  }

  function pick(f: Food) {
    setSelected(f)
    setQuery(f.name)
    setQty(f.basis === 'unit' ? '1' : '100')
    setListOpen(false)
    requestAnimationFrame(() => {
      qtyRef.current?.focus()
      qtyRef.current?.select()
    })
  }

  const q = parseFloat(qty.replace(',', '.'))
  const qtyOk = Number.isFinite(q) && q > 0

  function add() {
    if (!selected || !qtyOk) return
    onAdd(selected, Math.round(q * 100) / 100, meal)
    reset()
    searchRef.current?.focus()
  }

  // Foco inicial en el buscador solo con mouse/teclado (en móvil abriría el
  // teclado encima del sheet).
  useEffect(() => {
    if (!open) return
    if (!window.matchMedia?.('(hover: hover)').matches) return
    const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 520)
    return () => clearTimeout(t)
  }, [open])

  // Esc con algo escrito o elegido: limpia en vez de cerrar el sheet. Se
  // captura en window para adelantarse al listener de vaul/Radix.
  const hasDraft = query !== '' || selected != null
  useEffect(() => {
    if (!open || !hasDraft) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setQuery('')
      setSelected(null)
      setQty('')
      setHi(0)
      setListOpen(false)
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, hasDraft])

  const info = selected && qtyOk ? macrosFor(selected, q) : null
  const eq = selected && qtyOk ? equivalence(selected, q) : null
  const unit = selected ? (selected.basis === 'unit' ? 'u' : selected.unit_label) : '—'

  return (
    <BottomSheet open={open} onClose={close} title={`Agregar a ${MEAL_LABEL[meal]}`}>
      <div className="flex flex-col gap-3">
        {/* Siempre en una fila, repartiendo el ancho en partes iguales (cabe en ~360px). */}
        <div className="flex flex-nowrap gap-1.5" role="group" aria-label="Comida">
          {MEALS.map((m) => {
            const on = m.value === meal
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                onClick={() => onMealChange(m.value)}
                className={`h-9 min-w-0 flex-1 cursor-pointer rounded-full border px-1 text-[13px] font-semibold whitespace-nowrap ${
                  on ? 'border-acc bg-acc text-white' : 'border-line-strong bg-card'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-2.5 shadow-[0_6px_16px_-12px_rgba(22,32,26,.35)]">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={2.2}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchRef}
              type="search"
              autoComplete="off"
              placeholder="Busca un alimento (camote, ceviche…)"
              role="combobox"
              aria-label="Buscar alimento"
              aria-expanded={showList}
              aria-controls="add-results"
              aria-autocomplete="list"
              aria-activedescendant={showList && shown[hi] ? `add-opt-${hi}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
                setQty('')
                setHi(0)
                setListOpen(true)
              }}
              onFocus={() => !selected && setListOpen(true)}
              onBlur={() => setListOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (!showList) setListOpen(true)
                  else if (shown.length) setHi((h) => (h + 1) % shown.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (shown.length) setHi((h) => (h - 1 + shown.length) % shown.length)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (showList && shown[hi]) pick(shown[hi])
                }
              }}
              // text-base (16px) a propósito: con menos, iOS hace zoom al enfocar.
              className="h-10 w-full rounded-[10px] border-[1.5px] border-acc bg-card pr-3 pl-9 text-base focus:outline-3 focus:outline-focus"
            />
          </div>

          {showList && (
            <ul
              id="add-results"
              role="listbox"
              aria-label="Resultados"
              className="m-0 flex max-h-[320px] list-none flex-col overflow-auto rounded-xl border border-line p-1"
            >
              {status === 'loading' ? (
                <li className="px-2.5 py-2 text-sm text-muted">Cargando alimentos…</li>
              ) : status === 'error' ? (
                <li className="px-2.5 py-2 text-sm text-danger">
                  No se pudo cargar la base. Recarga la página.
                </li>
              ) : shown.length === 0 ? (
                <li className="px-2.5 py-2 text-sm text-muted">
                  No está en la base.
                  {isAdmin && (
                    <>
                      {' '}
                      <Link
                        href="/alimentos"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={close}
                        className="font-semibold text-acc underline"
                      >
                        Crearlo en Alimentos
                      </Link>
                    </>
                  )}
                </li>
              ) : (
                shown.map((f, i) => (
                  <li
                    key={f.id}
                    id={`add-opt-${i}`}
                    role="option"
                    aria-selected={i === hi}
                    // mousedown (no click) para que el blur del buscador no
                    // cierre la lista antes de elegir.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(f)
                    }}
                    onMouseEnter={() => setHi(i)}
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1 ${
                      i === hi ? 'bg-acc-soft' : ''
                    }`}
                  >
                    <span className="min-w-0 text-sm leading-tight font-semibold">{f.name}</span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="text-[13px] font-semibold whitespace-nowrap">
                        {fmt(f.kcal)} kcal
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted">{basisLabel(f)}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}

          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-line-strong bg-card focus-within:outline-3 focus-within:outline-focus">
              <input
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="Cantidad"
                aria-label="Cantidad"
                disabled={!selected}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    add()
                  }
                }}
                // 16px a propósito (evita el zoom de iOS al enfocar).
                className="h-[38px] w-full min-w-0 bg-transparent px-2.5 text-right text-base outline-none disabled:opacity-60"
              />
              <span className="pr-2.5 pl-1 text-sm font-semibold whitespace-nowrap text-muted">
                {unit}
              </span>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!selected || !qtyOk}
              className="h-10 cursor-pointer rounded-[10px] bg-acc px-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-disabled"
            >
              Agregar
            </button>
          </div>

          <p className="text-[13px] text-muted" aria-live="polite">
            {info && selected ? (
              <>
                <b className="text-ink">{fmt(info.kcal)} kcal</b> · P {round1(info.protein)} g · C{' '}
                {round1(info.carbs)} g · G {round1(info.fat)} g
                {eq && <span className="font-semibold text-acc"> · {eq}</span>} →{' '}
                <b className="text-ink">{MEAL_LABEL[meal]}</b>
              </>
            ) : (
              'Elige un alimento para ver sus macros.'
            )}
          </p>
          <p className="text-xs text-muted [@media(hover:none)]:hidden">
            Escribe → <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> + <Kbd>Enter</Kbd> elige → cantidad → <Kbd>Enter</Kbd> agrega.{' '}
            <Kbd>Esc</Kbd> cancela.
          </p>
        </div>
      </div>
    </BottomSheet>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-px rounded border border-line bg-bg px-1 font-sans text-[11px]">
      {children}
    </kbd>
  )
}
