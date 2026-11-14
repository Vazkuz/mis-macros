'use client'

import { useCallback, useState } from 'react'
import { Search, Star } from 'lucide-react'
import {
  FOOD_FILTERS,
  MAX_RESULTS,
  SOURCE_LABEL,
  basisLabel,
  round1,
  type Food,
  type FoodFilter,
} from '@/lib/foods'
import { useFoodSearch } from '@/lib/useFoodSearch'
import { useFabAction } from '@/lib/fab'
import Toast, { useToast } from '@/components/Toast'
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
  const { results, total } = useFoodSearch(foods, query, filter)

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

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por fuente">
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
            <span className="text-danger">No se pudieron cargar los alimentos. Recarga la página.</span>
          ) : (
            <>
              Mostrando {results.length} de {total}
              {total > MAX_RESULTS && ' · Escribe para afinar la búsqueda'}
            </>
          )}
        </p>

        {results.length > 0 ? (
          <ul className="flex flex-col">
            {results.map((f) => (
              <li
                key={f.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line2 py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="text-[15px] leading-tight font-semibold">
                    {f.name}
                    <span className="ml-1 inline-block rounded-full bg-bg px-[7px] py-px align-[1px] text-[11px] font-semibold text-muted">
                      {SOURCE_LABEL[f.source]}
                    </span>
                    {f.featured && (
                      <Star
                        size={13}
                        aria-label="Destacado"
                        className="ml-1 inline-block fill-carb align-[-1px] text-carb"
                      />
                    )}
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
              </li>
            ))}
          </ul>
        ) : (
          !loadError && (
            <div className="rounded-xl border border-dashed border-line-strong p-[18px] text-center text-sm text-muted">
              Sin resultados.
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

      <Toast text={toast.text} />
    </>
  )
}
