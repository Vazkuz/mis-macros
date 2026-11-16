'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Search, Trash2, Utensils } from 'lucide-react'
import {
  FOOD_FILTERS,
  MAX_RESULTS,
  SOURCE_LABEL,
  basisLabel,
  round1,
  type Food,
  type FoodFilter,
} from '@/lib/foods'
import { itemsTotals, type Dish } from '@/lib/dishes'
import { useCatalogSearch } from '@/lib/useCatalogSearch'
import { useDishes } from '@/lib/useDishes'
import { useFabAction } from '@/lib/fab'
import { useFavorites } from '@/lib/useFavorites'
import Toast, { useToast } from '@/components/Toast'
import FavoriteStar from '@/components/FavoriteStar'
import ConfirmDialog from '@/components/ConfirmDialog'
import FoodSheet from './FoodSheet'

// Estado del sheet: cerrado, nuevo, o editando un alimento.
type SheetState = { open: boolean; food: Food | null; seq: number }

export default function AlimentosView({
  foods,
  isAdmin,
  loadError,
}: {
  foods: Food[]
  isAdmin: boolean
  loadError: boolean
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FoodFilter>('todos')
  const [sheet, setSheet] = useState<SheetState>({ open: false, food: null, seq: 0 })
  const toast = useToast()
  const { favorites, status: favStatus, isFavorite, toggleFavorite } = useFavorites(toast.show)
  const {
    dishes,
    dishById,
    status: dishStatus,
    toggleDishFavorite,
    deleteDish,
  } = useDishes(toast.show)
  const [confirmDish, setConfirmDish] = useState<Dish | null>(null)
  // Platos propios mezclados con la base (mismo orden que /agregar). Con un
  // chip de fuente (INS, Platos, Productos) solo alimentos de la base.
  const isSource = filter !== 'todos' && filter !== 'destacados' && filter !== 'platos'
  const { results, total } = useCatalogSearch(foods, dishes, query, {
    favOnly: filter === 'destacados',
    dishMode: filter === 'platos' ? 'only' : 'all',
    source: isSource ? filter : undefined,
    favorites,
    ready: favStatus !== 'loading' && dishStatus !== 'loading',
  })

  function confirmDelete() {
    const dish = confirmDish
    if (!dish) return
    setConfirmDish(null)
    toast.show(`${dish.name} eliminado`)
    deleteDish(dish.id).then((ok) => {
      if (!ok) toast.show('No se pudo eliminar el plato. Inténtalo de nuevo.')
    })
  }

  // `seq` cambia en cada apertura para que el formulario arranque limpio.
  const openSheet = useCallback(
    (food: Food | null) => setSheet((s) => ({ open: true, food, seq: s.seq + 1 })),
    []
  )
  const openNew = useCallback(() => openSheet(null), [openSheet])
  // Solo el admin registra la acción del botón flotante: sin handler, el
  // Shell no muestra el botón en esta pestaña.
  useFabAction(isAdmin ? openNew : null)

  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
        <div className="relative">
          <Search
            size={18}
            strokeWidth={2.2}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la base"
            aria-label="Buscar en la base"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border-[1.5px] border-line-strong bg-card pr-3.5 pl-[42px] text-base focus:outline-3 focus:outline-focus"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar">
          {FOOD_FILTERS.map((f) => {
            const on = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.value)}
                className={`min-h-10 cursor-pointer rounded-full border px-3 text-[13px] font-semibold ${
                  on ? 'border-acc bg-acc text-white' : 'border-line-strong bg-card'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted" aria-live="polite">
          {loadError ? (
            <span className="text-danger">
              No se pudieron cargar los alimentos. Recarga la página.
            </span>
          ) : (
            <>
              Mostrando {results.length} de {total}
              {total > MAX_RESULTS && ' · Escribe para afinar la búsqueda'}
            </>
          )}
        </p>

        {filter === 'platos' && dishStatus === 'loading' ? (
          <p className="py-2 text-sm text-muted">Cargando tus platos…</p>
        ) : results.length > 0 ? (
          <ul className="flex flex-col">
            {results.map((e) => {
              if (e.kind === 'dish') {
                const t = itemsTotals(e.dish.items)
                const fav = dishById.get(e.id)?.favorite ?? false
                return (
                  <li
                    key={e.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 border-t border-line2 py-2.5 first:border-t-0"
                  >
                    {/* Tocar la fila abre el editor del plato. */}
                    <Link
                      href={`/platos/${e.id}`}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] leading-tight font-semibold">
                          <Utensils
                            size={14}
                            strokeWidth={2.5}
                            aria-label="Plato"
                            className="mr-1 inline-block align-[-1px] text-acc"
                          />
                          {e.name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          por porción · <span className="text-prot">P {round1(t.protein)}</span> ·{' '}
                          <span className="text-carb-t">C {round1(t.carbs)}</span> ·{' '}
                          <span className="text-fat">G {round1(t.fat)}</span>
                        </div>
                      </div>
                      <b className="text-sm whitespace-nowrap">{Math.round(t.kcal)} kcal</b>
                    </Link>
                    <FavoriteStar
                      on={fav}
                      name={e.name}
                      onToggle={() => toggleDishFavorite(e.id)}
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmDish(e.dish)}
                      aria-label={`Eliminar ${e.name}`}
                      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-icon hover:bg-del-bg hover:text-del"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </li>
                )
              }
              const f = e.food
              return (
                <li
                  key={e.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1 border-t border-line2 py-2.5 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] leading-tight font-semibold">
                      {f.name}
                      <span className="ml-1 inline-block rounded-full bg-bg px-[7px] py-px align-[1px] text-[11px] font-semibold text-muted">
                        {SOURCE_LABEL[f.source]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {basisLabel(f)} · <span className="text-prot">P {round1(f.protein)}</span> ·{' '}
                      <span className="text-carb-t">C {round1(f.carbs)}</span> ·{' '}
                      <span className="text-fat">G {round1(f.fat)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <b className="text-sm whitespace-nowrap">{Math.round(f.kcal)} kcal</b>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openSheet(f)}
                        aria-label={`Editar ${f.name}`}
                        className="min-h-9 cursor-pointer rounded-lg px-1.5 text-[13px] font-semibold text-acc hover:bg-acc-soft"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  <FavoriteStar
                    on={isFavorite(f.id)}
                    name={f.name}
                    onToggle={() => toggleFavorite(f.id, f.name)}
                  />
                  {/* Hueco del tacho de los platos: las estrellas quedan alineadas. */}
                  <span className="h-9 w-9" aria-hidden="true" />
                </li>
              )
            })}
          </ul>
        ) : (
          !loadError && (
            <div className="rounded-xl border border-dashed border-line-strong p-[18px] text-center text-sm text-muted">
              {filter === 'platos' && dishes.length === 0
                ? 'Aún no tienes platos. Créalos desde Agregar comida.'
                : filter === 'destacados' && favorites.size === 0 && !dishes.some((d) => d.favorite)
                  ? 'Aún no tienes destacados. Toca ★ en un alimento.'
                  : 'Sin resultados.'}
            </div>
          )
        )}
      </section>

      {isAdmin && (
        <FoodSheet
          open={sheet.open}
          food={sheet.food}
          formKey={sheet.seq}
          onClose={() => setSheet((s) => ({ ...s, open: false }))}
          onDone={toast.show}
        />
      )}

      <ConfirmDialog
        open={confirmDish != null}
        title={`¿Eliminar "${confirmDish?.name ?? ''}"?`}
        description="Se borra de tus platos. Lo que ya registraste en tus comidas no cambia."
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDish(null)}
      />

      <Toast text={toast.text} action={toast.action} />
    </>
  )
}
