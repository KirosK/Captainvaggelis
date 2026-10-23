import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BookingFlow } from '@/components/booking/BookingFlow'
import { getDictionary, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({ locale: params.lang, path: '/book', title: d.pages.seo.book.title, description: d.pages.seo.book.description, noindex: true })
}

export default async function BookPage({ params }: { params: { lang: Locale } }) {
  const d = await getDictionary(params.lang)
  return (
    <div className="min-h-screen bg-sand-paper">
      <Suspense>
        <BookingFlow locale={params.lang} t={d.booking} common={d.common} units={d.units} bothLabel={d.home.bookingBar.both} />
      </Suspense>
    </div>
  )
}
