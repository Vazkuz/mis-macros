'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

const ERROR_GOOGLE = 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'

export default function GoogleButton({ errorInicial }: { errorInicial: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(errorInicial ? ERROR_GOOGLE : null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    // Si sale bien, el navegador ya se está yendo a Google: no se toca el estado.
    if (error) {
      console.error('signInWithOAuth devolvió error:', error)
      setError(ERROR_GOOGLE)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-card px-[18px] text-[15px] font-semibold text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? 'Conectando…' : 'Continuar con Google'}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </>
  )
}
