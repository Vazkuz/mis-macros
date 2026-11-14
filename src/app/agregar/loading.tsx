import { Bone, Loading } from '@/components/Skeleton'

// /agregar: cabecera (título, chips, buscador) y filas.
export default function AgregarLoading() {
  return (
    <Loading>
      <div className="fixed inset-x-0 top-0 mx-auto flex h-dvh max-w-[760px] flex-col bg-bg">
        <div className="flex flex-none flex-col gap-2.5 border-b border-line bg-card px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3">
          <div className="flex h-11 items-center gap-3">
            <Bone className="h-6 w-6" />
            <Bone className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-8 rounded-full" />
            ))}
          </div>
          <Bone className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <Bone className="h-3 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </Loading>
  )
}
