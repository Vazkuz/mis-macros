import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Adaptado de Mis Gastos (src/utils/supabase/middleware.ts). Lo llama
// src/proxy.ts en cada request: refresca la sesión de Supabase (reescribe las
// cookies) y aplica el gate de auth:
//   sin sesión                    → /login
//   con sesión pero sin perfil    → /activar   (is_member() = false)
//   con sesión y perfil en /login o /activar → /

// El reloj del dispositivo a veces está unos segundos adelantado y Supabase
// rechaza el token con "JWT issued in the future". Es transitorio: un solo
// reintento tras una breve espera casi siempre lo resuelve.
const CLOCK_SKEW_PATTERN = /issued (in the future|at future)/i

function isClockSkewError(error: unknown) {
  const message =
    error instanceof Error ? error.message : (error as { message?: string } | null)?.message
  return typeof message === 'string' && CLOCK_SKEW_PATTERN.test(message)
}

async function getUserWithClockSkewRetry(supabase: ReturnType<typeof createServerClient>) {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      // Cualquier error que no sea el desfase de reloj se trata como "no
      // autenticado": nunca hay que confiar en data.user cuando hay error.
      if (!isClockSkewError(error)) return null
      await new Promise((resolve) => setTimeout(resolve, 500))
      const retry = await supabase.auth.getUser()
      return retry.error ? null : retry.data.user
    }
    return data.user
  } catch (err) {
    if (!isClockSkewError(err)) return null
    await new Promise((resolve) => setTimeout(resolve, 500))
    try {
      const retry = await supabase.auth.getUser()
      return retry.error ? null : retry.data.user
    } catch {
      return null
    }
  }
}

function redirectTo(request: NextRequest, pathname: string, base: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const response = NextResponse.redirect(url)
  // Las cookies de sesión recién refrescadas tienen que viajar también en la
  // redirección; si no, el navegador se queda con el token viejo.
  base.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return response
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const user = await getUserWithClockSkewRetry(supabase)
  const path = request.nextUrl.pathname

  // Rutas públicas: el callback de Google (llega sin sesión todavía) y la
  // política de privacidad (tiene que poder leerse sin login).
  if (path.startsWith('/auth/callback') || path.startsWith('/privacidad')) {
    return supabaseResponse
  }

  const enLogin = path.startsWith('/login')
  const enActivar = path.startsWith('/activar')

  if (!user) {
    return enLogin ? supabaseResponse : redirectTo(request, '/login', supabaseResponse)
  }

  // El perfil solo existe si el usuario canjeó un código (redeem_invite).
  // Si la RPC falla se trata como "sin perfil": mejor mandar a /activar que
  // dejar pasar a alguien no invitado.
  const { data: esMiembro, error } = await supabase.rpc('is_member')
  const isActivated = !error && esMiembro === true

  if (!isActivated) {
    return enActivar ? supabaseResponse : redirectTo(request, '/activar', supabaseResponse)
  }

  if (enLogin || enActivar) {
    return redirectTo(request, '/', supabaseResponse)
  }

  return supabaseResponse
}
