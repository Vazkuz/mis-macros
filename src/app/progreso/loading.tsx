import { Bone, CardBones, Loading, twoCols } from '@/components/Skeleton'

// Peso y cintura: 4 KPIs a la izquierda; gráfico e historial a la derecha.
export default function ProgresoLoading() {
  return (
    <Loading>
      <h1 className="text-[26px]">Peso y cintura</h1>
      <div className={twoCols}>
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-[84px]" />
          ))}
        </div>
        <div className="flex flex-col gap-3.5">
          <CardBones>
            <Bone className="h-5 w-24" />
            <Bone className="aspect-[9/5] w-full" />
          </CardBones>
          <CardBones>
            <Bone className="h-5 w-24" />
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-8 w-full" />
            ))}
          </CardBones>
        </div>
      </div>
    </Loading>
  )
}
