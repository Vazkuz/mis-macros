'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Apple, Plus, Ruler, Utensils, type LucideIcon } from 'lucide-react'

type Tab = {
  href: string
  label: string
  icon: React.ReactNode
  fab?: { label: string; icon: LucideIcon }
}

const svgProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  'aria-hidden': true,
}

// Íconos de pestañas copiados del mockup (docs/mockup.html).
const TABS: Tab[] = [
  {
    href: '/',
    label: 'Hoy',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 7.6 10.5" />
      </svg>
    ),
    fab: { label: 'Agregar comida', icon: Utensils },
  },
  {
    href: '/progreso',
    label: 'Peso y cintura',
    icon: (
      <svg {...svgProps}>
        <path d="M4 19h16M6 15l4-4 3 3 5-6" />
      </svg>
    ),
    fab: { label: 'Nueva medición', icon: Ruler },
  },
  {
    href: '/alimentos',
    label: 'Alimentos',
    icon: (
      <svg {...svgProps}>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    ),
    fab: { label: 'Nuevo alimento', icon: Apple },
  },
  {
    href: '/meta',
    label: 'Meta',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.5" />
      </svg>
    ),
  },
]

// Pantallas sin cabecera, pestañas ni botón flotante.
const BARE_ROUTES = ['/login', '/activar', '/privacidad']

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const current = TABS.find((t) => isActive(pathname, t.href))
  const fab = current?.fab

  // /login, /activar y /privacidad van sin cabecera, pestañas ni botón flotante.
  // (Este return va después de todos los hooks.)
  if (BARE_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>
  }

  return (
    <div className="min-[900px]:pl-[104px]">
      <div className="mx-auto min-h-screen max-w-[520px] pb-[calc(84px+env(safe-area-inset-bottom))] min-[900px]:max-w-[1180px] min-[900px]:pb-8">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-card px-4 py-2.5">
          <Link
            href="/"
            aria-label="Mis Macros, ir a Hoy"
            className="flex min-h-11 items-center gap-2 text-lg font-bold"
          >
            <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="11" fill="none" className="stroke-line" strokeWidth="4" />
              <path
                d="M14 3 A11 11 0 0 1 24.5 17.5"
                fill="none"
                className="stroke-acc"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <span className="num">Mis Macros</span>
          </Link>
        </header>

        <main className="flex flex-col gap-3.5 p-4 pb-24 min-[900px]:px-6 min-[900px]:pt-6 min-[900px]:pb-[104px]">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] min-[900px]:top-0 min-[900px]:right-auto min-[900px]:w-[104px] min-[900px]:border-t-0 min-[900px]:border-r">
        <nav
          aria-label="Principal"
          className="mx-auto grid max-w-[560px] grid-cols-4 min-[900px]:auto-rows-min min-[900px]:grid-cols-1 min-[900px]:gap-1 min-[900px]:px-2 min-[900px]:pt-[84px]"
        >
          {TABS.map((tab) => {
            const active = tab === current
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-center text-xs font-semibold min-[900px]:min-h-[72px] min-[900px]:rounded-xl ${
                  active ? 'text-acc min-[900px]:bg-acc-soft' : 'text-muted'
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {fab && (
        <button
          type="button"
          aria-label={fab.label}
          className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[35] inline-flex h-14 cursor-pointer items-center gap-0.5 rounded-[18px] bg-acc px-4 text-white shadow-[0_10px_24px_-8px_rgba(22,32,26,.55)] min-[900px]:right-6 min-[900px]:bottom-6"
        >
          <Plus size={20} strokeWidth={2.75} aria-hidden="true" />
          <fab.icon size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
