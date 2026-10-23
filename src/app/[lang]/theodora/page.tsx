import type { Metadata } from 'next'
import { PropertyPage } from '@/components/property/PropertyPage'
import { getDictionary, type Locale } from '@/lib/i18n'
import { ogImage, pageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({
    locale: params.lang,
    path: '/theodora',
    title: d.pages.seo.theodora.title,
    description: d.pages.seo.theodora.description,
    image: ogImage('theodora'),
  })
}

export default function Page({ params }: { params: { lang: Locale } }) {
  return <PropertyPage p="theodora" locale={params.lang} />
}
