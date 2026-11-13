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
| `/` | Hoy | + Utensils ("Agregar comida") |
| `/progreso` | Peso y cintura | + Ruler ("Nueva medición") |
| `/alimentos` | Alimentos | + Apple ("Nuevo alimento") |
| `/meta` | Meta | sin botón |

El layout vive en `src/components/Shell.tsx`: cabecera con el logo "Mis Macros" (lleva a Hoy), barra de pestañas inferior en móvil que pasa a riel lateral desde 900px, y botón flotante contextual.

## Archivos clave

- `src/components/BottomSheet.tsx` — copiado tal cual de Mis Gastos.
- `src/lib/bodyScrollLock.ts` (`useLockBodyScroll`) y `src/lib/centerDialogLayer.ts` — copiados tal cual de Mis Gastos (BottomSheet depende de ambos).
- `src/utils/supabase/client.ts` y `server.ts` — clientes browser/server con `@supabase/ssr`.

## Reglas

- **BottomSheet único sobre vaul.** Todo bottom sheet de la app usa `src/components/BottomSheet.tsx`. No se usa vaul directo ni otra librería. Si mañana se cambia de librería, solo se toca ese archivo.
- **Todos los hooks van antes de cualquier `return null`** (o cualquier return temprano). Un return antes de un hook rompe el orden de hooks de React.
- **`.env.local` nunca se sube.** Está en `.gitignore`. La plantilla es `.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **El SQL se corre a mano en el SQL Editor de Supabase.** Nada de migraciones automáticas desde la app ni desde Code: el SQL se escribe en el repo y Daniel lo ejecuta en el panel.
- **Textos de la interfaz en español peruano, con tuteo.** Nunca voseo ("puedes", no "podés"; "elige", no "elegí"). Aplica a labels, placeholders, ayudas, errores, toasts y confirmaciones.
- Colores siempre con los tokens de `@theme` (`bg-acc`, `text-muted`, `border-line`, `text-prot`, etc.), no hex sueltos.

## Referencia visual

`docs/mockup.html` es la **referencia visual exacta** (colores, tamaños, espaciados, íconos y comportamiento). Ábrelo en el navegador antes de construir una pantalla y tradúcelo 1:1 a componentes + Tailwind.
