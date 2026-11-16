'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ArrowLeft, Plus, Search, X } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast, { useToast } from '@/components/Toast'
import { basisLabel, round1, type Food } from '@/lib/foods'
import { defaultQty, itemsTotals, type DishItem } from '@/lib/dishes'
import { useFoods } from '@/lib/useFoods'
import { useFavorites } from '@/lib/useFavorites'
import { useFoodSearch } from '@/lib/useFoodSearch'
import { useVisibleViewportStyle } from '@/lib/useVisualViewport'

const fmt = (n: number) => Math.round(n).toLocaleString('es-PE')
const parseQty = (s: string) => parseFloat(s.replace(',', '.'))
const fmt1 = (n: number) => round1(n).toFixed(1)

type Row = { key: number; item: DishItem; qty: string }

export type DishEditorSave = {
  name: string
  items: DishItem[]
  saveToDish: boolean
}

/**
 * Editor de ingredientes a pantalla completa (mismo patrón que /agregar).
 * Lo usan /platos/nuevo, /platos/[id] (con nombre) y /comida/[logId] (sin
 * nombre; opcionalmente "Guardar también en el plato"). Quien lo usa decide
 * qué hacer al guardar: `onSave` devuelve un mensaje de error o null si ya
 * navegó.
 */
export default function DishEditor({
  title,
  onBack,
  showName,
  initialName = '',
  initialItems,
  totalLabel,
  saveLabel,
  note,
  saveToDishOption = false,
  onSave,
  onDelete,
}: {
  title: string
  onBack: () => void
  showName: boolean
  initialName?: string
  initialItems: DishItem[]
  totalLabel: string
  saveLabel: string
  note?: string
  saveToDishOption?: boolean
  onSave: (data: DishEditorSave) => Promise<string | null>
  /** Solo al editar un plato: borra y navega; devuelve un error o null. */
  onDelete?: () => Promise<string | null>
}) {
  const viewportStyle = useVisibleViewportStyle()
  const toast = useToast()
  const { foods, status: foodsStatus } = useFoods()
  const { favorites } = useFavorites()

  const nextKey = useRef(initialItems.length)
  const [name, setName] = useState(initialName)
  const [rows, setRows] = useState<Row[]>(() =>
    initialItems.map((item, i) => ({ key: i, item, qty: String(round1(item.quantity)) }))
  )
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [saveToDish, setSaveToDish] = useState(false)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { results } = useFoodSearch(foods, query, { favorites, limit: 6 })
  const qtyRefs = useRef(new Map<number, HTMLInputElement>())
  const searchRef = useRef<HTMLInputElement>(null)

  // Esc: cierra el buscador; si no está abierto, vuelve.
  const escRef = useRef(() => {})
  useEffect(() => {
    escRef.current = () => {
      if (adding) {
        setAdding(false)
        setQuery('')
      } else onBack()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      escRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items: DishItem[] = rows.map((r) => {
    const q = parseQty(r.qty)
    return { ...r.item, quantity: Number.isFinite(q) && q > 0 ? q : 0 }
  })
  const totals = itemsTotals(items)

  const problem =
    showName && !name.trim()
      ? 'Ponle un nombre a tu plato.'
      : rows.length === 0
        ? 'Agrega al menos un ingrediente.'
        : items.some((it) => !(it.quantity > 0))
          ? 'Todas las cantidades deben ser mayores a 0.'
          : items.some((it) => it.food_id == null)
            ? 'Quita los ingredientes que ya no están en la base.'
            : null

  // iOS solo abre el teclado si focus() corre dentro del mismo toque.
  function openSearch() {
    flushSync(() => setAdding(true))
    searchRef.current?.focus()
  }

  function addFood(f: Food) {
    const key = nextKey.current++
    flushSync(() => {
      setRows((rs) => [
        ...rs,
        {
          key,
          qty: String(defaultQty(f)),
          item: {
            food_id: f.id,
            name: f.name,
            basis: f.basis,
            unit_label: f.unit_label,
            quantity: defaultQty(f),
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
          },
        },
      ])
      setAdding(false)
      setQuery('')
    })
    const input = qtyRefs.current.get(key)
    input?.focus()
    input?.select()
  }

  async function save() {
    setTried(true)
    if (problem || busy) return
    setBusy(true)
    const items2 = items.map((it) => ({ ...it, quantity: Math.round(it.quantity * 100) / 100 }))
    const error = await onSave({ name: name.trim(), items: items2, saveToDish })
    if (error) {
      setBusy(false)
      toast.show(error)
    }
  }

  async function confirmDelete() {
    if (!onDelete) return
    setBusy(true)
    const error = await onDelete()
    if (error) {
      setBusy(false)
      setConfirmOpen(false)
      toast.show(error)
    }
  }

  return (
    <div
      className="fixed inset-x-0 top-0 mx-auto flex max-w-[760px] flex-col bg-bg"
      style={viewportStyle}
    >
      <header className="flex flex-none items-center gap-1 border-b border-line bg-card px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink hover:bg-bg"
        >
          <ArrowLeft size={22} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 truncate text-lg">{title}</h1>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
            {showName && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="dish-name" className="text-sm font-semibold">
                  Nombre
                </label>
                <input
                  id="dish-name"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  placeholder="Mi leche con café"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line-strong bg-card px-3 text-base focus:outline-3 focus:outline-focus"
                />
              </div>
            )}

            {/* ---------- Ingredientes ---------- */}
            <section className="flex flex-col rounded-2xl border border-line bg-card p-4">
              <h2 className="mb-1 text-base">Ingredientes</h2>
              {rows.length > 0 && (
                <ul className="flex flex-col">
                  {rows.map((r) => {
                    const unit =
                      r.item.basis === 'unit'
                        ? parseQty(r.qty) === 1
                          ? 'unidad'
                          : 'unidades'
                        : r.item.unit_label
                    return (
                      <li
                        key={r.key}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 border-t border-line2 py-2 first:border-t-0"
                      >
                        <span className="text-[14px] leading-tight font-semibold break-words">
                          {r.item.name}
                        </span>
                        <div className="flex h-10 items-center rounded-[10px] border border-line-strong bg-card focus-within:outline-3 focus-within:outline-focus">
                          <input
                            ref={(el) => {
                              if (el) qtyRefs.current.set(r.key, el)
                              else qtyRefs.current.delete(r.key)
                            }}
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="done"
                            autoComplete="off"
                            aria-label={`Cantidad de ${r.item.name}`}
                            value={r.qty}
                            onChange={(e) => {
                              const qty = e.target.value
                              setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty } : x)))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                            }}
                            // 16px a propósito: con menos, el iPhone hace zoom.
                            className="h-[38px] w-16 min-w-0 bg-transparent px-1.5 text-right text-base outline-none"
                          />
                          <span className="pr-2 text-[13px] font-semibold text-muted">{unit}</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Quitar ${r.item.name}`}
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-icon hover:bg-del-bg hover:text-del"
                        >
                          <X size={18} strokeWidth={2.5} aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {adding ? (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="relative">
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
                      placeholder="Busca un alimento"
                      aria-label="Buscar ingrediente"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && query.trim() && results[0]) {
                          e.preventDefault()
                          addFood(results[0])
                        }
                      }}
                      className="h-10 w-full rounded-[10px] border-[1.5px] border-acc bg-card pr-10 pl-9 text-base focus:outline-3 focus:outline-focus"
                    />
                    <button
                      type="button"
                      aria-label="Cerrar buscador"
                      onClick={() => {
                        setAdding(false)
                        setQuery('')
                      }}
                      className="absolute top-1/2 right-1 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-bg"
                    >
                      <X size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>
                  {query.trim() &&
                    (foodsStatus === 'loading' ? (
                      <p className="py-2 text-sm text-muted">Cargando alimentos…</p>
                    ) : foodsStatus === 'error' ? (
                      <p className="py-2 text-sm text-danger">
                        No se pudo cargar la base. Recarga la página.
                      </p>
                    ) : results.length === 0 ? (
                      <p className="py-2 text-sm text-muted">Sin resultados.</p>
                    ) : (
                      <ul className="flex flex-col">
                        {results.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              // No le quita el foco al buscador antes de agregar.
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => addFood(f)}
                              className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-line2 py-2 text-left hover:bg-acc-soft"
                            >
                              <span className="line-clamp-2 min-w-0 text-[13px] leading-tight font-semibold">
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
                            </button>
                          </li>
                        ))}
                      </ul>
                    ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openSearch}
                  className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-lg px-1 text-[15px] font-semibold text-acc hover:bg-acc-soft"
                >
                  <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
                  Agregar ingrediente
                </button>
              )}
            </section>

            {/* ---------- Total en vivo (tarjeta oscura, estilo Meta) ---------- */}
            <section
              className="flex flex-col gap-1.5 rounded-2xl bg-ink p-4 text-white"
              aria-live="polite"
            >
              <p className="text-[13px] font-semibold text-disabled">{totalLabel}</p>
              <p className="num text-4xl leading-none">
                {fmt(totals.kcal)} <span className="text-base font-medium text-disabled">kcal</span>
              </p>
              <p className="text-sm">
                <span className="text-prot-l">P {fmt1(totals.protein)} g</span>
                <span className="text-disabled"> · </span>
                <span className="text-carb-l">C {fmt1(totals.carbs)} g</span>
                <span className="text-disabled"> · </span>
                <span className="text-fat-l">G {fmt1(totals.fat)} g</span>
              </p>
            </section>

            {saveToDishOption && (
              <label className="flex cursor-pointer items-start gap-2.5 py-1">
                <input
                  type="checkbox"
                  checked={saveToDish}
                  onChange={(e) => setSaveToDish(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-acc"
                />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">Guardar también en el plato</span>
                  <span className="text-[13px] text-muted">
                    Si no lo marcas, el cambio queda solo en esta comida.
                  </span>
                </span>
              </label>
            )}

            {tried && problem && (
              <p role="alert" className="text-sm text-danger">
                {problem}
              </p>
            )}

            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="min-h-12 w-full cursor-pointer rounded-xl bg-acc px-[18px] text-[15px] font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? 'Guardando…' : saveLabel}
            </button>
            {note && <p className="-mt-1 text-center text-[13px] text-muted">{note}</p>}

            {onDelete && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="min-h-12 w-full cursor-pointer rounded-xl border border-danger-line bg-card px-[18px] text-[15px] font-semibold text-danger disabled:opacity-60"
              >
                Eliminar plato
              </button>
            )}
          </div>
        </div>
        <Toast text={toast.text} action={toast.action} inline />
      </div>

      {onDelete && (
        <ConfirmDialog
          open={confirmOpen}
          title={`¿Eliminar "${initialName}"?`}
          description="Se borra de tus platos. Lo que ya registraste en tus comidas no cambia."
          confirmLabel={busy ? 'Eliminando…' : 'Eliminar'}
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
