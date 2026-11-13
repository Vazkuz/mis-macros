'use client'

import { X } from 'lucide-react'
import { Drawer } from 'vaul'
import { useAnyCenterDialogOpen } from '@/lib/centerDialogLayer'
import { useLockBodyScroll } from '@/lib/bodyScrollLock'

/**
 * Wrapper único sobre vaul para todos los bottom sheets de la app.
 * Si el día de mañana cambiamos de librería, solo se toca este archivo.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  // Si hay un diálogo central (ConfirmDialog, AdjustBalanceModal, etc.) abierto
  // encima, el contenido del sheet se marca `inert`: así el foco no puede
  // quedar atrapado ahí (el FocusScope de vaul se niega a re-enfocar un nodo
  // inerte) mientras el sheet sigue abierto debajo. NO tocamos la prop `modal`
  // de vaul en caliente: Radix cambia de componente interno (Content modal vs
  // no-modal) según ese valor, y alternarlo con el Drawer ya abierto rompe el
  // orden de hooks ("Rendered fewer hooks than expected").
  const centerDialogOpen = useAnyCenterDialogOpen()

  // vaul solo bloquea el scroll del body en Safari/iOS; en Chrome/Android el
  // fondo sigue scrolleando con el sheet abierto. Lock aparte, ortogonal al
  // `inert` de arriba: solo toca `overflow`, nunca pointer-events ni z-index.
  useLockBodyScroll(open)

  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          inert={centerDialogOpen || undefined}
          onInteractOutside={(e) => {
            // Con un diálogo central abierto encima, un tap/foco ahí cuenta
            // como "interacción fuera" del Drawer para Radix y dispararía su
            // dismiss. onPointerDownOutside solo, no alcanza: vaul ignora
            // cualquier onFocusOutside que le pasemos (lo pisa internamente),
            // así que hay que cortar acá, que cubre ambos casos.
            if (centerDialogOpen) e.preventDefault()
          }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[760px] flex-col rounded-t-[20px] border border-line bg-surface shadow-lg outline-none"
        >
          {/* Región scrolleable separada de Drawer.Content: vaul marca Content con
              touch-action:none para controlar el drag por JS, así que el scroll interno
              tiene que vivir en un hijo aparte (mismo patrón que usa vaul en su propio
              ejemplo con contenido largo). El tope de altura también va aquí, no en
              Content: sin su propio max-height este div crecería sin límite y nunca
              generaría overflow. Ahí es donde `shouldDrag` de vaul detecta el scrollTop
              para decidir si el gesto hace scroll o cierra el sheet. */}
          <div className="min-h-0 max-h-[85vh] flex-1 overflow-y-auto overscroll-contain p-6 pb-8">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />

            <div className="mb-2 flex items-center justify-between gap-3">
              <Drawer.Title className={title ? 'text-sm font-medium text-ink-soft' : 'sr-only'}>
                {title ?? 'Panel'}
              </Drawer.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-muted hover:bg-chip hover:text-ink-soft"
              >
                <X size={16} />
              </button>
            </div>

            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
