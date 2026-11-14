'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/BottomSheet'
import ConfirmDialog from '@/components/ConfirmDialog'
import { createFood, deleteFood, updateFood, type FoodInput } from '@/app/actions'
import {
  SOURCE_LABEL,
  kcalOf,
  type Food,
  type FoodBasis,
  type FoodSource,
  type FoodUnit,
} from '@/lib/foods'

type Draft = {
  name: string
  source: FoodSource
  basis: FoodBasis
  unitLabel: FoodUnit
  gramsPerUnit: string
  protein: string
  carbs: string
  fat: string
  featured: boolean
}

function draftFrom(food: Food | null): Draft {
  if (!food) {
    return {
      name: '',
      source: 'producto',
      basis: '100g',
      unitLabel: 'g',
      gramsPerUnit: '',
      protein: '0',
      carbs: '0',
      fat: '0',
      featured: false,
    }
  }
  return {
    name: food.name,
    source: food.source,
    basis: food.basis,
    unitLabel: food.unit_label,
    gramsPerUnit: food.grams_per_unit != null ? String(food.grams_per_unit) : '',
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    featured: food.featured,
  }
}

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const inputClass =
  'min-h-12 w-full min-w-0 rounded-xl border border-line-strong bg-card px-3 text-base focus:outline-3 focus:outline-focus'
const labelClass = 'text-sm font-semibold'

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 cursor-pointer rounded-full border px-[18px] font-semibold ${
              on ? 'border-acc bg-acc text-white' : 'border-line-strong bg-card'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Sheet "Nuevo alimento" / "Editar alimento" (solo admin). `formKey` cambia
 * en cada apertura para que el formulario arranque limpio.
 */
export default function FoodSheet({
  open,
  food,
  formKey,
  onClose,
  onDone,
}: {
  open: boolean
  food: Food | null
  formKey: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={food ? 'Editar alimento' : 'Nuevo alimento'}>
      <FoodForm key={formKey} food={food} onClose={onClose} onDone={onDone} />
    </BottomSheet>
  )
}

function FoodForm({
  food,
  onClose,
  onDone,
}: {
  food: Food | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(food))
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setError(null)
  }

  const p = num(draft.protein)
  const c = num(draft.carbs)
  const g = num(draft.fat)
  const kcal = kcalOf(p, c, g)
  const per = draft.basis === 'unit' ? 'por unidad' : `por 100 ${draft.unitLabel}`

  function finish(message: string) {
    router.refresh()
    onDone(message)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError('Ponle un nombre al alimento.')
    const gramsPerUnit = draft.basis === 'unit' ? num(draft.gramsPerUnit) : null
    if (draft.basis === 'unit' && !(gramsPerUnit && gramsPerUnit > 0)) {
      return setError('Pon los gramos por unidad.')
    }
    const input: FoodInput = {
      name,
      source: draft.source,
      basis: draft.basis,
      unitLabel: draft.unitLabel,
      gramsPerUnit,
      protein: p,
      carbs: c,
      fat: g,
      featured: draft.featured,
    }
    startTransition(async () => {
      const res = food ? await updateFood(food.id, input) : await createFood(input)
      if ('error' in res) return setError(res.error)
      finish(food ? 'Cambios guardados' : `${name} creado`)
    })
  }

  function handleDelete() {
    if (!food) return
    startTransition(async () => {
      const res = await deleteFood(food.id)
      setConfirmOpen(false)
      if ('error' in res) return setError(res.error)
      finish(`${food.name} eliminado`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fName" className={labelClass}>
          Nombre
        </label>
        <input
          id="fName"
          required
          maxLength={120}
          placeholder="Ej. Yogurt griego Gloria"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Fuente</span>
        <Seg
          label="Fuente"
          value={draft.source}
          onChange={(v) => set('source', v)}
          options={(['ins', 'plato', 'producto'] as const).map((v) => ({
            value: v,
            label: SOURCE_LABEL[v],
          }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Medida</span>
        <Seg
          label="Medida"
          value={draft.basis}
          onChange={(v) => set('basis', v)}
          options={[
            { value: '100g', label: `Por 100 ${draft.unitLabel}` },
            { value: 'unit', label: 'Por unidad' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Unidad</span>
        <Seg
          label="Unidad"
          value={draft.unitLabel}
          onChange={(v) => set('unitLabel', v)}
          options={[
            { value: 'g', label: 'g' },
            { value: 'mL', label: 'mL' },
          ]}
        />
      </div>

      {draft.basis === 'unit' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fGr" className={labelClass}>
            Gramos por unidad
          </label>
          <input
            id="fGr"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder="50"
            value={draft.gramsPerUnit}
            onChange={(e) => set('gramsPerUnit', e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['protein', 'fP', 'Proteína (g)'],
            ['carbs', 'fC', 'Carbos (g)'],
            ['fat', 'fG', 'Grasa (g)'],
          ] as const
        ).map(([key, id, label]) => (
          <div key={key} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={id} className={labelClass}>
              {label}
            </label>
            <input
              id={id}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
        <input
          type="checkbox"
          checked={draft.featured}
          onChange={(e) => set('featured', e.target.checked)}
          className="h-5 w-5 cursor-pointer accent-acc"
        />
        Destacado
      </label>

      <p className="text-[13px] text-muted" aria-live="polite">
        <b className="text-ink">{Math.round(kcal).toLocaleString('es-PE')} kcal</b> {per}
      </p>
      <p className="text-xs text-muted">Copia los valores de la tabla nutricional del empaque.</p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 w-full cursor-pointer rounded-xl bg-acc px-[18px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-disabled"
      >
        {isPending && !confirmOpen ? 'Guardando…' : food ? 'Guardar cambios' : 'Guardar alimento'}
      </button>

      {food && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="min-h-12 w-full cursor-pointer rounded-xl border border-danger-line bg-card px-[18px] text-[15px] font-semibold text-danger disabled:opacity-60"
        >
          Eliminar alimento
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar alimento?"
        description={`Se borrará “${food?.name ?? ''}” de la base de alimentos. Tus registros pasados con este alimento se mantienen.`}
        confirmLabel={isPending ? 'Eliminando…' : 'Eliminar'}
        danger
        busy={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  )
}
