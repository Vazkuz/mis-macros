import { createClient } from '@/utils/supabase/server'
import { signOut } from '@/app/actions'
import MetaForm, { type MetaProfile } from './MetaForm'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: lastWeight }] = await Promise.all([
    supabase
      .from('profiles')
      .select('sex, birth_date, height_cm, activity, pace, protein_g_per_kg, fat_g_per_kg')
      .eq('id', user?.id ?? '')
      .maybeSingle(),
    supabase
      .from('measurements')
      .select('measured_on, weight_kg')
      .eq('user_id', user?.id ?? '')
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const num = (v: unknown) => (v == null || v === '' ? null : Number(v))

  const initial: MetaProfile = {
    sex: profile?.sex ?? null,
    birthDate: profile?.birth_date ?? null,
    heightCm: num(profile?.height_cm),
    activity: profile?.activity ?? null,
    pace: profile?.pace ?? null,
    proteinPerKg: num(profile?.protein_g_per_kg),
    fatPerKg: num(profile?.fat_g_per_kg),
  }

  const lastMeasurement = lastWeight
    ? { weightKg: Number(lastWeight.weight_kg), measuredOn: lastWeight.measured_on as string }
    : null

  return (
    <>
      <h1 className="text-[26px]">Perfil y meta</h1>

      <MetaForm
        initial={initial}
        lastMeasurement={lastMeasurement}
        footer={
          <section className="mt-2 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
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
        }
      />
    </>
  )
}
