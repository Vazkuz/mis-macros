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
  healthyBmi,
  rowDate,
  sortDesc,
  summarize,
  type Measurement,
  type Summary,
} from '@/lib/progreso'
import MeasurementSheet, { type MeasurementDraft } from './MeasurementSheet'
import TrendChart from './TrendChart'

type Metric = 'weight' | 'waist'
// Estado del sheet: cerrado, nueva, o editando una medición.
type SheetState = { open: boolean; editing: Measurement | null; seq: number }

const isTemp = (id: string) => id.startsWith('tmp-')
const cardClass = 'flex min-w-0 flex-col rounded-2xl border border-line bg-card p-4'
const dashedClass =
  'rounded-2xl border border-dashed border-line-strong p-[18px] text-center text-sm'
const NBSP = ' '

export default function ProgresoView({
  initial,
  loadError,
  heightCm,
  weightGoalKg,
  today,
}: {
  initial: Measurement[]
  loadError: boolean
  heightCm: number | null
  weightGoalKg: number | null
  today: string
}) {
  const [list, setList] = useState<Measurement[]>(() => sortDesc(initial))
  // El selector controla toda la pantalla. Siempre arranca en Peso.
  const [metric, setMetric] = useState<Metric>('weight')
  const [sheet, setSheet] = useState<SheetState>({ open: false, editing: null, seq: 0 })
  const tempSeq = useRef(0)
  const toast = useToast()

  const summary = useMemo(
    () => summarize(list, heightCm, weightGoalKg),
    [list, heightCm, weightGoalKg]
  )

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
  const isWeight = metric === 'weight'
  const range = summary.weightRange

  // Franja saludable del gráfico (sin talla, no hay).
  const band =
    heightCm == null
      ? null
      : isWeight
        ? range && { lo: range.lo, hi: range.hi, label: 'IMC saludable' }
        : { lo: null, hi: heightCm * RATIO_SALUDABLE, label: 'Saludable' }

  return (
    <>
      <div className="flex gap-1.5" role="group" aria-label="Qué mostrar">
        {(
          [
            ['weight', 'Peso'],
            ['waist', 'Cintura'],
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

      <div className={twoCols}>
        {/* Indicadores: arriba en móvil, a la izquierda y sticky desde 900px. */}
        <div className="flex min-w-0 flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-[90px]">
          <Swap
            showFirst={isWeight}
            first={<WeightCard s={summary} />}
            second={<WaistCard s={summary} hasHeight={heightCm != null} />}
          />

          <div className="grid grid-cols-2 gap-2.5">
            {/* La tarjeta chica muestra la otra métrica. */}
            <Swap
              showFirst={isWeight}
              first={
                <SmallCard
                  title="Cintura"
                  value={summary.waist}
                  unit="cm"
                  sub={[
                    summary.ratio != null && `Cint./altura ${summary.ratio.toFixed(2)}`,
                    summary.waistDelta != null && `${fmtDelta(summary.waistDelta)} cm`,
                  ]}
                />
              }
              second={
                <SmallCard
                  title="Peso"
                  value={summary.weight}
                  unit="kg"
                  sub={[
                    summary.bmi != null && `IMC ${summary.bmi.toFixed(1)}`,
                    summary.weightDelta != null && `${fmtDelta(summary.weightDelta)} kg`,
                  ]}
                />
              }
            />
            <section className={`${cardClass} gap-1 p-3.5`}>
              <h2 className="font-sans text-[13px] font-semibold text-muted">Última medición</h2>
              <p className="num text-[26px] leading-none">{ddmm(summary.latest.measuredOn)}</p>
              <p className="text-xs text-muted">
                {summary.waistDelta != null ? `Cintura ${fmtDelta(summary.waistDelta)} cm` : NBSP}
              </p>
            </section>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <section className={`${cardClass} gap-3`}>
            {points.length ? (
              <TrendChart
                key={metric}
                points={points}
                goal={isWeight ? summary.weightGoal : summary.waistGoal}
                band={band}
                unit={isWeight ? 'kg' : 'cm'}
                currentYear={currentYear}
                label={
                  isWeight
                    ? 'Evolución del peso frente al rango saludable'
                    : 'Evolución de la cintura frente a la meta'
                }
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted">
                Aún no hay datos de {isWeight ? 'peso' : 'cintura'}
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
                    <span className="text-sm font-semibold">
                      {rowDate(m.measuredOn, currentYear)}
                    </span>
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
    </>
  )
}

/**
 * Pinta las dos variantes en la misma celda de un grid y oculta (sin sacarla
 * del flujo) la inactiva: así las dos miden lo mismo y nada salta al cambiar.
 */
function Swap({
  showFirst,
  first,
  second,
}: {
  showFirst: boolean
  first: React.ReactNode
  second: React.ReactNode
}) {
  const cell = 'col-start-1 row-start-1 grid min-w-0'
  return (
    <div className="grid min-w-0">
      <div
        className={`${cell} ${showFirst ? '' : 'invisible'}`}
        aria-hidden={!showFirst}
        inert={!showFirst}
      >
        {first}
      </div>
      <div
        className={`${cell} ${showFirst ? 'invisible' : ''}`}
        aria-hidden={showFirst}
        inert={showFirst}
      >
        {second}
      </div>
    </div>
  )
}

function SmallCard({
  title,
  value,
  unit,
  sub,
}: {
  title: string
  value: number | null
  unit: string
  sub: (string | false)[]
}) {
  return (
    <section className={`${cardClass} gap-1 p-3.5`}>
      <h2 className="font-sans text-[13px] font-semibold text-muted">{title}</h2>
      <p className="num text-[26px] leading-none">
        {value != null ? fmtNum(value) : '—'}{' '}
        {value != null && <span className="text-sm font-medium text-muted">{unit}</span>}
      </p>
      <p className="text-xs text-muted">{sub.filter(Boolean).join(' · ') || NBSP}</p>
    </section>
  )
}

/**
 * Esqueleto común de las tarjetas oscuras: etiqueta, valor grande, barra,
 * fila de meta, separador y 2 filas. Las piezas que faltan reservan su espacio.
 */
function DarkCard({
  label,
  value,
  unit,
  progress,
  progressLabel,
  goalRow,
  bottom,
}: {
  label: string
  value: number | null
  unit: string
  /** null = sin barra (queda su espacio). */
  progress: number | null
  progressLabel: string
  goalRow: React.ReactNode
  bottom: React.ReactNode
}) {
  const pc = Math.round((progress ?? 0) * 100)
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-ink p-4 text-white">
      <h2 className="font-sans text-[13px] font-semibold text-disabled">{label}</h2>
      <p className="num text-5xl leading-none">
        {value != null ? fmtNum(value) : '—'}{' '}
        {value != null && <span className="text-lg font-medium text-disabled">{unit}</span>}
      </p>
      {progress != null ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-ink-line"
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pc}
        >
          <div className="h-full rounded-full bg-mint" style={{ width: `${pc}%` }} />
        </div>
      ) : (
        <div className="invisible h-2" aria-hidden="true" />
      )}
      <div className="flex min-h-5 items-baseline justify-between gap-2 text-sm">{goalRow}</div>
      <div className="flex flex-col gap-1.5 border-t border-ink-line pt-2 text-sm">{bottom}</div>
    </section>
  )
}

/** Fila de datos de la tarjeta oscura; `hidden` reserva su espacio. */
function Row({
  label,
  hidden = false,
  children,
}: {
  label: string
  hidden?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex min-h-5 items-baseline justify-between gap-2 ${hidden ? 'invisible' : ''}`}
      aria-hidden={hidden || undefined}
    >
      <span className="text-disabled">{label}</span>
      <span className="text-right">{hidden ? NBSP : children}</span>
    </div>
  )
}

function GoToMeta() {
  return (
    <Link href="/meta" className="font-semibold text-white underline">
      Meta
    </Link>
  )
}

function WeightCard({ s }: { s: Summary }) {
  const w = s.weight
  const range = s.weightRange
  const hasGoal = w != null && s.weightGoal != null

  let goalRow: React.ReactNode
  if (w == null) {
    goalRow = <span className="text-disabled">Aún no registras tu peso.</span>
  } else if (hasGoal) {
    const goal = s.weightGoal as number
    goalRow = (
      <>
        <span className="text-disabled">Meta {fmtNum(goal)} kg</span>
        <b>
          {s.weightGoalReached
            ? 'Llegaste a tu meta'
            : `Te faltan ${fmtNum(Math.abs(w - goal))} kg`}
        </b>
      </>
    )
  } else if (range) {
    const gap = w < range.lo ? range.lo - w : w > range.hi ? w - range.hi : 0
    goalRow =
      gap === 0 ? (
        <b className="text-mint">Estás en tu rango saludable</b>
      ) : (
        <b>Te faltan {fmtNum(gap)} kg para tu rango saludable</b>
      )
  } else {
    // Sin meta ni talla: la fila queda vacía (el aviso de la talla va abajo).
    goalRow = <span aria-hidden="true">{NBSP}</span>
  }

  return (
    <DarkCard
      label="Peso"
      value={w}
      unit="kg"
      progress={hasGoal ? s.weightProgress : null}
      progressLabel="Avance hacia la meta de peso"
      goalRow={goalRow}
      bottom={
        range ? (
          <>
            <Row label="IMC" hidden={s.bmi == null}>
              {s.bmi != null && (
                <>
                  <b className={`num ${healthyBmi(s.bmi) ? 'text-mint' : 'text-carb-l'}`}>
                    {s.bmi.toFixed(1)}
                  </b>
                  <span className="text-disabled"> · saludable 18.5–24.9</span>
                </>
              )}
            </Row>
            <Row label="Rango saludable">
              {fmtNum(range.lo)} – {fmtNum(range.hi)} kg
            </Row>
          </>
        ) : (
          <p className="min-h-[46px] text-disabled">
            Agrega tu talla en <GoToMeta /> para ver tu IMC y tu rango saludable.
          </p>
        )
      }
    />
  )
}

function WaistCard({ s, hasHeight }: { s: Summary; hasHeight: boolean }) {
  const left = s.waist != null && s.waistGoal != null ? s.waist - s.waistGoal : null
  const healthy = s.ratio != null && s.ratio < RATIO_SALUDABLE
  const showGoal = s.waist != null && hasHeight && s.waistGoal != null

  return (
    <DarkCard
      label="Cintura"
      value={s.waist}
      unit="cm"
      progress={showGoal ? s.progress : null}
      progressLabel="Avance hacia la meta de cintura"
      goalRow={
        s.waist == null ? (
          <span className="text-disabled">Aún no registras tu cintura.</span>
        ) : !showGoal ? (
          <span className="text-disabled">
            Agrega tu talla en <GoToMeta /> para ver tu meta de cintura.
          </span>
        ) : (
          <>
            <span className="text-disabled">Meta {fmtNum(s.waistGoal as number)} cm</span>
            <b>{left != null && left > 0 ? `Te faltan ${fmtNum(left)} cm` : 'Llegaste a tu meta'}</b>
          </>
        )
      }
      bottom={
        <>
          <Row label="Cintura / altura" hidden={s.ratio == null}>
            {s.ratio != null && (
              <>
                <b className={`num ${healthy ? 'text-mint' : 'text-carb-l'}`}>{s.ratio.toFixed(2)}</b>
                <span className="text-disabled"> · saludable &lt; 0.50</span>
              </>
            )}
          </Row>
          <Row label="Rango saludable" hidden={s.waistGoal == null}>
            &lt; {s.waistGoal != null ? fmtNum(s.waistGoal) : ''} cm
          </Row>
        </>
      }
    />
  )
}
