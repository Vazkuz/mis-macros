import type { Metadata } from 'next'
import Link from 'next/link'
import AuthCard from '@/components/AuthCard'

// Página pública: el proxy la deja pasar sin sesión y el Shell la pinta sin
// cabecera, pestañas ni botón flotante.

export const metadata: Metadata = {
  title: 'Privacidad · Mis Macros',
}

const CORREO = 'dmadalenb@gmail.com'

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-base">{titulo}</h2>
      {children}
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <AuthCard wide>
      <div className="flex flex-col gap-5 text-[15px] leading-relaxed">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px]">Política de privacidad</h1>
          <p className="text-sm text-muted">Última actualización: 14/11/2026</p>
        </div>

        <Seccion titulo="Qué datos guardamos">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              El correo y el nombre de tu cuenta de Google, solo para identificarte.
            </li>
            <li>
              Lo que registras en la app: tus comidas, tu peso, tu cintura y los datos de tu
              perfil que usamos para calcular tu meta.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <p>
            Solo para que la app funcione. No vendemos ni compartimos tus datos con terceros y
            no usamos publicidad.
          </p>
        </Seccion>

        <Seccion titulo="Dónde se guardan">
          <p>
            Tus datos se guardan en Supabase, que es nuestra base de datos. La app corre en
            Vercel.
          </p>
        </Seccion>

        <Seccion titulo="Cómo borrar tu cuenta y tus datos">
          <p>
            Escríbenos a{' '}
            <a href={`mailto:${CORREO}`} className="font-semibold text-acc underline">
              {CORREO}
            </a>{' '}
            y borraremos tu cuenta y todos tus datos.
          </p>
        </Seccion>

        <Link
          href="/"
          className="mt-1 inline-flex min-h-9 items-center self-center rounded-lg px-1.5 text-[13px] font-semibold text-acc hover:bg-acc-soft"
        >
          Volver a Mis Macros
        </Link>
      </div>
    </AuthCard>
  )
}
