'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRegisterCenterDialog } from '@/lib/centerDialogLayer'
import { useBackdropClose } from '@/lib/backdropClose'

/**
 * Diálogo central de confirmación (mockup: .cdlg). Se registra en la capa de
 * centerDialogLayer: mientras está abierto, el BottomSheet de abajo queda
 * `inert` y no se cierra por el clic/foco aquí. Se pinta con un portal en
 * <body>: si quedara dentro del sheet, heredaría su `inert` y no respondería.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useRegisterCenterDialog(open)
  const backdropProps = useBackdropClose(onCancel)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    if (!open) return
    const previo = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    // Esc cierra solo este diálogo: se captura en window (antes que el
    // listener de Radix/vaul en document) para que no cierre también el sheet.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onCancelRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (previo && document.contains(previo)) previo.focus()
    }
  }, [open])

  // Todos los hooks van arriba de este return.
  if (!open) return null

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-6"
      {...backdropProps}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        className="flex w-full max-w-[360px] flex-col gap-3 rounded-2xl bg-card p-5 shadow-[0_20px_40px_-12px_rgba(22,32,26,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg">
          {title}
        </h2>
        {description && (
          <p id="confirm-desc" className="text-sm whitespace-pre-line text-muted">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 cursor-pointer rounded-xl border border-line-strong bg-card px-[18px] text-[15px] font-semibold text-acc disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-12 cursor-pointer rounded-xl px-[18px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              danger ? 'bg-danger' : 'bg-acc'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
