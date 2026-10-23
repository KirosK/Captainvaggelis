import { seeded } from '@/lib/dates'

/** Decorative ticket code derived from the booking reference (demo — not a scannable QR). */
export function TicketCode({ value, size = 88, label }: { value: string; size?: number; label?: string }) {
  const n = 13
  const cell = size / n
  const finder = (x: number, y: number) => (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4)
  const rects: JSX.Element[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue
      if (seeded(`${value}:${x}:${y}`) > 0.52) rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} />)
    }
  const box = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x * cell} y={y * cell} width={cell * 3} height={cell * 3} fill="none" stroke="currentColor" strokeWidth={cell * 0.7} />
      <rect x={(x + 1) * cell} y={(y + 1) * cell} width={cell} height={cell} />
    </g>
  )
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 rounded-lg bg-white p-1.5 text-ink"
      fill="currentColor"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {rects}
      {box(0, 0)}
      {box(n - 3, 0)}
      {box(0, n - 3)}
    </svg>
  )
}
