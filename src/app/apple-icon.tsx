import { ImageResponse } from 'next/og'

// Ícono para iOS (pantalla de inicio): la misma dona de macros que icon.svg,
// en PNG de 180x180. ImageResponse no lee los tokens de Tailwind, por eso los
// colores van en hex (son los mismos que --color-prot / --color-carb / --color-fat).

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Circunferencia de r=10: 2π·10 ≈ 62.83. Segmentos 30% / 45% / 25%, cada uno
// recortado en 1 para dejar un pequeño espacio entre ellos.
const C = 2 * Math.PI * 10
const GAP = 1
const SEGMENTOS = [
  { color: '#2D5BC4', parte: 0.3 },
  { color: '#D08A2E', parte: 0.45 },
  { color: '#7B4AA8', parte: 0.25 },
]

export default function AppleIcon() {
  let inicio = 0
  const arcos = SEGMENTOS.map(({ color, parte }) => {
    const largo = C * parte
    const arco = (
      <circle
        key={color}
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${(largo - GAP).toFixed(2)} ${(C - largo + GAP).toFixed(2)}`}
        strokeDashoffset={(-inicio).toFixed(2)}
      />
    )
    inicio += largo
    return arco
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 32 32">
          <g transform="rotate(-90 16 16)">{arcos}</g>
        </svg>
      </div>
    ),
    size
  )
}
