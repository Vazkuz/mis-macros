'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayLima } from '@/lib/metas'
import { addDays, dayLabel, isIsoDate } from '@/lib/hoy'

const btn =
  'inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-bg'

/** "‹ Vie 14/11 ›" en la cabecera de Hoy. La fecha vive en ?d=YYYY-MM-DD. */
export default function HeaderDate() {
  const params = useSearchParams()
  const today = todayLima()
  const d = params.get('d')
  const date = isIsoDate(d) && d <= today ? d : today
  const prev = addDays(date, -1)
  const next = addDays(date, 1)
  const hrefFor = (iso: string) => (iso === today ? '/' : `/?d=${iso}`)

  return (
    <div className="flex items-center gap-0.5">
      <Link href={hrefFor(prev)} aria-label="Día anterior" className={btn}>
        <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
      </Link>
      <span className="min-w-[92px] text-center text-sm font-semibold" aria-live="polite">
        {dayLabel(date)}
      </span>
      {next <= today ? (
        <Link href={hrefFor(next)} aria-label="Día siguiente" className={btn}>
          <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${btn} opacity-30 hover:bg-transparent`}>
          <ChevronRight size={20} strokeWidth={2.5} />
        </span>
      )}
    </div>
  )
}
