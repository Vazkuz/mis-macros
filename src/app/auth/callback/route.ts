import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Vuelta del login con Google. Canjea el code por una sesión y manda a /; el
// proxy se encarga de desviar a /activar si el usuario aún no tiene perfil.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }
    console.error('exchangeCodeForSession devolvió error:', error)
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
