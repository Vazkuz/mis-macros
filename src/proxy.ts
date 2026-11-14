import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

// UBICACIÓN: este archivo va en `src/proxy.ts`, NO en la raíz del repo.
// El proyecto usa `src/`, así que Next busca el proxy aquí. Un `proxy.ts` en la
// raíz compila y nunca se ejecuta, sin error ni warning (lección de Mis Gastos).
// Si el gate de login/activación deja de funcionar, revisa esto primero.

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)',
  ],
}
