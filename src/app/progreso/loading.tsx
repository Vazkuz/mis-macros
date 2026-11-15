import { Bone, CardBones, Loading, twoCols } from '@/components/Skeleton'

const darkBone = 'animate-pulse rounded-xl bg-ink-line motion-reduce:animate-none'

// Peso y cintura: tarjeta oscura de cintura + Peso y Última medición a la
// izquierda; gráfico e historial a la derecha.
export default function ProgresoLoading() {
  return (
    <Loading>
      <h1 className="text-[26px]">Peso y cintura</h1>
      <div className={twoCols}>
        <div className="flex flex-col gap-3.5">
          <div aria-hidden="true" className="flex flex-col gap-3 rounded-2xl bg-ink p-4">
            <div className={`h-3 w-16 ${darkBone}`} />
            <div className={`h-12 w-32 ${darkBone}`} />
            <div className={`h-2 w-full rounded-full ${darkBone}`} />
            <div className={`h-4 w-full ${darkBone}`} />
            <div className={`h-4 w-full ${darkBone}`} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1].map((i) => (
              <CardBones key={i} className="gap-2 p-3.5">
                <Bone className="h-3 w-16" />
                <Bone className="h-7 w-20" />
                <Bone className="h-3 w-24" />
              </CardBones>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <CardBones>
            <div className="flex gap-1.5">
              <Bone className="h-10 w-20" />
              <Bone className="h-10 w-16" />
            </div>
            <Bone className="h-[190px] w-full" />
          </CardBones>
          <CardBones>
            <Bone className="h-5 w-24" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-8 w-full" />
            ))}
          </CardBones>
        </div>
      </div>
    </Loading>
  )
}
