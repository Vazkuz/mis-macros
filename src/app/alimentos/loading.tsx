import { Bone, CardBones, Loading } from '@/components/Skeleton'

// Alimentos: una sola tarjeta con buscador, chips, contador y filas.
export default function AlimentosLoading() {
  return (
    <Loading>
      <h1 className="text-[26px]">Alimentos</h1>
      <CardBones>
        <Bone className="h-12 w-full" />
        <div className="flex flex-wrap gap-1.5">
          {[64, 96, 48, 64, 80].map((w, i) => (
            <Bone key={i} className="h-10 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <Bone className="h-3 w-36" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-1">
            <div className="flex flex-1 flex-col gap-1.5">
              <Bone className="h-4 w-3/5" />
              <Bone className="h-3 w-4/5" />
            </div>
            <Bone className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </CardBones>
    </Loading>
  )
}
