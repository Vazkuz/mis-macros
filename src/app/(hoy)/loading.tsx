import { Bone, CardBones, Loading, twoCols } from '@/components/Skeleton'

// Hoy: resumen del día + chips de comidas a la izquierda; lista a la derecha.
export default function HoyLoading() {
  return (
    <Loading>
      <div className={twoCols}>
        <div className="flex flex-col gap-3.5">
          <CardBones>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-2">
                <Bone className="h-3 w-20" />
                <Bone className="h-8 w-32" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <Bone className="h-3 w-16" />
                <Bone className="h-6 w-16" />
              </div>
            </div>
            <Bone className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              <Bone className="h-10" />
              <Bone className="h-10" />
              <Bone className="h-10" />
            </div>
          </CardBones>
          <div className="flex gap-2 overflow-hidden min-[900px]:flex-col">
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-11 w-28 shrink-0 min-[900px]:w-full" />
            ))}
          </div>
        </div>
        <CardBones>
          <Bone className="h-5 w-32" />
          <Bone className="h-3 w-48" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Bone className="h-6 w-6 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Bone className="h-4 w-3/5" />
                <Bone className="h-3 w-2/5" />
              </div>
              <Bone className="h-10 w-28 shrink-0" />
            </div>
          ))}
        </CardBones>
      </div>
    </Loading>
  )
}
