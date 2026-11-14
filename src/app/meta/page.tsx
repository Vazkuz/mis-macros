import { createClient } from '@/utils/supabase/server'
import { signOut } from '@/app/actions'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <h1 className="text-[26px]">Perfil y meta</h1>

      <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">Sesión iniciada como</span>
          <span className="text-[15px] font-semibold break-all">{user?.email}</span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-12 w-full cursor-pointer rounded-xl border border-line-strong bg-card px-[18px] text-[15px] font-semibold text-danger"
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  )
}
