'use client'

import { LazyMotion, MotionConfig, domMax } from 'framer-motion'

// domMax (not domAnimation): the lightbox swipe needs the drag gesture, and the
// sliding "pill" indicators (header, sub-nav, chips, tabs) need layout/layoutId.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}
