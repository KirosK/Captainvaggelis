import { Flower2, MapPin, Users, Waves } from 'lucide-react'
import { Counter } from '@/components/ui/Counter'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { inventory } from '@/data/properties'
import type { PropertyKey, UnitGroup } from '@/data/types'
import { fill, type Dict } from '@/lib/i18n'

export function sizeLabel(g: Dict, min: number, max: number) {
  return min === max ? fill(g.sizeOne, { n: min }) : fill(g.sizeValue, { min, max })
}

/** "Garden view or partial sea view" etc.; a mixed view falls back to its plain label until it is translated. */
function viewLabel(g: Dict, view: NonNullable<UnitGroup['view']>) {
  return g.views[view] ?? g.views[view.replace('Mixed', '')]
}

export function countLabel(g: Dict, n: number) {
  return n === 1 ? g.typeCountOne : fill(g.typeCount, { count: n })
}

/** Identity chip: Aegealis = the beach (sea), Theodora = the village garden (terracotta). */
export function IdentityBadge({ p, g, tone = 'solid', className = '' }: { p: PropertyKey; g: Dict; tone?: 'solid' | 'soft' | 'light'; className?: string }) {
  const Icon = p === 'aegealis' ? Waves : Flower2
  const styles =
    tone === 'solid'
      ? p === 'aegealis'
        ? 'bg-sea text-white'
        : 'bg-terra text-white'
      : tone === 'light'
        ? 'bg-white/15 text-white ring-1 ring-white/30 backdrop-blur'
        : p === 'aegealis'
          ? 'bg-sea-mist text-sea-deep'
          : 'bg-terra-light text-terra-deep'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.12em] ${styles} ${className}`}>
      <Icon className="h-3.5 w-3.5" /> {g.identity[p]}
    </span>
  )
}

/** "At a glance": how many rooms, the largest room and where — then every room type with its count (sizes live on each room card). */
export function PropertyGlance({ p, g, units }: { p: PropertyKey; g: Dict; units: Dict }) {
  const inv = inventory(p)
  const sea = p === 'aegealis'
  const accentText = sea ? 'text-sea' : 'text-terra'
  const accentBg = sea ? 'bg-sea' : 'bg-terra'
  const cells = [
    { icon: Users, label: g.guests, value: fill(g.guestsValue, { count: inv.maxGuests }) },
    { icon: MapPin, label: g.location, value: sea ? g.aegealisLocation : g.theodoraLocation },
  ]
  return (
    <section aria-label={g.title} className={`relative border-b border-line ${sea ? 'bg-sea-mist/60' : 'bg-terra-light/40'}`}>
      <div className="container py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <Reveal className="flex items-center gap-5 lg:col-span-4">
            <span className={`font-display text-[4.5rem] font-light leading-none tabular-nums md:text-[5.5rem] ${accentText}`}>
              <Counter value={String(inv.total)} />
            </span>
            <span>
              <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{g.title}</span>
              <span className="mt-1 block font-display text-[1.45rem] leading-tight text-ink text-balance">{g.roomsBy?.[p] ?? g.rooms}</span>
            </span>
          </Reveal>
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
            {cells.map((c) => (
              <StaggerItem key={c.label} className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-ink/5">
                <c.icon className={`mt-0.5 h-5 w-5 shrink-0 ${accentText}`} />
                <span>
                  <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{c.label}</span>
                  <span className="mt-0.5 block text-[0.98rem] font-medium leading-snug">{c.value}</span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Stagger className="mt-8 flex flex-wrap gap-2" gap={0.05}>
          {inv.groups.map((u: UnitGroup) => (
            <StaggerItem key={u.key}>
              <a href={`#${u.key}`} className="group inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[0.9rem] font-medium shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-[0.8rem] font-bold tabular-nums text-white ${accentBg}`}>{u.count}</span>
                {units[u.key].name}
              </a>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/** Compact table of every room type: count, layout, size, guests, view. Rows jump to the full card. */
export function RoomsTable({ p, g, units }: { p: PropertyKey; g: Dict; units: Dict }) {
  const inv = inventory(p)
  const sea = p === 'aegealis'
  return (
    <div className="overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5">
      <p className="border-b border-line px-5 py-4 font-display text-xl md:px-6">{fill(g.allRooms, { count: inv.total, kind: g.roomsBy?.[p] ?? g.rooms })}</p>
      {/* Phones: one compact line per room type instead of a six-column table that would have to scroll sideways */}
      <ul className="divide-y divide-line md:hidden">
        {inv.groups.map((u) => (
          <li key={u.key}>
            <a href={`#${u.key}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors active:bg-sand/40">
              <span className={`relative mt-0.5 inline-grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-[0.8rem] font-bold tabular-nums ${sea ? 'bg-sea-mist text-sea-deep' : 'bg-terra-light text-terra-deep'}`}>
                <span aria-hidden="true">{u.count}</span>
                <span className="sr-only">{countLabel(g, u.count)}</span>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{units[u.key].name}</span>
                <span className="mt-0.5 block text-[0.84rem] leading-snug text-ink-soft">
                  {[g.layout[u.layout], sizeLabel(g, u.size[0], u.size[1]), fill(g.guestsValue, { count: u.maxGuests }), u.view ? viewLabel(g, u.view) : null].filter(Boolean).join(' · ')}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-[0.92rem]">
          <thead className="bg-sand/50 text-[0.72rem] uppercase tracking-[0.12em] text-ink-mute">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">{g.table.type}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{g.table.count}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{g.table.layout}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{g.table.size}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{g.table.guests}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{g.table.view}</th>
            </tr>
          </thead>
          <tbody>
            {inv.groups.map((u) => (
              <tr key={u.key} className="group border-t border-line transition-colors hover:bg-sand/40">
                <th scope="row" className="px-6 py-3.5 font-semibold">
                  <a href={`#${u.key}`} className={`underline-offset-4 group-hover:underline ${sea ? 'decoration-sea' : 'decoration-terra'}`}>
                    {units[u.key].name}
                  </a>
                </th>
                <td className="px-4 py-3.5">
                  <span className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-2 text-[0.8rem] font-bold tabular-nums ${sea ? 'bg-sea-mist text-sea-deep' : 'bg-terra-light text-terra-deep'}`}>{u.count}</span>
                </td>
                <td className="px-4 py-3.5 text-ink-soft">{g.layout[u.layout]}</td>
                <td className="px-4 py-3.5 tabular-nums text-ink-soft">{sizeLabel(g, u.size[0], u.size[1])}</td>
                <td className="px-4 py-3.5 tabular-nums text-ink-soft">{u.maxGuests}</td>
                <td className="px-4 py-3.5 text-ink-soft">{u.view ? viewLabel(g, u.view) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
