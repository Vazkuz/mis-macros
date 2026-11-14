// Solo servidor: usa el cliente de Supabase con cookies (next/headers).
import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

/**
 * ¿El usuario actual es admin? Llama a la RPC is_admin(). Cualquier error
 * cuenta como "no admin". Úsalo en Server Components / actions para mostrar
 * u ocultar controles (p. ej. el + y "Editar" de Alimentos). La seguridad
 * real la ponen las policies de Supabase, no esto.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('is_admin')
    return !error && data === true
  } catch (err) {
    // Deja pasar las señales internas de Next (render dinámico, redirect…).
    unstable_rethrow(err)
    return false
  }
}
