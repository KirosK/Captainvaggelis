import type { MetadataRoute } from 'next'

// The SVG icon is src/app/icon.svg (served at /icon.svg). The PNGs in public/ and src/app/apple-icon.png are
// rendered from it; the maskable one keeps the artwork inside the central safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Aegealis & Theodora Studios · Captain Vangelis, Skala Kefalonia',
    short_name: 'Captain Vangelis',
    description:
      'Family-run studios and apartments in Skala, Kefalonia: Aegealis Studios opposite the beach and Theodora Studios & Apartments in a quiet garden, plus Captain Vangelis day cruises since 1987.',
    start_url: '/',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    display: 'standalone',
    background_color: '#FBF8F2',
    theme_color: '#0F2430',
    categories: ['travel'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
