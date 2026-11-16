'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Plus, Search, Star, Trash2, Utensils, X } from 'lucide-react'
import Toast, { useToast } from '@/components/Toast'
import FavoriteStar from '@/components/FavoriteStar'
import ConfirmDialog from '@/components/ConfirmDialog'
import { basisLabel, round1, type Food } from '@/lib/foods'
import { itemsLine, itemsTotals, type Dish } from '@/lib/dishes'
import { useFoods } from '@/lib/useFoods'
import { useCatalogSearch, type CatalogEntry } from '@/lib/useCatalogSearch'
import { useFoodLogs } from '@/lib/useFoodLogs'
import { useFavorites } from '@/lib/useFavorites'
import { useDishes } from '@/lib/useDishes'
import { useVisibleViewportStyle } from '@/lib/useVisualViewport'
import {
  MEALS,
  MEAL_LABEL,
  equivalence,
  isDishLog,
  logAmount,
  macrosFor,
  type FoodLog,
  type Meal,
} from '@/lib/hoy'

const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')

// Filtros "Destacados" (★) y "Platos" recordados entre visitas en
// localStorage (por defecto, apagados). Tiendita externa: se leen sin efecto
// y sin desajuste de hidratación (en el servidor valen false).
function boolPref(key: string) {
  const listeners = new Set<() => void>()
  let memo: boolean | null = null
  return {
    read(): boolean {
      if (memo == null) {
        try {
          memo = localStorage.getItem(key) === '1'
        } catch {
          memo = false // Sin almacenamiento (modo privado, bloqueado…).
        }
      }
      return memo
    },
    write(on: boolean) {
      memo = on
      try {
        localStorage.setItem(key, on ? '1' : '0')
      } catch {
        // No se pudo recordar; igual cambia en esta visita.
      }
      listeners.forEach((l) => l())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
const favPref = boolPref('mis-macros:agregar-destacados')
const dishPref = boolPref('mis-macros:agregar-platos')
const serverFalse = () => false

type Selection = { kind: 'food'; food: Food } | { kind: 'dish'; dish: Dish }

/**
 * Pantalla completa para agregar comida (alimentos y platos propios).
 * Columna con la altura visible (useVisibleViewportStyle): cabecera fija
 * arriba y solo la lista de abajo se desplaza.
 */
export default function AgregarView({
  date,
  isToday,
  initialMeal,
  initialLogs,
  initialDishId,
  isAdmin,
}: {
  date: string
  isToday: boolean
  initialMeal: Meal
  initialLogs: FoodLog[]
  /** ?sel=dish:<id> (al volver de crear un plato): ese plato ya elegido. */
  initialDishId: string | null
  isAdmin: boolean
}) {
  const router = useRouter()
  const viewportStyle = useVisibleViewportStyle()
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [pendingDishId, setPendingDishId] = useState(initialDishId)
  const [qty, setQty] = useState('')
  const [hi, setHi] = useState(0)
  const [confirmDish, setConfirmDish] = useState<Dish | null>(null)
  const toast = useToast()
  const { logs, add, addDish } = useFoodLogs(initialLogs, date, toast.show)
  const { foods, status } = useFoods()
  const favOnly = useSyncExternalStore(favPref.subscribe, favPref.read, serverFalse)
  const dishOnly = useSyncExternalStore(dishPref.subscribe, dishPref.read, serverFalse)
  const { favorites, status: favStatus, isFavorite, toggleFavorite } = useFavorites(toast.show)
  const {
    dishes,
    dishById,
    status: dishStatus,
    toggleDishFavorite,
    deleteDish,
  } = useDishes(toast.show)
  // Con un filtro encendido se lista todo lo que cumple (sin tope).
  const { results } = useCatalogSearch(foods, dishes, query, {
    favOnly,
    dishMode: dishOnly ? 'only' : 'all',
    favorites,
    ready: favStatus !== 'loading' && dishStatus !== 'loading',
    limit: favOnly || dishOnly ? Infinity : undefined,
  })

  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const backHref = `${isToday ? '/' : `/?d=${date}`}${isToday ? '?' : '&'}meal=${meal}`
  const backRef = useRef(backHref)
  useEffect(() => {
    backRef.current = backHref
  }, [backHref])

  // ?sel=dish:<id>: se elige en cuanto el plato está en la caché (estado
  // derivado en el render; sin efecto).
  if (pendingDishId) {
    const dish = dishById.get(pendingDishId)
    if (dish) {
      setPendingDishId(null)
      setSelected({ kind: 'dish', dish })
      setQty('1')
    } else if (dishStatus !== 'loading') {
      setPendingDishId(null)
    }
  }

  const searching = !selected
  const filtering = favOnly || dishOnly
  const listing = searching && (filtering || query.trim() !== '')
  const shown = listing ? results : []
  const mealLogs = logs.filter((l) => l.meal === meal)

  const isFav = (e: CatalogEntry) =>
    e.kind === 'dish' ? (dishById.get(e.id)?.favorite ?? false) : isFavorite(e.id)
  // Contador en vivo: con ★, lo que dejas de destacar sigue en la lista hasta
  // la próxima búsqueda, pero ya no cuenta.
  const count = favOnly ? shown.filter(isFav).length : shown.length
  const countLabel =
    favOnly && dishOnly ? 'Tus platos destacados' : dishOnly ? 'Tus platos' : 'Tus destacados'

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
    // ?sel ya cumplió: que recargar no vuelva a elegir el plato.
    const url = new URL(window.location.href)
    if (url.searchParams.has('sel')) {
      url.searchParams.delete('sel')
      window.history.replaceState(window.history.state, '', url)
    }
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

  function togglePref(pref: typeof favPref, current: boolean) {
    pref.write(!current)
    setHi(0)
  }

  function pick(e: CatalogEntry) {
    flushSync(() => {
      if (e.kind === 'dish') {
        setSelected({ kind: 'dish', dish: e.dish })
        setQty('1')
      } else {
        setSelected({ kind: 'food', food: e.food })
        setQty(e.food.basis === 'unit' ? '1' : '100')
      }
    })
    qtyRef.current?.focus()
    qtyRef.current?.select()
  }

  const q = parseFloat(qty.replace(',', '.'))
  const qtyOk = Number.isFinite(q) && q > 0

  function doAdd() {
    if (!selected || !qtyOk) return
    const amount = Math.round(q * 100) / 100
    if (selected.kind === 'dish') {
      addDish(selected.dish, amount, meal)
      toast.show(`${selected.dish.name} agregado`)
    } else {
      add(selected.food, amount, meal)
      toast.show(`${selected.food.name} agregado`)
    }
    // Vuelve a buscar con el buscador vacío y con foco, para seguir agregando.
    backToSearch(true)
  }

  function confirmDelete() {
    const dish = confirmDish
    if (!dish) return
    setConfirmDish(null)
    if (selected?.kind === 'dish' && selected.dish.id === dish.id) backToSearch()
    toast.show(`${dish.name} eliminado`)
    deleteDish(dish.id).then((ok) => {
      if (!ok) toast.show('No se pudo eliminar el plato. Inténtalo de nuevo.')
    })
  }

  const info =
    selected && qtyOk
      ? selected.kind === 'dish'
        ? itemsTotals(selected.dish.items, q)
        : macrosFor(selected.food, q)
      : null
  const eq = selected?.kind === 'food' && qtyOk ? equivalence(selected.food, q) : null
  const unit = !selected
    ? ''
    : selected.kind === 'dish'
      ? qtyOk && q === 1
        ? 'porción'
        : 'porciones'
      : selected.food.basis === 'unit'
        ? 'u'
        : selected.food.unit_label
  const selName = selected
    ? selected.kind === 'dish'
      ? selected.dish.name
      : selected.food.name
    : ''

  // ---------- Lista: carga, vacíos y resultados ----------
  const hasQuery = query.trim() !== ''
  const loading =
    (dishOnly ? dishStatus === 'loading' : status === 'loading') ||
    (favOnly && favStatus === 'loading')
  let empty: React.ReactNode = null
  if (shown.length === 0) {
    if (dishOnly && !hasQuery && dishes.length === 0) {
      empty = 'Aún no tienes platos. Crea uno arriba.'
    } else if (dishOnly && favOnly && !hasQuery) {
      empty = 'Aún no tienes platos destacados. Toca ★ en un plato.'
    } else if (favOnly && !hasQuery) {
      empty = 'Aún no tienes destacados. Toca ★ en un alimento.'
    } else if (dishOnly) {
      empty = 'Sin resultados.'
    } else if (favOnly) {
      empty = 'Ninguno de tus destacados coincide.'
    } else {
      empty = (
        <>
          No está en la base.
          {isAdmin && (
            <>
              {' '}
              <Link href="/alimentos" className="font-semibold text-acc underline">
                Crearlo en Alimentos
              </Link>
            </>
          )}
        </>
      )
    }
  }
  // El contador acompaña a la lista (y a "Sin resultados" al buscar con filtro).
  const showCount = filtering && (shown.length > 0 || hasQuery)

  return (
    <div
      className="fixed inset-x-0 top-0 mx-auto flex max-w-[760px] flex-col bg-bg"
      style={viewportStyle}
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
                aria-label="Buscar alimento o plato"
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
              onClick={() => togglePref(favPref, favOnly)}
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
            <button
              type="button"
              aria-pressed={dishOnly}
              aria-label="Platos"
              title="Platos"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => togglePref(dishPref, dishOnly)}
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] ${
                dishOnly
                  ? 'border-acc bg-acc-soft text-acc'
                  : 'border-line-strong bg-card text-star-off'
              }`}
            >
              <Utensils size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ) : (
          selected && (
            <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-acc bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="text-[15px] leading-tight">
                    {selected.kind === 'dish' && (
                      <Utensils
                        size={14}
                        strokeWidth={2.5}
                        aria-label="Plato"
                        className="mr-1 inline-block align-[-1px] text-acc"
                      />
                    )}
                    {selName}
                  </b>
                  {selected.kind === 'dish' && (
                    <p className="mt-0.5 text-xs leading-snug text-muted">
                      {itemsLine(selected.dish.items)}
                    </p>
                  )}
                </div>
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
                    aria-label={selected.kind === 'dish' ? 'Porciones' : 'Cantidad'}
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
          {searching && (
            <Link
              href={`/platos/nuevo?meal=${meal}&d=${date}`}
              className="flex min-h-11 items-center justify-between gap-2 border-b border-line2 bg-card px-4 text-sm font-semibold text-acc hover:bg-acc-soft"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={17} strokeWidth={2.5} aria-hidden="true" />
                Crear plato propio
              </span>
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden="true" />
            </Link>
          )}
          {listing ? (
            loading ? (
              <p className="px-4 py-3 text-sm text-muted">Cargando…</p>
            ) : status === 'error' && !dishOnly ? (
              <p className="px-4 py-3 text-sm text-danger">
                No se pudo cargar la base. Recarga la página.
              </p>
            ) : (
              <>
                {showCount && (
                  <p className="px-4 pt-2.5 pb-1 text-xs text-muted">
                    {countLabel} · {count}
                  </p>
                )}
                {empty ? (
                  <p className="px-4 py-3 text-sm text-muted">{empty}</p>
                ) : (
                  <ul
                    ref={listRef}
                    id="agregar-results"
                    role="listbox"
                    aria-label="Resultados"
                    className="m-0 list-none bg-card p-0"
                  >
                    {shown.map((e, i) => (
                      <ResultRow
                        key={e.key}
                        entry={e}
                        index={i}
                        active={i === hi}
                        favorite={isFav(e)}
                        onPick={() => pick(e)}
                        onHover={() => setHi(i)}
                        onFavorite={() =>
                          e.kind === 'dish'
                            ? toggleDishFavorite(e.id)
                            : toggleFavorite(e.id, e.name)
                        }
                        onDelete={e.kind === 'dish' ? () => setConfirmDish(e.dish) : undefined}
                      />
                    ))}
                  </ul>
                )}
              </>
            )
          ) : (
            <YaEn meal={meal} logs={mealLogs} />
          )}
        </div>
        <Toast text={toast.text} action={toast.action} inline />
      </div>

      <ConfirmDialog
        open={confirmDish != null}
        title={`¿Eliminar "${confirmDish?.name ?? ''}"?`}
        description="Se borra de tus platos. Lo que ya registraste en tus comidas no cambia."
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDish(null)}
      />
    </div>
  )
}

/**
 * Fila de resultado. Alimento: nombre | kcal y base | ★ | hueco del tacho.
 * Plato: ícono y nombre | kcal y "1 porción" | ★ | tacho.
 */
function ResultRow({
  entry,
  index,
  active,
  favorite,
  onPick,
  onHover,
  onFavorite,
  onDelete,
}: {
  entry: CatalogEntry
  index: number
  active: boolean
  favorite: boolean
  onPick: () => void
  onHover: () => void
  onFavorite: () => void
  onDelete?: () => void
}) {
  const dish = entry.kind === 'dish' ? entry.dish : null
  const kcal = dish ? itemsTotals(dish.items).kcal : entry.kind === 'food' ? entry.food.kcal : 0
  return (
    <li
      id={`agregar-opt-${index}`}
      role="option"
      aria-selected={active}
      onClick={onPick}
      onMouseEnter={onHover}
      className={`flex cursor-pointer items-center gap-1 border-b border-line2 py-[3px] pr-2 pl-4 ${
        active ? 'bg-acc-soft' : ''
      }`}
    >
      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight font-semibold">
        {dish && (
          <Utensils
            size={13}
            strokeWidth={2.5}
            aria-label="Plato"
            className="mr-1 inline-block align-[-1px] text-acc"
          />
        )}
        {entry.name}
      </span>
      <span className="ml-1 flex shrink-0 flex-col items-end leading-tight">
        <span className="text-xs font-semibold whitespace-nowrap">{fmt(kcal)} kcal</span>
        <span className="text-[11px] whitespace-nowrap text-muted">
          {dish ? '1 porción' : entry.kind === 'food' ? basisLabel(entry.food) : ''}
        </span>
      </span>
      <FavoriteStar on={favorite} name={entry.name} onToggle={onFavorite} />
      {onDelete ? (
        <button
          type="button"
          aria-label={`Eliminar ${entry.name}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-icon hover:bg-del-bg hover:text-del"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      ) : (
        <span className="h-9 w-9 shrink-0" aria-hidden="true" />
      )}
    </li>
  )
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
              <span className="line-clamp-2 min-w-0 text-[13px] leading-tight">
                {isDishLog(l) && (
                  <Utensils
                    size={12}
                    strokeWidth={2.5}
                    aria-label="Plato"
                    className="mr-1 inline-block align-[-1px] text-acc"
                  />
                )}
                {l.food_name}
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted">
                {logAmount(l)} · <b className="font-semibold text-ink">{fmt(l.kcal)} kcal</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
