'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Star, X } from 'lucide-react'
import Toast, { useToast } from '@/components/Toast'
import FavoriteStar from '@/components/FavoriteStar'
import { basisLabel, round1, type Food } from '@/lib/foods'
import { useFoods } from '@/lib/useFoods'
import { useFoodSearch } from '@/lib/useFoodSearch'
import { useFoodLogs } from '@/lib/useFoodLogs'
import { useFavorites } from '@/lib/useFavorites'
import {
  MEALS,
  MEAL_LABEL,
  equivalence,
  macrosFor,
  qtyUnit,
  type FoodLog,
  type Meal,
} from '@/lib/hoy'

const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')

// Filtro "Destacados" recordado entre visitas en localStorage (por defecto,
// apagado). Tiendita externa: se lee sin efecto y sin desajuste de hidratación
// (en el servidor vale false).
const FAV_KEY = 'mis-macros:agregar-destacados'
const favOnlyListeners = new Set<() => void>()
let favOnlyMemo: boolean | null = null

function readFavOnly(): boolean {
  if (favOnlyMemo == null) {
    try {
      favOnlyMemo = localStorage.getItem(FAV_KEY) === '1'
    } catch {
      favOnlyMemo = false // Sin almacenamiento (modo privado, bloqueado…).
    }
  }
  return favOnlyMemo
}

function writeFavOnly(on: boolean) {
  favOnlyMemo = on
  try {
    localStorage.setItem(FAV_KEY, on ? '1' : '0')
  } catch {
    // No se pudo recordar; igual cambia en esta visita.
  }
  favOnlyListeners.forEach((l) => l())
}

function subscribeFavOnly(listener: () => void) {
  favOnlyListeners.add(listener)
  return () => {
    favOnlyListeners.delete(listener)
  }
}

/**
 * Pantalla completa para agregar comida. Columna con la altura visible:
 * cabecera fija arriba y solo la lista de abajo se desplaza.
 * - Android: el viewport raíz usa interactiveWidget 'resizes-content', así
 *   que 100dvh ya se achica con el teclado.
 * - iOS: el teclado no achica la página; se sigue al visualViewport (alto y
 *   desplazamiento) para que el buscador nunca quede tapado.
 */
export default function AgregarView({
  date,
  isToday,
  initialMeal,
  initialLogs,
  isAdmin,
}: {
  date: string
  isToday: boolean
  initialMeal: Meal
  initialLogs: FoodLog[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [qty, setQty] = useState('')
  const [hi, setHi] = useState(0)
  const [vv, setVv] = useState<{ height: number; top: number } | null>(null)
  const toast = useToast()
  const { logs, add } = useFoodLogs(initialLogs, date, toast.show)
  const { foods, status } = useFoods()
  const favOnly = useSyncExternalStore(subscribeFavOnly, readFavOnly, () => false)
  const { favorites, status: favStatus, isFavorite, toggleFavorite } = useFavorites(toast.show)
  // Con el filtro: solo destacados, todos (sin tope), en orden alfabético.
  const { results, total } = useFoodSearch(
    foods,
    query,
    favOnly ? { filter: 'destacados', favorites, limit: Infinity } : { favorites }
  )

  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const backHref = `${isToday ? '/' : `/?d=${date}`}${isToday ? '?' : '&'}meal=${meal}`
  const backRef = useRef(backHref)
  useEffect(() => {
    backRef.current = backHref
  }, [backHref])

  const searching = !selected
  // Con el filtro encendido se lista sin tener que escribir.
  const listing = searching && (favOnly || query.trim() !== '')
  const shown = listing ? results : []
  const mealLogs = logs.filter((l) => l.meal === meal)

  function toggleFavOnly() {
    writeFavOnly(!favOnly)
    setHi(0)
  }

  // ---------- Alto visible (iOS) ----------
  useEffect(() => {
    const view = window.visualViewport
    if (!view) return
    const sync = () => setVv({ height: view.height, top: view.offsetTop })
    sync()
    view.addEventListener('resize', sync)
    view.addEventListener('scroll', sync)
    return () => {
      view.removeEventListener('resize', sync)
      view.removeEventListener('scroll', sync)
    }
  }, [])

  // ---------- Foco ----------
  // iOS solo abre (o mantiene) el teclado si focus() corre dentro del mismo
  // toque: por eso se renderiza en el acto con flushSync y se enfoca ahí, en
  // vez de en un efecto.
  function backToSearch(clear = false) {
    flushSync(() => {
      setSelected(null)
      if (clear) {
        setQuery('')
        setQty('')
        setHi(0)
      }
    })
    searchRef.current?.focus()
  }

  // ---------- Esc: vuelve a buscar; otro Esc, a Hoy ----------
  const selectedRef = useRef(selected)
  const backToSearchRef = useRef(() => {})
  useEffect(() => {
    selectedRef.current = selected
    backToSearchRef.current = () => backToSearch()
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (selectedRef.current) backToSearchRef.current()
      else router.push(backRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  // Mantiene visible la fila resaltada al moverse con ↑↓.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`#agregar-opt-${hi}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  function changeMeal(m: Meal) {
    setMeal(m)
    // Actualiza ?meal sin recargar ni volver a pedir la página.
    const url = new URL(window.location.href)
    url.searchParams.set('meal', m)
    window.history.replaceState(window.history.state, '', url)
  }

  function pick(f: Food) {
    flushSync(() => {
      setSelected(f)
      setQty(f.basis === 'unit' ? '1' : '100')
    })
    qtyRef.current?.focus()
    qtyRef.current?.select()
  }

  const q = parseFloat(qty.replace(',', '.'))
  const qtyOk = Number.isFinite(q) && q > 0

  function doAdd() {
    if (!selected || !qtyOk) return
    add(selected, Math.round(q * 100) / 100, meal)
    toast.show(`${selected.name} agregado`)
    // Vuelve a buscar con el buscador vacío y con foco, para seguir agregando.
    backToSearch(true)
  }

  const info = selected && qtyOk ? macrosFor(selected, q) : null
  const eq = selected && qtyOk ? equivalence(selected, q) : null
  const unit = selected ? (selected.basis === 'unit' ? 'u' : selected.unit_label) : ''

  return (
    <div
      className="fixed inset-x-0 top-0 mx-auto flex max-w-[760px] flex-col bg-bg"
      style={{
        height: vv ? `${vv.height}px` : '100dvh',
        transform: vv && vv.top ? `translateY(${vv.top}px)` : undefined,
      }}
    >
      {/* ---------- Cabecera fija ---------- */}
      <header className="flex flex-none flex-col gap-2.5 border-b border-line bg-card px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-1">
          <Link
            href={backHref}
            aria-label="Volver a Hoy"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink hover:bg-bg"
          >
            <ArrowLeft size={22} strokeWidth={2.25} aria-hidden="true" />
          </Link>
          <h1 className="text-lg">Agregar a {MEAL_LABEL[meal]}</h1>
        </div>

        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Comida">
          {MEALS.map((m) => {
            const on = m.value === meal
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={on}
                onClick={() => changeMeal(m.value)}
                className={`h-8 min-w-0 cursor-pointer rounded-full border px-1 text-xs font-semibold whitespace-nowrap ${
                  on ? 'border-acc bg-acc text-white' : 'border-line-strong bg-card'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {searching ? (
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                strokeWidth={2.2}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                ref={searchRef}
                type="text"
                enterKeyHint="search"
                autoComplete="off"
                autoFocus
                placeholder="Busca un alimento (camote, ceviche…)"
                role="combobox"
                aria-label="Buscar alimento"
                aria-expanded={shown.length > 0}
                aria-controls="agregar-results"
                aria-autocomplete="list"
                aria-activedescendant={shown[hi] ? `agregar-opt-${hi}` : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHi(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (shown.length) setHi((h) => (h + 1) % shown.length)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (shown.length) setHi((h) => (h - 1 + shown.length) % shown.length)
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (shown[hi]) pick(shown[hi])
                  }
                }}
                // 16px a propósito: con menos, el iPhone hace zoom al enfocar.
                className="h-10 w-full rounded-[10px] border-[1.5px] border-acc bg-card pr-10 pl-9 text-base focus:outline-3 focus:outline-focus"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  // mousedown + preventDefault: limpia sin quitarle el foco.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('')
                    setHi(0)
                    searchRef.current?.focus()
                  }}
                  className="absolute top-1/2 right-1 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-bg"
                >
                  <X size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              aria-pressed={favOnly}
              aria-label="Destacados"
              title="Destacados"
              // mousedown + preventDefault: no le quita el foco al buscador.
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleFavOnly}
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] ${
                favOnly
                  ? 'border-carb bg-star-bg text-carb'
                  : 'border-line-strong bg-card text-star-off'
              }`}
            >
              <Star
                size={18}
                strokeWidth={2}
                fill={favOnly ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : (
          selected && (
            <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-acc bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <b className="text-[15px] leading-tight">{selected.name}</b>
                <button
                  type="button"
                  aria-label="Volver a buscar"
                  onClick={() => backToSearch()}
                  className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-bg"
                >
                  <X size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-line-strong bg-card focus-within:outline-3 focus-within:outline-focus">
                  <input
                    ref={qtyRef}
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="done"
                    min={0}
                    step="any"
                    aria-label="Cantidad"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        doAdd()
                      }
                    }}
                    // 16px a propósito (evita el zoom de iOS).
                    className="h-[38px] w-full min-w-0 bg-transparent px-2.5 text-right text-base outline-none"
                  />
                  <span className="pr-2.5 pl-1 text-sm font-semibold whitespace-nowrap text-muted">
                    {unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={doAdd}
                  disabled={!qtyOk}
                  className="h-10 cursor-pointer rounded-[10px] bg-acc px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-disabled"
                >
                  Agregar
                </button>
              </div>
              <p className="text-[13px] text-muted" aria-live="polite">
                {info ? (
                  <>
                    <b className="text-ink">{fmt(info.kcal)} kcal</b> ·{' '}
                    <span className="text-prot">P {round1(info.protein)}</span> ·{' '}
                    <span className="text-carb-t">C {round1(info.carbs)}</span> ·{' '}
                    <span className="text-fat">G {round1(info.fat)}</span>
                    {eq && <span className="font-semibold text-acc"> · {eq}</span>}
                  </>
                ) : (
                  'Pon una cantidad mayor a 0.'
                )}
              </p>
            </div>
          )
        )}
      </header>

      {/* ---------- Lo único que se desplaza ---------- */}
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {listing ? (
            status === 'loading' || (favOnly && favStatus === 'loading') ? (
              <p className="px-4 py-3 text-sm text-muted">Cargando alimentos…</p>
            ) : status === 'error' ? (
              <p className="px-4 py-3 text-sm text-danger">
                No se pudo cargar la base. Recarga la página.
              </p>
            ) : favOnly && favorites.size === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                Aún no tienes destacados. Toca ★ en un alimento.
              </p>
            ) : favOnly && shown.length === 0 ? (
              <>
                <FavCount n={0} />
                <p className="px-4 py-3 text-sm text-muted">Ninguno de tus destacados coincide.</p>
              </>
            ) : shown.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                No está en la base.
                {isAdmin && (
                  <>
                    {' '}
                    <Link href="/alimentos" className="font-semibold text-acc underline">
                      Crearlo en Alimentos
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <>
                {favOnly && <FavCount n={total} />}
                <ul
                  ref={listRef}
                  id="agregar-results"
                  role="listbox"
                  aria-label="Resultados"
                  className="m-0 list-none bg-card p-0"
                >
                  {shown.map((f, i) => (
                    <li
                      key={f.id}
                      id={`agregar-opt-${i}`}
                      role="option"
                      aria-selected={i === hi}
                      onClick={() => pick(f)}
                      onMouseEnter={() => setHi(i)}
                      className={`flex cursor-pointer items-center gap-2 border-b border-line2 py-[3px] pr-2 pl-4 ${
                        i === hi ? 'bg-acc-soft' : ''
                      }`}
                    >
                      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-semibold">
                        {f.name}
                      </span>
                      <span className="flex shrink-0 flex-col items-end leading-tight">
                        <span className="text-xs font-semibold whitespace-nowrap">
                          {fmt(f.kcal)} kcal
                        </span>
                        <span className="text-[11px] whitespace-nowrap text-muted">
                          {basisLabel(f)}
                        </span>
                      </span>
                      <FavoriteStar
                        on={isFavorite(f.id)}
                        name={f.name}
                        onToggle={() => toggleFavorite(f.id, f.name)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <YaEn meal={meal} logs={mealLogs} />
          )}
        </div>
        <Toast text={toast.text} action={toast.action} inline />
      </div>
    </div>
  )
}

function FavCount({ n }: { n: number }) {
  return <p className="px-4 pt-2.5 pb-1 text-xs text-muted">Tus destacados · {n}</p>
}

/** "Ya en <comida>": lo registrado en esa comida y día (solo lectura). */
function YaEn({ meal, logs }: { meal: Meal; logs: FoodLog[] }) {
  return (
    <section className="px-4 py-3">
      <h2 className="mb-1 text-[13px] font-semibold text-muted">Ya en {MEAL_LABEL[meal]}</h2>
      {logs.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Aún no hay nada en {MEAL_LABEL[meal].toLowerCase()}.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex items-baseline justify-between gap-3 border-b border-line2 py-[7px] last:border-b-0"
            >
              <span className="line-clamp-2 min-w-0 text-[13px] leading-tight">{l.food_name}</span>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                {round1(l.quantity)} {qtyUnit(l)} ·{' '}
                <b className="font-semibold text-ink">{fmt(l.kcal)} kcal</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
