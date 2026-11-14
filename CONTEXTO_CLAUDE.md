# Mis Macros — contexto del proyecto (léelo siempre)

## Objetivo

App web personal para registrar **comidas y macros** (proteína, carbohidratos, grasa, kcal), **peso** y **cintura**, y compararlos contra una meta. Mobile-first y responsive para laptop.

## Stack

Mismo stack que Mis Gastos (`C:\Users\canad\mis-gastos`):

- Next.js 16 (App Router, TypeScript, carpeta `src/`) + React 19
- Tailwind 4 (tokens en `@theme` dentro de `src/app/globals.css`)
- vaul ^1.1.2 (bottom sheets) + lucide-react (íconos)
- Supabase: `@supabase/supabase-js` + `@supabase/ssr`
- Deploy en Vercel
- Fuentes con `next/font`: Inter (texto, `font-sans`) y Space Grotesk (títulos y números, `font-display` / clase `.num`)

## Rutas

| Ruta | Pestaña | Botón flotante |
|---|---|---|
| `/` | Hoy | + Utensils ("Agregar comida") → abre `/agregar` |
| `/progreso` | Peso y cintura | + Ruler ("Nueva medición") |
| `/alimentos` | Alimentos | + Apple ("Nuevo alimento") |
| `/meta` | Meta | sin botón |
| `/agregar?meal=…&d=…` | (pantalla completa, sin Shell) | — |

El layout vive en `src/components/Shell.tsx`: cabecera con el logo "Mis Macros" (lleva a Hoy), barra de pestañas inferior en móvil que pasa a riel lateral desde 900px, y botón flotante contextual. `/login`, `/activar`, `/privacidad` y `/agregar` se pintan sin Shell.

`/agregar` reemplaza al sheet de agregar: columna con la altura visible (Android: `interactiveWidget: 'resizes-content'` en el viewport raíz; iOS: sigue a `visualViewport`), cabecera fija y solo la lista se desplaza. La lógica optimista de registros vive en `src/lib/useFoodLogs.ts` (la usan Hoy y /agregar).

## Archivos clave

- `src/components/BottomSheet.tsx` — copiado tal cual de Mis Gastos.
- `src/lib/bodyScrollLock.ts` (`useLockBodyScroll`) y `src/lib/centerDialogLayer.ts` — copiados tal cual de Mis Gastos (BottomSheet depende de ambos).
- `src/utils/supabase/client.ts` y `server.ts` — clientes browser/server con `@supabase/ssr`.

## Auth e invitaciones

**Login solo con Google** (Supabase Auth, provider `google`). No hay correo/contraseña. La app es **solo por invitación**: el perfil (`profiles`) **solo se crea al canjear un código** con la RPC `redeem_invite(p_code)`. Esquema en Supabase: tablas `profiles`, `invite_codes`, `admins`; funciones `redeem_invite(p_code text)`, `is_member()`, `is_admin()`.

Flujo:

1. `/login` (`src/app/login/page.tsx` + `GoogleButton.tsx`): tarjeta con el logo y un único botón "Continuar con Google" → `signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } })`.
   `/auth/callback` (`src/app/auth/callback/route.ts`) hace `exchangeCodeForSession(code)` y redirige a `/` (el proxy desvía a `/activar` si no hay perfil). Si falla → `/login?error=auth`, que muestra "No se pudo iniciar sesión con Google. Inténtalo de nuevo."
   **En Supabase (Authentication → URL Configuration → Redirect URLs) tiene que estar la URL del callback por cada dominio** donde corra la app: `http://localhost:3000/auth/callback`, la de producción en Vercel y, si se usan, las de preview. Si falta, Supabase redirige al Site URL y el login no vuelve a la app.
2. `/activar` (`src/app/activar/page.tsx`): pide el código y llama a la server action `redeemInviteCode` (`src/app/actions.ts`) → `rpc('redeem_invite', { p_code })`. Si falla: "Código inválido o ya usado". Si sale bien: `redirect('/')`.
3. `src/proxy.ts` → `updateSession` (`src/utils/supabase/proxy.ts`) en cada request: refresca la sesión y redirige.
   - sin sesión (o `getUser` con error) → `/login`
   - con sesión y `is_member()` ≠ true → `/activar`
   - con sesión y perfil en `/login` o `/activar` → `/`
   - `/auth/callback` y `/privacidad` (pública, enlazada desde `/login`) pasan siempre. El matcher excluye `_next/static`, `_next/image` y archivos estáticos.
4. `isAdmin()` (`src/lib/auth.ts`, solo servidor) → `rpc('is_admin')`. Para mostrar el + y "Editar" de Alimentos solo al admin. La seguridad real la ponen las policies.
5. `signOut` (server action) → botón "Cerrar sesión" al final de `/meta` (con el correo del usuario) y en `/activar`.

`/login` y `/activar` se pintan sin Shell (sin cabecera, pestañas ni botón flotante), con `src/components/AuthCard.tsx`.

**Ojo:** `proxy.ts` va en `src/`, no en la raíz. En la raíz compila y nunca se ejecuta, sin aviso.

## Reglas

- **BottomSheet único sobre vaul.** Todo bottom sheet de la app usa `src/components/BottomSheet.tsx`. No se usa vaul directo ni otra librería. Si mañana se cambia de librería, solo se toca ese archivo.
- **`redirect()` siempre fuera de cualquier `try/catch`.** Internamente lanza; dentro de un try se traga como si fuera un error. En el cliente, si se llama a una action que redirige dentro de un try, usar `unstable_rethrow(err)` al inicio del catch.
- **Todos los hooks van antes de cualquier `return null`** (o cualquier return temprano). Un return antes de un hook rompe el orden de hooks de React.
- **`.env.local` nunca se sube.** Está en `.gitignore`. La plantilla es `.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- **El SQL se corre a mano en el SQL Editor de Supabase.** Nada de migraciones automáticas desde la app ni desde Code: el SQL se escribe en el repo y Daniel lo ejecuta en el panel.
- **Textos de la interfaz en español peruano, con tuteo.** Nunca voseo ("puedes", no "podés"; "elige", no "elegí"). Aplica a labels, placeholders, ayudas, errores, toasts y confirmaciones.
- Colores siempre con los tokens de `@theme` (`bg-acc`, `text-muted`, `border-line`, `text-prot`, etc.), no hex sueltos.

## Referencia visual

`docs/mockup.html` es la **referencia visual exacta** (colores, tamaños, espaciados, íconos y comportamiento). Ábrelo en el navegador antes de construir una pantalla y tradúcelo 1:1 a componentes + Tailwind.
