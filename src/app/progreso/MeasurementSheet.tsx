'use client'

import { useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  ERR_CINTURA,
  ERR_FECHA_OCUPADA,
  ERR_NINGUNO,
  ERR_PESO,
  fmtNum,
  parseDecimal,
  validWaist,
  validWeight,
  type Measurement,
} from '@/lib/progreso'

export type MeasurementDraft = { date: string; weightKg: number | null; waistCm: number | null }

const inputClass =
  'min-h-12 w-full min-w-0 rounded-xl border border-line-strong bg-card px-3 text-base focus:outline-3 focus:outline-focus aria-invalid:border-danger'
const labelClass = 'text-sm font-semibold'

/**
 * Sheet "Nueva medición" / "Editar medición". `formKey` cambia en cada
 * apertura para que el formulario arranque limpio. Guardar y eliminar son
 * optimistas: el sheet solo valida y le pasa el resultado a la vista.
 */
export default function MeasurementSheet({
  open,
  editing,
  formKey,
  measurements,
  today,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  editing: Measurement | null
  formKey: number
  measurements: Measurement[]
  today: string
  onClose: () => void
  onSave: (draft: MeasurementDraft, editing: Measurement | null) => void
  onDelete: (m: Measurement) => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar medición' : 'Nueva medición'}
    >
      <MeasurementForm
        key={formKey}
        editing={editing}
        measurements={measurements}
        today={today}
        onSave={onSave}
        onDelete={onDelete}
      />
    </BottomSheet>
  )
}

type Errors = { date?: string; weight?: string; waist?: string; form?: string }

function MeasurementForm({
  editing,
  measurements,
  today,
  onSave,
  onDelete,
}: {
  editing: Measurement | null
  measurements: Measurement[]
  today: string
  onSave: (draft: MeasurementDraft, editing: Measurement | null) => void
  onDelete: (m: Measurement) => void
}) {
  const [date, setDate] = useState(editing?.measuredOn ?? today)
  const [weight, setWeight] = useState(editing?.weightKg != null ? String(editing.weightKg) : '')
  const [waist, setWaist] = useState(editing?.waistCm != null ? String(editing.waistCm) : '')
  const [errors, setErrors] = useState<Errors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Placeholders: último valor registrado de cada uno.
  const lastWeight = measurements.find((m) => m.weightKg != null)?.weightKg
  const lastWaist = measurements.find((m) => m.waistCm != null)?.waistCm

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const w = parseDecimal(weight)
    const c = parseDecimal(waist)
    const next: Errors = {}
    if (!date || date > today) next.date = 'Elige una fecha que no sea futura.'
    else if (
      editing &&
      date !== editing.measuredOn &&
      measurements.some((m) => m.measuredOn === date && m.id !== editing.id)
    ) {
      next.date = ERR_FECHA_OCUPADA
    }
    if (w != null && !validWeight(w)) next.weight = ERR_PESO
    if (c != null && !validWaist(c)) next.waist = ERR_CINTURA
    if (w == null && c == null) next.form = ERR_NINGUNO
    setErrors(next)
    if (Object.keys(next).length) return
    onSave({ date, weightKg: w, waistCm: c }, editing)
  }

  const clear = (key: keyof Errors) =>
    setErrors((er) => (er[key] || er.form ? { ...er, [key]: undefined, form: undefined } : er))

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mDate" className={labelClass}>
          Fecha
        </label>
        <input
          id="mDate"
          type="date"
          max={today}
          required
          value={date}
          aria-invalid={!!errors.date || undefined}
          aria-describedby={errors.date ? 'mDateErr' : undefined}
          onChange={(e) => {
            setDate(e.target.value)
            clear('date')
          }}
          className={inputClass}
        />
        {errors.date && (
          <p id="mDateErr" className="text-[13px] text-danger">
            {errors.date}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="mPeso" className={labelClass}>
            Peso (kg)
          </label>
          <input
            id="mPeso"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={lastWeight != null ? fmtNum(lastWeight, 2) : '74'}
            value={weight}
            aria-invalid={!!errors.weight || undefined}
            aria-describedby={errors.weight ? 'mPesoErr' : undefined}
            onChange={(e) => {
              setWeight(e.target.value)
              clear('weight')
            }}
            className={inputClass}
          />
          {errors.weight && (
            <p id="mPesoErr" className="text-[13px] text-danger">
              {errors.weight}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="mCint" className={labelClass}>
            Cintura (cm)
          </label>
          <input
            id="mCint"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={lastWaist != null ? fmtNum(lastWaist, 2) : '92'}
            value={waist}
            aria-invalid={!!errors.waist || undefined}
            aria-describedby={errors.waist ? 'mCintErr' : undefined}
            onChange={(e) => {
              setWaist(e.target.value)
              clear('waist')
            }}
            className={inputClass}
          />
          {errors.waist && (
            <p id="mCintErr" className="text-[13px] text-danger">
              {errors.waist}
            </p>
          )}
        </div>
      </div>

      {errors.form && (
        <p role="alert" className="text-[13px] text-danger">
          {errors.form}
        </p>
      )}

      <p className="text-xs text-muted">
        {editing
          ? 'Llena al menos uno.'
          : 'Llena al menos uno. Si ya hay una medición ese día, se completa con estos datos.'}
      </p>

      <button
        type="submit"
        className="min-h-12 w-full cursor-pointer rounded-xl bg-acc px-[18px] text-[15px] font-semibold text-white"
      >
        {editing ? 'Guardar cambios' : 'Guardar medición'}
      </button>

      {editing && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="min-h-12 w-full cursor-pointer rounded-xl border border-danger-line bg-card px-[18px] text-[15px] font-semibold text-danger"
        >
          Eliminar
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar medición?"
        description={
          editing
            ? `Se borrará la medición del ${editing.measuredOn.split('-').reverse().join('/')}.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          setConfirmOpen(false)
          if (editing) onDelete(editing)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  )
}
