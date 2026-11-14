// Logo de Mis Macros: dona de 3 segmentos (proteína 30%, carbos 45%, grasa 25%),
// empezando arriba en sentido horario. Misma geometría que src/app/icon.svg,
// pero con los tokens de color de @theme.
export default function MacroDonut({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g transform="rotate(-90 16 16)" fill="none" strokeWidth="5">
        <circle cx="16" cy="16" r="10" className="stroke-prot" strokeDasharray="17.85 45" />
        <circle
          cx="16"
          cy="16"
          r="10"
          className="stroke-carb"
          strokeDasharray="27.27 35.56"
          strokeDashoffset="-18.85"
        />
        <circle
          cx="16"
          cy="16"
          r="10"
          className="stroke-fat"
          strokeDasharray="14.71 48.12"
          strokeDashoffset="-47.12"
        />
      </g>
    </svg>
  )
}
