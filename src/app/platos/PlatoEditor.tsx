'use client'

import { useRouter } from 'next/navigation'
import DishEditor from '@/components/DishEditor'
import { flashToast } from '@/components/Toast'
import { useDishes } from '@/lib/useDishes'
import type { Dish } from '@/lib/dishes'

/**
 * /platos/nuevo y /platos/[id]. Al crear vuelve a /agregar con el plato ya
 * elegido; al editar o borrar, vuelve a `backHref` (si se abrió desde
 * /agregar) o a la pantalla anterior.
 */
export default function PlatoEditor({
  dish,
  agregarHref,
  backHref = null,
}: {
  /** null = plato nuevo. */
  dish: Dish | null
  /** /agregar?meal=&d= (para volver al crear o con ←). */
  agregarHref: string
  /** ?back= (desde /agregar): a dónde volver al guardar, borrar o tocar ←. */
  backHref?: string | null
}) {
  const router = useRouter()
  const { saveDish, deleteDish } = useDishes()

  function goBack(fallback: string) {
    if (backHref) router.replace(backHref)
    else if (window.history.length > 1) router.back()
    else router.replace(fallback)
  }

  /** Tras borrar, el plato ya no puede quedar elegido al volver. */
  function goBackWithout(id: string, fallback: string) {
    if (!backHref) return goBack(fallback)
    const url = new URL(backHref, window.location.origin)
    if (url.searchParams.get('sel') === `dish:${id}`) url.searchParams.delete('sel')
    router.replace(`${url.pathname}${url.search}`)
  }

  if (!dish) {
    return (
      <DishEditor
        title="Nuevo plato"
        onBack={() => router.replace(agregarHref)}
        showName
        initialItems={[]}
        totalLabel="Total del plato (1 porción)"
        saveLabel="Guardar plato"
        note="Se agrega solo a tus destacados ★"
        onSave={async ({ name, items }) => {
          const id = await saveDish(null, name, items)
          if (!id) return 'No se pudo guardar el plato. Inténtalo de nuevo.'
          flashToast('Plato creado y agregado a tus destacados')
          const sep = agregarHref.includes('?') ? '&' : '?'
          router.replace(`${agregarHref}${sep}sel=dish:${id}`)
          return null
        }}
      />
    )
  }

  return (
    <DishEditor
      title="Editar plato"
      onBack={() => goBack('/alimentos')}
      showName
      initialName={dish.name}
      initialItems={dish.items}
      totalLabel="Total del plato (1 porción)"
      saveLabel="Guardar cambios"
      onSave={async ({ name, items }) => {
        const id = await saveDish(dish.id, name, items)
        if (!id) return 'No se pudieron guardar los cambios. Inténtalo de nuevo.'
        flashToast('Plato actualizado')
        goBack('/alimentos')
        return null
      }}
      onDelete={async () => {
        if (!(await deleteDish(dish.id))) {
          return 'No se pudo eliminar el plato. Inténtalo de nuevo.'
        }
        flashToast(`${dish.name} eliminado`)
        goBackWithout(dish.id, '/alimentos')
        return null
      }}
    />
  )
}
