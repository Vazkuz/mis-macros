'use client'

import { useState, type FormEvent } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { redeemInviteCode, signOut } from '@/app/actions'
import AuthCard, { inputClass, labelClass, primaryButtonClass } from '@/components/AuthCard'

export default function ActivarPage() {
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = codigo.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    try {
      // Si el código es válido, la action termina en redirect('/'): llega aquí
      // como señal de navegación, no como error, y unstable_rethrow la deja
      // pasar. Si el canje falla, la action no lanza: devuelve { error }.
      const resultado = await redeemInviteCode(trimmed)
      if (resultado?.error) {
        setError(resultado.error)
        setLoading(false)
      }
    } catch (err) {
      unstable_rethrow(err)
      setError('Código inválido o ya usado')
      setLoading(false)
    }
  }

  return (
    <AuthCard>
      <p className="mb-4 text-center text-sm text-muted">
        Mis Macros es solo por invitación. Ingresa tu código para activar tu cuenta.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo" className={labelClass}>
            Código de invitación
          </label>
          <input
            id="codigo"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={loading}
            autoFocus
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !codigo.trim()}
          className={`mt-1 ${primaryButtonClass}`}
        >
          {loading ? 'Activando…' : 'Activar cuenta'}
        </button>
      </form>

      <form action={signOut} className="mt-5 text-center">
        <button
          type="submit"
          className="min-h-9 cursor-pointer rounded-lg px-1.5 text-[13px] font-semibold text-muted hover:bg-acc-soft"
        >
          Cerrar sesión
        </button>
      </form>
    </AuthCard>
  )
}
