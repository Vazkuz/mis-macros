'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { deleteMeasurement, saveMeasurement, updateMeasurement } from '@/app/actions'
import Toast, { useToast } from '@/components/Toast'
import { twoCols } from '@/components/Skeleton'
import { useFabAction } from '@/lib/fab'
import {
  RATIO_SALUDABLE,
  ddmm,
  fmtDelta,
  fmtNum,
  rowDate,
  sortDesc,
  summarize,
  type Measurement,
  type Summary,
} from '@/lib/progreso'
import MeasurementSheet, { type MeasurementDraft } from './MeasurementSheet'
import TrendChart from './TrendChart'

type Metric = 'waist' | 'weight'
// Estado del sheet: cerrado, nueva, o editando una medición.
type SheetState = { open: boolean; editing: Measurement | null; seq: number }

const isTemp = (id: string) => id.startsWith('tmp-')
const cardClass = 'flex min-w-0 flex-col rounded-2xl border border-line bg-card p-4'
const dashedClass =
  'rounded-2xl border border-dashed border-line-strong p-[18px] text-center text-sm'

export default function ProgresoView({
  initial,
  loadError,
  heightCm,
  today,
}: {
  initial: Measurement[]
  loadError: boolean
  heightCm: number | null
  today: string
}) {
  const [list, setList] = useState<Measurement[]>(() => sortDesc(initial))
  const [metric, setMetric] = useState<Metric>('waist')
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null, seq: 0 })
  const tempSeq = useRef(0)
  const toast = useToast()

  const summary = useMemo(() => summarize(list, heightCm), [list, heightCm])

  const openSheet = useCallback(
    (editing: Measurement | null) => setSheet((s) => ({ open: true, editing, seq: s.seq + 1 })),
    []
  )
  const openNew = useCallback(() => openSheet(null), [openSheet])
  useFabAction(openNew)

  const closeSheet = () => setSheet((s) => ({ ...s, open: false }))

  /** Reemplaza (o agrega) `m` y quita los ids de `drop`; siempre ordenado. */
  const put = (m: Measurement | null, drop: string[] = []) =>
    setList((ls) =>
      sortDesc([...ls.filter((x) => !drop.includes(x.id) && x.id !== m?.id), ...(m ? [m] : [])])
    )

  function handleSave(draft: MeasurementDraft, editing: Measurement | null) {
    closeSheet()
    toast.show('Medición guardada')

    if (editing) {
      put({ ...editing, measuredOn: draft.date, weightKg: draft.weightKg, waistCm: draft.waistCm })
      updateMeasurement(editing.id, draft).then((res) => {
        if ('error' in res) {
          put(editing)
          toast.show(res.error)
        } else put(res.measurement)
      })
      return
    }

    // Nueva: si ya hay una ese día, se completa (un campo vacío no borra).
    const existing = list.find((m) => m.measuredOn === draft.date) ?? null
    const tmpId = `tmp-${++tempSeq.current}`
    put({
      id: existing?.id ?? tmpId,
      measuredOn: draft.date,
      weightKg: draft.weightKg ?? existing?.weightKg ?? null,
      waistCm: draft.waistCm ?? existing?.waistCm ?? null,
    })
    saveMeasurement(draft).then((res) => {
      if ('error' in res) {
        if (existing) put(existing)
        else put(null, [tmpId])
        toast.show(res.error)
      } else put(res.measurement, [tmpId])
    })
  }

  function handleDelete(m: Measurement) {
    closeSheet()
    toast.show('Medición eliminada')
    put(null, [m.id])
    deleteMeasurement(m.id).then((res) => {
      if ('error' in res) {
        put(m)
        toast.show(res.error)
      }
    })
  }

  // Serie del gráfico: solo las mediciones con ese valor, de la más antigua a la más reciente.
  const points = useMemo(
    () =>
      list
        .filter((m) => (metric === 'waist' ? m.waistCm : m.weightKg) != null)
        .map((m) => ({
          date: m.measuredOn,
          value: (metric === 'waist' ? m.waistCm : m.weightKg) as number,
        }))
        .reverse(),
    [list, metric]
  )

  const sheetEl = (
    <MeasurementSheet
      open={sheet.open}
      editing={sheet.editing}
      formKey={sheet.seq}
      measurements={list}
      today={today}
      onClose={closeSheet}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  )

  // Todos los hooks van arriba de estos returns.
  if (loadError) {
    return (
      <>
        <div className={`${dashedClass} text-danger`}>
          No se pudieron cargar tus mediciones. Recarga la página.
        </div>
        <Toast text={toast.text} />
      </>
    )
  }

  if (!summary) {
    return (
      <>
        <div className={`${dashedClass} text-muted`}>
          Registra tu primera medición. Toca + para empezar.
        </div>
        {sheetEl}
        <Toast text={toast.text} />
      </>
    )
  }

  const currentYear = today.slice(0, 4)

  return (
    <div className={twoCols}>
      {/* Indicadores: arriba en móvil, a la izquierda y sticky desde 900px. */}
      <div className="flex min-w-0 flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-[90px]">
        <WaistCard s={summary} hasHeight={heightCm != null} />

        <div className="grid grid-cols-2 gap-2.5">
          <section className={`${cardClass} gap-1 p-3.5`}>
            <h2 className="font-sans text-[13px] font-semibold text-muted">Peso</h2>
            <p className="num text-[26px] leading-none">
              {summary.weight != null ? fmtNum(summary.weight) : '—'}{' '}
              {summary.weight != null && (
                <span className="text-sm font-medium text-muted">kg</span>
              )}
            </p>
            <p className="text-xs text-muted">
              {[
                summary.bmi != null && `IMC ${summary.bmi.toFixed(1)}`,
                summary.weightDelta != null && `${fmtDelta(summary.weightDelta)} kg`,
              ]
                .filter(Boolean)
                .join(' · ') || ' '}
            </p>
          </section>
          <section className={`${cardClass} gap-1 p-3.5`}>
            <h2 className="font-sans text-[13px] font-semibold text-muted">Última medición</h2>
            <p className="num text-[26px] leading-none">{ddmm(summary.latest.measuredOn)}</p>
            <p className="text-xs text-muted">
              {summary.waistDelta != null ? `Cintura ${fmtDelta(summary.waistDelta)} cm` : ' '}
            </p>
          </section>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <section className={`${cardClass} gap-3`}>
          <div className="flex gap-1.5" role="group" aria-label="Qué graficar">
            {(
              [
                ['waist', 'Cintura'],
                ['weight', 'Peso'],
              ] as const
            ).map(([value, label]) => {
              const on = metric === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMetric(value)}
                  className={`min-h-10 cursor-pointer rounded-xl border px-4 text-[13px] font-semibold ${
                    on ? 'border-acc bg-acc text-white' : 'border-line bg-card'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {points.length ? (
            <TrendChart
              key={metric}
              points={points}
              goal={metric === 'waist' ? summary.waistGoal : null}
              label={
                metric === 'waist'
                  ? 'Evolución de la cintura frente a la meta'
                  : 'Evolución del peso'
              }
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              Aún no hay datos de {metric === 'waist' ? 'cintura' : 'peso'}
            </p>
          )}
        </section>

        <section className={`${cardClass} gap-1`}>
          <h2 className="mb-1 text-lg">Historial</h2>
          <ul className="flex flex-col">
            {list.map((m) => (
              <li key={m.id} className="border-t border-line2 first:border-t-0">
                <button
                  type="button"
                  disabled={isTemp(m.id)}
                  onClick={() => openSheet(m)}
                  aria-label={`Editar medición del ${rowDate(m.measuredOn, currentYear)}`}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:bg-bg disabled:cursor-default disabled:opacity-60"
                >
                  <span className="text-sm font-semibold">{rowDate(m.measuredOn, currentYear)}</span>
                  <span className="num text-[15px] whitespace-nowrap">
                    {m.weightKg != null ? `${fmtNum(m.weightKg)} kg` : '—'}
                    <span className="text-muted"> · </span>
                    {m.waistCm != null ? `${fmtNum(m.waistCm)} cm` : '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {sheetEl}
      <Toast text={toast.text} />
    </div>
  )
}

function WaistCard({ s, hasHeight }: { s: Summary; hasHeight: boolean }) {
  const left = s.waist != null && s.waistGoal != null ? s.waist - s.waistGoal : null
  const healthy = s.ratio != null && s.ratio < RATIO_SALUDABLE

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-ink p-4 text-white">
      <h2 className="font-sans text-[13px] font-semibold text-disabled">Cintura</h2>
      <p className="num text-5xl leading-none">
        {s.waist != null ? fmtNum(s.waist) : '—'}{' '}
        {s.waist != null && <span className="text-lg font-medium text-disabled">cm</span>}
      </p>

      {s.waist == null ? (
        <p className="text-sm text-disabled">Aún no registras tu cintura.</p>
      ) : !hasHeight ? (
        <p className="text-sm text-disabled">
          Agrega tu talla en{' '}
          <Link href="/meta" className="font-semibold text-white underline">
            Meta
          </Link>{' '}
          para ver tu meta de cintura.
        </p>
      ) : (
        <>
          <div
            className="h-2 overflow-hidden rounded-full bg-ink-line"
            role="progressbar"
            aria-label="Avance hacia la meta de cintura"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(s.progress * 100)}
          >
            <div
              className="h-full rounded-full bg-mint"
              style={{ width: `${Math.round(s.progress * 100)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-disabled">Meta {fmtNum(s.waistGoal as number)} cm</span>
            <b>{left != null && left > 0 ? `Te faltan ${fmtNum(left)} cm` : 'Llegaste a tu meta'}</b>
          </div>
          {s.ratio != null && (
            <div className="flex items-baseline justify-between gap-2 border-t border-ink-line pt-2 text-sm">
              <span className="text-disabled">Cintura / altura</span>
              <span>
                <b className={`num ${healthy ? 'text-mint' : 'text-carb-l'}`}>
                  {s.ratio.toFixed(2)}
                </b>
                <span className="text-disabled"> · saludable &lt; 0.50</span>
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
