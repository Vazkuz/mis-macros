import { Bone, CardBones, Loading, twoCols } from '@/components/Skeleton'

const darkBone = 'animate-pulse rounded-xl bg-ink-line motion-reduce:animate-none'

// Meta: tarjeta oscura de resultado a la izquierda; ajustes a la derecha.
export default function MetaLoading() {
  return (
    <Loading>
      <h1 className="text-[26px]">Perfil y meta</h1>
      <div className={twoCols}>
        <div aria-hidden="true" className="flex flex-col gap-3 rounded-2xl bg-ink p-4">
          <div className={`h-3 w-24 ${darkBone}`} />
          <div className={`h-12 w-40 ${darkBone}`} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`h-4 w-full ${darkBone}`} />
          ))}
        </div>
        <div className="flex flex-col gap-3.5">
          <CardBones>
            <Bone className="h-5 w-28" />
            <div className="flex gap-2">
              <Bone className="h-11 w-24 rounded-full" />
              <Bone className="h-11 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Bone className="h-12" />
              <Bone className="h-12" />
            </div>
            <Bone className="h-12 w-full" />
          </CardBones>
          <CardBones>
            <Bone className="h-5 w-40" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-14 w-full" />
            ))}
          </CardBones>
          <CardBones>
            <Bone className="h-5 w-24" />
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-12 w-full" />
            ))}
          </CardBones>
        </div>
      </div>
    </Loading>
  )
}
