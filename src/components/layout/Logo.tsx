export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  // Horizon, rising sun and two swells: the view from Skala beach at dawn.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <circle cx="24" cy="24" r="22.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 24a11 11 0 0 1 22 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 24h33" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 30.5c2.2 0 2.2-1.6 4.4-1.6s2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6 2.2 1.6 3.9 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 35.5c1.8 0 1.8-1.3 3.6-1.3s1.8 1.3 3.6 1.3 1.8-1.3 3.6-1.3 1.8 1.3 3.6 1.3 1.8-1.3 3.6-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
      <path d="M24 9v4M15.5 12.5l2 3M32.5 12.5l-2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
    </svg>
  )
}

export function Logo({ tone = 'dark', sub }: { tone?: 'dark' | 'light'; sub: string }) {
  return (
    <span className={`flex items-center gap-3 ${tone === 'light' ? 'text-white' : 'text-ink'}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.28rem] tracking-[-0.01em]">Captain Vangelis</span>
        <span className={`mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] ${tone === 'light' ? 'text-white/90 [text-shadow:0_1px_8px_rgba(15,36,48,.45)]' : 'text-ink-mute'}`}>{sub}</span>
      </span>
    </span>
  )
}
