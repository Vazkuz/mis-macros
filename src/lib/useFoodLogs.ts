'use client'

import { useRef, useState } from 'react'
import {
  addFoodLog,
  deleteFoodLog,
  setFoodLogEaten,
  updateFoodLogQuantity,
} from '@/app/actions'
import type { Food } from '@/lib/foods'
import { macrosFor, type FoodLog, type Meal } from '@/lib/hoy'

// Registros del día (food_logs) con actualizaciones optimistas: el cambio se
// ve al instante, la server action devuelve la fila guardada (con los macros
// que calcula el trigger) y la reemplaza. Si falla, se revierte y se avisa
// con onError. Lo usan Hoy (marcar, cantidad, quitar) y /agregar (agregar).

export const isTempLog = (id: string) => id.startsWith('tmp-')

/** Escala macros y kcal de un registro a otra cantidad (para el optimista). */
function scaled(log: FoodLog, quantity: number): FoodLog {
  const k = log.quantity > 0 ? quantity / log.quantity : 0
  return {
    ...log,
    quantity,
    protein: log.protein * k,
    carbs: log.carbs * k,
    fat: log.fat * k,
    kcal: log.kcal * k,
  }
}

export function useFoodLogs(
  initialLogs: FoodLog[],
  date: string,
  onError: (message: string) => void
) {
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const tempSeq = useRef(0)

  const put = (log: FoodLog) => setLogs((ls) => ls.map((l) => (l.id === log.id ? log : l)))

  function toggle(log: FoodLog) {
    const next = { ...log, eaten: !log.eaten }
    put(next)
    setFoodLogEaten(log.id, next.eaten).then((res) => {
      if ('error' in res) {
        put(log)
        onError(res.error)
      } else put(res.log)
    })
  }

  function changeQty(log: FoodLog, quantity: number) {
    if (quantity === log.quantity) return
    put(scaled(log, quantity))
    updateFoodLogQuantity(log.id, quantity).then((res) => {
      if ('error' in res) {
        put(log)
        onError(res.error)
      } else put(res.log)
    })
  }

  function remove(log: FoodLog) {
    const index = logs.findIndex((l) => l.id === log.id)
    setLogs((ls) => ls.filter((l) => l.id !== log.id))
    deleteFoodLog(log.id).then((res) => {
      if ('error' in res) {
        setLogs((ls) => {
          const copy = [...ls]
          copy.splice(Math.min(index, copy.length), 0, log)
          return copy
        })
        onError(res.error)
      }
    })
  }

  /** Agrega con eaten=true; si ya está en esa comida, suma la cantidad. */
  function add(food: Food, quantity: number, meal: Meal) {
    const existing = logs.find((l) => l.meal === meal && l.food_id === food.id)
    let optimisticId: string
    if (existing) {
      optimisticId = existing.id
      put(scaled(existing, Math.round((existing.quantity + quantity) * 100) / 100))
    } else {
      optimisticId = `tmp-${++tempSeq.current}`
      setLogs((ls) => [
        ...ls,
        {
          id: optimisticId,
          meal,
          food_id: food.id,
          food_name: food.name,
          quantity,
          eaten: true,
          ...macrosFor(food, quantity),
          basis: food.basis,
          unit_label: food.unit_label,
          grams_per_unit: food.grams_per_unit,
        },
      ])
    }

    addFoodLog({ date, meal, foodId: food.id, quantity }).then((res) => {
      if ('error' in res) {
        if (existing) put(existing)
        else setLogs((ls) => ls.filter((l) => l.id !== optimisticId))
        onError(res.error)
        return
      }
      // Reemplaza la fila optimista por la guardada (puede ser otra fila si
      // el servidor la sumó a una existente que aún no teníamos).
      setLogs((ls) => {
        const at = ls.findIndex((l) => l.id === optimisticId || l.id === res.log.id)
        const without = ls.filter((l) => l.id !== optimisticId && l.id !== res.log.id)
        without.splice(at < 0 ? without.length : Math.min(at, without.length), 0, res.log)
        return without
      })
    })
  }

  return { logs, toggle, changeQty, remove, add }
}
