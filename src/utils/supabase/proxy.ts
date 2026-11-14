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

// Errores transitorios (red, timeout, 5xx de Supabase): la sesión sigue siendo
// válida y supabase-js NO la borra. Tratarlos como "sin sesión" mandaba a
// /login a alguien con sesión buena; se reintenta una vez antes.
function isTransientError(error: unknown) {
  const e = error as { name?: string; status?: number } | null
  return (
    e?.name === 'AuthRetryableFetchError' ||
    (typeof e?.status === 'number' && (e.status === 0 || e.status >= 500)) ||
    (error instanceof TypeError && /fetch/i.test(error.message))
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function getUserWithRetry(supabase: ReturnType<typeof createServerClient>) {
  let lastError: unknown = null
  for (let intento = 0; intento < 2; intento++) {
    try {
      const { data, error } = await supabase.auth.getUser()
      // Nunca hay que confiar en data.user cuando error viene presente.
      if (!error) return { user: data.user, error: null }
      lastError = error
    } catch (err) {
      lastError = err
    }
    if (!isClockSkewError(lastError) && !isTransientError(lastError)) break
    await wait(500)
  }
  return { user: null, error: lastError }
}

function redirectTo(request: NextRequest, pathname: string, base: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const response = NextResponse.redirect(url)
  // Las cookies de sesión recién refrescadas (y los headers no-cache) tienen
  // que viajar también en la redirección; si no, el navegador se queda con
  // un refresh token que Supabase ya rotó y la sesión muere en el siguiente
  // refresco.
  base.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  copyCacheHeaders(base, response)
  return response
}

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma']

function copyCacheHeaders(from: NextResponse, to: NextResponse) {
  CACHE_HEADERS.forEach((h) => {
    const v = from.headers.get(h)
    if (v) to.headers.set(h, v)
  })
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
        // Patrón oficial de @supabase/ssr 0.12: escribir en el request (para
        // los Server Components de este mismo request) y en la respuesta, y
        // aplicar los headers no-cache que manda la librería (solo los manda
        // en la primera escritura).
        //
        // Diferencia con el patrón literal: setAll puede llamarse más de una
        // vez por request, y la librería deduplica contra getAll() (que ya
        // refleja la escritura anterior). Si cada llamada creara una respuesta
        // nueva desde cero, las cookies de la llamada anterior se perderían;
        // por eso se arrastran las cookies y headers ya puestos.
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const previa = supabaseResponse
          supabaseResponse = NextResponse.next({ request })
          previa.cookies.getAll().forEach((cookie) => supabaseResponse.cookies.set(cookie))
          copyCacheHeaders(previa, supabaseResponse)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Se mira antes de getUser(): si la sesión es inválida, setAll borra las
  // cookies del request.
  const teniaSesion = request.cookies
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value)

  // getUser() (no getSession) valida el token contra Supabase y, si expiró,
  // lo refresca y dispara setAll. Va antes de cualquier redirección.
  const { user, error: authError } = await getUserWithRetry(supabase)
  const path = request.nextUrl.pathname

  // Diagnóstico: había cookie de sesión pero Supabase la rechazó. Sale en los
  // logs de Vercel (Functions → proxy) con el motivo exacto.
  if (!user && teniaSesion) {
    const e = authError as { name?: string; code?: string; status?: number; message?: string } | null
    console.warn('[proxy] sesión rechazada', {
      path,
      name: e?.name,
      code: e?.code,
      status: e?.status,
      message: e?.message,
    })
  }

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
