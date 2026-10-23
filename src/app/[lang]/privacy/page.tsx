import type { Metadata } from 'next'
import { getDictionary, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({ locale: params.lang, path: '/privacy', title: d.pages.seo.privacy.title, description: d.pages.seo.privacy.description })
}

export default async function Page({ params }: { params: { lang: Locale } }) {
  const d = await getDictionary(params.lang)
  const body = String(d.pages.legal.privacyBody).split('\n\n')
  return (
    <article className="bg-sand-paper pb-24 pt-[calc(var(--header-h)+var(--banner-h,0px)+3.5rem)]">
      <div className="container max-w-3xl">
        <h1 className="font-display text-display-lg font-light">{d.pages.legal.privacyTitle}</h1>
        <div className="mt-10 space-y-5 text-[1.02rem] leading-[1.8] text-ink-soft">
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </article>
  )
}
