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
| `/agregar?meal=…&d=…[&sel=dish:<id>]` | (pantalla completa, sin Shell) | — |
| `/platos/nuevo?meal=…&d=…` y `/platos/[id][?back=/agregar…]` | (pantalla completa, sin Shell) | — |
| `/comida/[logId]` | (pantalla completa, sin Shell) | — |

El layout vive en `src/components/Shell.tsx`: cabecera con el logo "Mis Macros" (lleva a Hoy), barra de pestañas inferior en móvil que pasa a riel lateral desde 900px, y botón flotante contextual. `/login`, `/activar`, `/privacidad`, `/agregar`, `/platos` y `/comida` se pintan sin Shell (`BARE_ROUTES`).

`/agregar` reemplaza al sheet de agregar: columna con la altura visible (Android: `interactiveWidget: 'resizes-content'` en el viewport raíz; iOS: sigue a `visualViewport`), cabecera fija y solo la lista se desplaza. La lógica optimista de registros vive en `src/lib/useFoodLogs.ts` (la usan Hoy y /agregar).

**Destacados por usuario.** Tabla `user_favorite_foods(user_id default auth.uid(), food_id → foods on delete cascade, created_at, pk(user_id, food_id))`, RLS: cada uno ve, crea y borra solo los suyos. **`foods.featured` está en desuso**: la columna sigue en la base pero no se lee ni se escribe en ningún lado (ni orden, ni filtros, ni formulario del admin). El hook `src/lib/useFavorites.ts` carga el Set de `food_id` una vez por sesión de página (caché de módulo como `useFoods`, se recarga si cambia el usuario) y expone `favorites`, `isFavorite(id)` y `toggleFavorite(id, name)`: optimista, con toast "<nombre> agregado a / quitado de destacados" + "Deshacer"; si falla, revierte y avisa. La estrella es `src/components/FavoriteStar.tsx` (rellena en ámbar `text-carb` / contorno `text-star-off`, 36px, no propaga el clic). `useFoodSearch(foods, query, { filter, favorites, limit })` ordena destacados primero y luego el resto, alfabético dentro de cada grupo; `filter: 'destacados'` busca solo dentro de ellos. **Orden estable:** el orden y ese filtro usan una foto de los favoritos tomada al montar, al cambiar la búsqueda o el filtro, y cuando terminan de cargar (`favoritesReady`); alternar una estrella no mueve la fila ni la saca de la lista (la estrella sí cambia en vivo; el contador "Tus destacados · N" también). `Toast` acepta una acción opcional (`toast.show(texto, { label, onClick })`, dura 4 s).

En `/agregar`, a la derecha del buscador va el filtro ★ "Destacados" (recordado en localStorage, apagado por defecto): encendido lista TODOS los destacados aunque el buscador esté vacío, con "Tus destacados · N" encima. Cada resultado y cada fila de `/alimentos` tienen su estrella; el chip "Destacados" de `/alimentos` usa los destacados personales.

**Filas de Hoy** (`LogRow` en `HoyView.tsx`): círculo comido/planificado | nombre y debajo "150 g · 195 kcal" ("1 unidad" / "2 unidades" si `basis='unit'`) | Pencil, Star y Trash2 grises en un bloque de ancho fijo (108px; si `food_id` es null, la estrella deja su hueco). Tocar la fila despliega 3 pastillas Proteína/Carbos/Grasa (gramos enteros, `bg-prot-bg`/`bg-carb-bg`/`bg-fat-bg`), una fila abierta a la vez. El lápiz vuelve la cantidad un input de 16px con ✓ verde (Enter/✓ guarda con `changeQty`; Escape o tocar fuera cancela; las kcal se recalculan en vivo).

## Platos propios

**Tablas** (solo las ve su dueño):
- `dishes(id, user_id default auth.uid(), name, favorite bool default true, created_at, updated_at)`. `favorite` es la estrella del plato (no usa `user_favorite_foods`).
- `dish_items(id, dish_id → dishes cascade, food_id → foods cascade, quantity > 0, position)`: ingredientes de 1 porción, en la unidad del sistema (g, mL o unidades).
- `food_logs.dish_id → dishes on delete set null`. Un registro de plato tiene `food_id` null, `dish_id` = el plato, `food_name` = nombre del plato y `quantity` = porciones.
- `food_log_items(id, log_id → food_logs cascade, food_id, food_name, quantity, position, protein, carbs, fat)`: copia de los ingredientes de ESE registro. Un trigger copia los macros de cada ingrediente y otro recalcula protein/carbs/fat del `food_log` padre como la suma. **El cliente nunca guarda esos totales** (solo los calcula para mostrar).

**RPCs** (`supabase.rpc`):
- `save_dish(p_id|null, p_name, p_items [{food_id, quantity}])` → id. Crea o reemplaza nombre e ingredientes.
- `add_dish_to_log(p_dish_id, p_log_date, p_meal, p_portions, p_eaten)` → id del log (copia ingredientes × porciones). Se llama con `p_eaten: true`, igual que un alimento agregado.
- `set_log_items(p_log_id, p_items)`: reemplaza los ingredientes de ese registro.
- Borrar un plato = `delete` en `dishes`; los registros ya hechos no cambian.

**Código:**
- `src/lib/dishes.ts`: tipos `Dish`/`DishItem` (macros del alimento POR BASE para calcular en vivo), `DISH_SELECT`/`toDish`, `itemsTotals` (kcal = 4P+4C+9G), `itemsLine`, `portionsLabel`, `defaultQty` (1 unidad, 100 mL o 5 g).
- `src/lib/useDishes.ts`: caché compartida como `useFavorites` → `dishes`, `dishById`, `toggleDishFavorite` (optimista, toast con "Deshacer"), `deleteDish` (optimista) y `saveDish` (RPC; actualiza la caché al terminar).
- `src/lib/useCatalogSearch.ts`: busca alimentos y platos juntos. Orden: platos destacados, alimentos destacados, platos y alimentos (alfabético en cada grupo), con la misma regla de orden estable (foto de destacados). La usan `/agregar` y `/alimentos`; `useFoodSearch` queda para buscar solo alimentos (editor de ingredientes).
- `src/lib/loadLogs.ts`: `loadLogs` y `loadLogById` traen además los `food_log_items` (por position) con `basis`/`unit_label` de cada alimento (`attachItems`). `FoodLog` tiene `dish_id` e `items`; `isDishLog(l)` = `dish_id` no null o con ingredientes; `logAmount(l)` da "150 g", "1 unidad", "Plato" o "1.5 porciones".
- Actions: `addDishLog` (RPC + devuelve la fila con ingredientes) y `setLogItems` (RPC + `revalidatePath('/')`).
- `src/components/DishEditor.tsx`: editor a pantalla completa (mismo patrón que /agregar, con `useVisibleViewportStyle` de `src/lib/useVisualViewport.ts`). Lo usan `src/app/platos/PlatoEditor.tsx` (nuevo/editar, con nombre) y `src/app/comida/[logId]/ComidaEditor.tsx` (sin nombre, "Total en esta comida" y la casilla "Guardar también en el plato", que hace `save_dish` con ingredientes ÷ porciones).
- `flashToast(texto)` (en `Toast.tsx`): deja un aviso que muestra la pantalla a la que se navega (p. ej. "Plato actualizado").

**Pantallas:** en `/agregar`, botón Utensils "Platos" junto a ★ (localStorage; con ★ = platos destacados), fila "+ Crear plato propio" siempre arriba de la lista, filas de plato con lápiz, estrella y tacho (`ConfirmDialog`; las de alimento dejan los huecos del lápiz y del tacho) y tarjeta de selección con porciones; `?sel=dish:<id>` deja el plato ya elegido y `?q=` restaura la búsqueda. El lápiz abre `/platos/[id]?back=/agregar?meal&d&q[&sel]`: guardar, borrar o ← vuelven ahí con `router.replace` (solo se acepta un `back` que empiece por `/agregar`). En Hoy, una fila de plato lleva Utensils, "Plato · kcal" o "1.5 porciones · kcal"; el panel suma la lista de ingredientes y "Editar ingredientes"; el lápiz y ese botón van a `/comida/[logId]`, que al guardar vuelve a Hoy con `?open=<logId>` (fila desplegada). En `/alimentos`, chip "Tus platos" y filas de plato (todos los usuarios) que abren `/platos/[id]`.

`/progreso` (Peso y cintura): `page.tsx` carga `profiles.height_cm` y `profiles.weight_goal_kg` (meta de peso opcional, 30–250, null = sin meta) y todas las `measurements` (una fila por día, `unique(user_id, measured_on)`, con peso y/o cintura) y las pasa a `ProgresoView.tsx`. **Selector global** "Peso" | "Cintura" debajo del título y encima de las dos columnas (por defecto Peso, no se recuerda): cambia a la vez la tarjeta oscura, la tarjeta chica y el gráfico; "Última medición" no cambia. **Tarjeta oscura** (`DarkCard`: etiqueta, valor, barra, fila de meta, separador y 2 filas `Row`; lo que falta queda `invisible`, no se quita). Las dos variantes se pintan superpuestas en la misma celda de un grid (`Swap`) con la inactiva `invisible` + `inert`, así miden siempre lo mismo y el gráfico no salta; igual la tarjeta chica. Modo Peso: barra de avance del PRIMER peso a la meta (sirve para subir o bajar; `summarize(ms, height, weightGoal)` da `weightProgress`/`weightGoalReached`), "Meta 68 kg / Te faltan 2.5 kg" o "Llegaste a tu meta"; sin meta, la barra queda oculta y la fila dice "Estás en tu rango saludable" (menta) o "Te faltan X kg para tu rango saludable"; filas IMC (menta si 18.5–24.9 con 1 decimal, ámbar si no) y "Rango saludable 53.5 – 72 kg" (`healthyWeightRange`: IMC 18.5–24.9 × h², 1 decimal). Modo Cintura: meta = talla × 0.5 redondeada a 0.5 cm, avance desde la primera cintura, cintura/altura en ámbar ≥ 0.50 y menta < 0.50, y fila "Rango saludable < 85 cm". La tarjeta chica muestra la otra métrica (Cintura con "Cint./altura · delta" o Peso con "IMC · delta"). **Gráfico** SVG hecho a mano (`TrendChart.tsx`, eje X proporcional a la fecha): franja saludable `band` (`fill-acc-soft`, etiqueta `fill-acc` arriba a la derecha, recortada al rango Y visible; Peso "IMC saludable" de 18.5·h² a 24.9·h², Cintura "Saludable" por debajo de talla × 0.5), línea de meta punteada (cintura siempre, peso solo con meta) y `extent` para forzar valores en el eje Y (en Peso, el borde superior de la franja; el inferior no se fuerza). Sin talla: no hay franja, IMC ni rangos, y queda el aviso para agregarla en Meta. Debajo, Historial (tocar una fila edita). `MeasurementSheet.tsx`: nueva (completa la fila del día sin borrar lo que ya había) o editar (valores tal cual; "Ya hay una medición ese día" si la fecha choca) + Eliminar con `ConfirmDialog`. Guardar y eliminar son optimistas; las actions (`saveMeasurement`, `updateMeasurement`, `deleteMeasurement`) hacen `revalidatePath` de `/meta` y `/` porque ambas calculan la meta con **el último peso que tenga `weight_kg`** (`loadProfileAndWeight` en `src/lib/profile.ts`). Helpers puros en `src/lib/progreso.ts`.

`/meta`: en "Tus datos", debajo del peso, el campo opcional "Peso meta (kg)" (texto con `inputMode="decimal"`, acepta coma, 30–250 o vacío = null) con la ayuda "Opcional. Tu rango saludable es 53.5–72 kg." calculada en vivo con la talla del formulario. Entra en la detección de cambios; `saveMeta` lo guarda en `profiles.weight_goal_kg` y revalida `/progreso`.

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
