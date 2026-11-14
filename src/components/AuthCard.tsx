// Tarjeta centrada para /login y /activar (sin Shell: ni pestañas ni botón
// flotante). Logo igual al de la cabecera del Shell.
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-bold">
          <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true">
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
        </div>
        {children}
      </div>
    </div>
  )
}

// Clases compartidas (mockup: .field input y .btn).
export const inputClass =
  'min-h-12 w-full rounded-xl border border-line-strong bg-card px-3 text-base text-ink placeholder:text-muted focus:outline-3 focus:outline-focus disabled:opacity-60'

export const labelClass = 'text-sm font-semibold'

export const primaryButtonClass =
  'min-h-12 w-full cursor-pointer rounded-xl bg-acc px-[18px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-disabled'
