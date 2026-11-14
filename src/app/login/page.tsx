import Link from 'next/link'
import AuthCard from '@/components/AuthCard'
import GoogleButton from './GoogleButton'

// Login solo con Google. /auth/callback redirige aquí con ?error=auth si el
// canje del code falla.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <AuthCard>
      <p className="mb-5 text-center text-sm text-muted">
        Registra tus comidas, macros, peso y cintura.
      </p>
      <GoogleButton errorInicial={error === 'auth'} />
      <div className="mt-5 text-center">
        <Link
          href="/privacidad"
          className="inline-flex min-h-9 items-center rounded-lg px-1.5 text-xs text-muted hover:text-ink"
        >
          Privacidad
        </Link>
      </div>
    </AuthCard>
  )
}
