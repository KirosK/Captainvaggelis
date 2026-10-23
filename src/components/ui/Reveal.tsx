'use client'

import { m, type Variants } from 'framer-motion'

const variants: Variants = {
  hidden: (d: { y: number; blur: boolean }) => ({ opacity: 0, y: d.y, filter: d.blur ? 'blur(6px)' : 'blur(0px)' }),
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

/** Fades and lifts its children into view once, when scrolled to. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  blur = true,
  className,
  as = 'div',
  amount = 0.25,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  blur?: boolean
  className?: string
  as?: 'div' | 'li' | 'section' | 'span' | 'p' | 'h2' | 'article'
  amount?: number
}) {
  const Comp = m[as]
  return (
    <Comp
      className={className}
      custom={{ y, blur }}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  )
}

/** Staggers direct children that use <StaggerItem>. */
export function Stagger({ children, className, gap = 0.08, as = 'div' }: { children: React.ReactNode; className?: string; gap?: number; as?: 'div' | 'ul' | 'ol' }) {
  const Comp = m[as]
  return (
    <Comp className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} transition={{ staggerChildren: gap }}>
      {children}
    </Comp>
  )
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

export function StaggerItem({ children, className, as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const Comp = m[as]
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  )
}
