import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { defaultLocale, getDictionary, isLocale } from '@/lib/i18n'

// Any unknown /{lang}/… URL lands here, so it gets the branded, localised 404 (app/[lang]/not-found.tsx)
// inside the site layout, with a 404 status, instead of the bare default Next.js page.

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const { common } = await getDictionary(isLocale(params.lang) ? params.lang : defaultLocale)
  return {
    title: `${common.notFound.metaTitle} · ${common.brand.name}`,
    description: common.notFound.body,
    robots: { index: false, follow: true },
  }
}

export default function UnknownPage() {
  notFound()
}
