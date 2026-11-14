'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}

const CODIGO_INVALIDO = 'Código inválido o ya usado'

export async function redeemInviteCode(code: string): Promise<{ error: string } | undefined> {
  // No lanza nunca por un canje fallido: en producción Next enmascara el
  // mensaje de cualquier excepción de una server action, así que el motivo
  // real se loguea y al cliente vuelve { error }. El redirect va FUERA del
  // try: internamente lanza y no debe confundirse con un fallo del canje.
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('redeem_invite', { p_code: code })
    if (error) {
      console.error('redeem_invite devolvió error:', error)
      return { error: CODIGO_INVALIDO }
    }
  } catch (err) {
    console.error('redeem_invite lanzó una excepción inesperada:', err)
    return { error: CODIGO_INVALIDO }
  }

  redirect('/')
}
