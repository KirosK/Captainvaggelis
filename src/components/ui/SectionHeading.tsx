import { Reveal } from './Reveal'

export function SectionHeading({
  kicker,
  title,
  intro,
  index,
  align = 'left',
  tone = 'dark',
  className = '',
  as = 'h2',
}: {
  kicker?: string
  title: string
  intro?: string
  index?: string
  align?: 'left' | 'center'
  tone?: 'dark' | 'light'
  className?: string
  as?: 'h1' | 'h2'
}) {
  const H = as
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      {kicker && (
        <Reveal y={10} blur={false}>
          <p className={`kicker ${tone === 'light' ? 'kicker-light' : ''} ${align === 'center' ? 'justify-center' : ''}`}>
            {index && <span className="tabular-nums opacity-70">{index}</span>}
            {kicker}
          </p>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <H className={`mt-5 font-display text-display-lg font-light text-balance ${tone === 'light' ? 'text-white' : 'text-ink'}`}>{title}</H>
      </Reveal>
      {intro && (
        <Reveal delay={0.12}>
          <p className={`mt-5 text-[1.05rem] leading-relaxed text-pretty ${tone === 'light' ? 'text-white/75' : 'text-ink-soft'} ${align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>{intro}</p>
        </Reveal>
      )}
    </div>
  )
}
