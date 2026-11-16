'use client'

import { useRouter } from 'next/navigation'
import DishEditor from '@/components/DishEditor'
import { flashToast } from '@/components/Toast'
import { setLogItems } from '@/app/actions'
import { basisFactor, type DishItem } from '@/lib/dishes'
import type { FoodLog } from '@/lib/hoy'
import { useDishes } from '@/lib/useDishes'

/**
 * Ingrediente del registro → fila del editor. food_log_items guarda macros
 * TOTALES; el editor trabaja con macros por base (100 g/mL o unidad), así que
 * se dividen por el factor de la cantidad.
 */
function toEditorItem(it: FoodLog['items'][number]): DishItem {
  const k = basisFactor(it.basis, it.quantity)
  const per = (v: number) => (k > 0 ? v / k : 0)
  return {
    food_id: it.food_id,
    name: it.food_name,
    basis: it.basis,
    unit_label: it.unit_label,
    quantity: it.quantity,
    protein: per(it.protein),
    carbs: per(it.carbs),
    fat: per(it.fat),
  }
}

export default function ComidaEditor({
  log,
  isToday,
  dishName,
}: {
  log: FoodLog & { log_date: string }
  isToday: boolean
  /** Nombre actual del plato, o null si el plato ya no existe. */
  dishName: string | null
}) {
  const router = useRouter()
  const { saveDish } = useDishes()

  const qs = new URLSearchParams()
  if (!isToday) qs.set('d', log.log_date)
  qs.set('meal', log.meal)
  const hoyHref = `/?${qs.toString()}`
  const canSaveToDish = log.dish_id != null && dishName != null

  return (
    <DishEditor
      title={`Ingredientes · ${log.food_name}`}
      onBack={() => router.replace(hoyHref)}
      showName={false}
      initialItems={log.items.map(toEditorItem)}
      totalLabel="Total en esta comida"
      saveLabel="Guardar cambios"
      saveToDishOption={canSaveToDish}
      onSave={async ({ items, saveToDish }) => {
        const res = await setLogItems(
          log.id,
          items.map((it) => ({ foodId: it.food_id ?? '', quantity: it.quantity }))
        )
        if ('error' in res) return res.error

        let message = 'Ingredientes actualizados en esta comida'
        if (saveToDish && canSaveToDish) {
          // El plato guarda 1 porción: ingredientes ÷ porciones del registro.
          const portions = log.quantity > 0 ? log.quantity : 1
          const perPortion = items.map((it) => ({
            ...it,
            quantity: Math.round((it.quantity / portions) * 100) / 100,
          }))
          const id = await saveDish(log.dish_id, dishName, perPortion)
          message = id
            ? 'Comida y plato actualizados'
            : 'Se guardó en esta comida, pero no en el plato. Inténtalo de nuevo.'
        }
        flashToast(message)
        qs.set('open', log.id)
        router.replace(`/?${qs.toString()}`)
        return null
      }}
    />
  )
}
