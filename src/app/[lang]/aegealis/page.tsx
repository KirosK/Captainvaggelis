import type { Metadata } from 'next'
import { PropertyPage } from '@/components/property/PropertyPage'
import { getDictionary, type Locale } from '@/lib/i18n'
import { ogImage, pageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({
    locale: params.lang,
    path: '/aegealis',
    title: d.pages.seo.aegealis.title,
    description: d.pages.seo.aegealis.description,
    image: ogImage('aegealis'),
  })
}

export default function Page({ params }: { params: { lang: Locale } }) {
  return <PropertyPage p="aegealis" locale={params.lang} />
}
