import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/lib/auth'
import { loadFoods, type Food } from '@/lib/foods'
import AlimentosView from './AlimentosView'

async function loadFoodsSafe(): Promise<Food[] | null> {
  try {
    return await loadFoods(await createClient())
  } catch (err) {
    // Deja pasar las señales internas de Next (render dinámico, redirect…).
    unstable_rethrow(err)
    console.error('loadFoods falló:', err)
    return null
  }
}

export default async function Page() {
  const [admin, foods] = await Promise.all([isAdmin(), loadFoodsSafe()])

  return (
    <>
      <h1 className="text-[26px]">Alimentos</h1>
      <AlimentosView foods={foods ?? []} isAdmin={admin} loadError={foods === null} />
    </>
  )
}
