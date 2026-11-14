'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import AuthCard, { inputClass, labelClass, primaryButtonClass } from '@/components/AuthCard'

type Modo = 'ingresar' | 'crear'

const MIN_PASSWORD = 8

function mensajeDeError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Correo o contraseña incorrectos.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Este correo ya está registrado. Ingresa con tu contraseña.'
    case 'weak_password':
      return `La contraseña es muy débil. Usa al menos ${MIN_PASSWORD} caracteres.`
    case 'email_not_confirmed':
      return 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.'
    case 'validation_failed':
    case 'email_address_invalid':
      return 'Revisa que el correo esté bien escrito.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
    default:
      return 'No se pudo completar. Inténtalo de nuevo.'
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('ingresar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo)
    setError(null)
    setAviso(null)
    setPassword('')
    setPassword2('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    const correo = email.trim()
    if (!correo || !password) return

    if (modo === 'crear') {
      if (password.length < MIN_PASSWORD) {
        setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
        return
      }
      if (password !== password2) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    setLoading(true)
    const supabase = createClient()

    if (modo === 'ingresar') {
      const { error } = await supabase.auth.signInWithPassword({ email: correo, password })
      if (error) {
        setError(mensajeDeError(error))
        setLoading(false)
        return
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setError(mensajeDeError(error))
        setLoading(false)
        return
      }
      // Con "Confirm email" activo, Supabase no devuelve error si el correo ya
      // existe (para no revelar cuentas): devuelve un usuario sin identidades.
      if (data.user && data.user.identities?.length === 0) {
        setError(mensajeDeError({ code: 'user_already_exists' } as AuthError))
        setLoading(false)
        return
      }
      if (!data.session) {
        setAviso('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego vuelve aquí.')
        setLoading(false)
        return
      }
    }

    // El proxy decide el destino: /activar si aún no canjeó un código, / si ya.
    router.replace('/')
    router.refresh()
  }

  const tabClass = (activo: boolean) =>
    `min-h-11 flex-1 cursor-pointer rounded-[10px] text-sm font-semibold ${
      activo ? 'bg-card text-acc shadow-sm' : 'text-muted'
    }`

  return (
    <AuthCard>
      <div role="tablist" aria-label="Acceso" className="mb-5 flex gap-1 rounded-xl bg-bg p-1">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'ingresar'}
          onClick={() => cambiarModo('ingresar')}
          className={tabClass(modo === 'ingresar')}
        >
          Ingresar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'crear'}
          onClick={() => cambiarModo('crear')}
          className={tabClass(modo === 'crear')}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelClass}>
            Correo
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
            placeholder={modo === 'crear' ? `Mínimo ${MIN_PASSWORD} caracteres` : ''}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className={inputClass}
          />
        </div>

        {modo === 'crear' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password2" className={labelClass}>
              Repite tu contraseña
            </label>
            <input
              id="password2"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              disabled={loading}
              required
              className={inputClass}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {aviso && (
          <p role="status" className="rounded-xl bg-acc-soft p-3 text-sm text-acc">
            {aviso}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password || (modo === 'crear' && !password2)}
          className={`mt-1 ${primaryButtonClass}`}
        >
          {loading
            ? modo === 'crear'
              ? 'Creando cuenta…'
              : 'Ingresando…'
            : modo === 'crear'
              ? 'Crear cuenta'
              : 'Ingresar'}
        </button>
      </form>
    </AuthCard>
  )
}
