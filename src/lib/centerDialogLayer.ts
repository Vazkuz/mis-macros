'use client'

import { useEffect, useState } from 'react'
import { useLockBodyScroll } from '@/lib/bodyScrollLock'

let openCount = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/**
 * Se registra mientras `open` sea true. BottomSheet usa este conteo para
 * volverse no-modal cuando un diálogo central se abre encima: si no, el
 * focus trap y el bloqueo de pointer-events de vaul dejan "muerto" al
 * diálogo central (sus inputs/botones no responden).
 *
 * También engancha el diálogo al mismo contador compartido de
 * bodyScrollLock que ya usa BottomSheet: así "bottom sheet abierto" y
 * "diálogo central abierto" alimentan un único total de bloqueos de
 * scroll (nunca se pisan — el body solo se desbloquea cuando TODO cierra),
 * sin tocar el openCount de este módulo, que sigue siendo solo para inert/capas.
 */
export function useRegisterCenterDialog(open: boolean): void {
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    openCount++
    emit()
    return () => {
      openCount--
      emit()
    }
  }, [open])
}

export function useAnyCenterDialogOpen(): boolean {
  const [open, setOpen] = useState(() => openCount > 0)
  useEffect(() => {
    const listener = () => setOpen(openCount > 0)
    listeners.add(listener)
    listener()
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return open
}
