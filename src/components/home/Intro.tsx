import { Counter } from '@/components/ui/Counter'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import type { Dict } from '@/lib/i18n'

export function Intro({ t }: { t: Dict }) {
  const paragraphs = String(t.body).split('\n\n')
  return (
    <section className="relative overflow-hidden bg-sand-paper py-24 md:py-36">
      <div className="container grid gap-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Reveal y={10} blur={false}>
            <p className="kicker">{t.kicker}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.title}</h2>
          </Reveal>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={0.1 + i * 0.08}>
              <p className={`text-[1.08rem] leading-[1.75] text-ink-soft text-pretty ${i ? 'mt-5' : ''} ${i === 0 ? 'first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-display first-letter:text-[3.6rem] first-letter:leading-[0.8] first-letter:text-sea' : ''}`}>
                {p}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
      <div className="container mt-20">
        <Stagger className="grid grid-cols-2 border-t border-line md:grid-cols-4">
          {(t.stats as { value: string; label: string }[]).map((s, i) => (
            <StaggerItem key={i} className={`border-line py-8 pr-5 ${i % 2 ? 'border-l pl-5' : ''} ${i > 0 ? 'md:border-l md:pl-8' : ''} ${i > 1 ? 'border-t md:border-t-0' : ''}`}>
              <Counter value={s.value} className="block font-display text-[2.6rem] font-light leading-none tabular-nums text-ink md:text-[3.4rem]" />
              <span className="mt-3 block text-[0.9rem] leading-snug text-ink-mute">{s.label}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
