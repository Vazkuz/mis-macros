import MacroDonut from '@/components/MacroDonut'

// Tarjeta centrada para /login, /activar y /privacidad (sin Shell: ni
// pestañas ni botón flotante). Logo igual al de la cabecera del Shell.
// `wide` da más ancho para páginas de texto como /privacidad.
export default function AuthCard({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div
        className={`w-full rounded-2xl border border-line bg-card p-6 ${wide ? 'max-w-xl' : 'max-w-sm'}`}
      >
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-bold">
          <MacroDonut size={30} />
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
