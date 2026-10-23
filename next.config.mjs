/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [480, 640, 828, 1080, 1280, 1600, 1920],
    imageSizes: [96, 160, 256, 384],
    minimumCacheTTL: 31536000,
  },
  // Old kefalonia-cruises.gr (Joomla) addresses → new pages, so existing Google rankings carry over.
  async redirects() {
    const map = {
      '/captain-vagelis-cruises': '/contact',
      '/book-online': '/cruises',
      '/kefalonia-boat-tours/daily-cruises-kefalonia': '/cruises',
      '/kefalonia-boat-tours/kefalonia-cruising': '/cruises',
      '/kefalonia-boat-tours/kefalonia-kalypso-star': '/cruises',
      '/kefalonia-cruises/ithaca-cruises-kioni': '/cruises/ithaca-vathi-kioni',
      '/kefalonia-cruises/ithaca-cruises-vathi': '/cruises/ithaca-vathi',
      '/kefalonia-cruises/kefalonia-coast-cruises': '/cruises/fiscardo-sami',
      '/kefalonia-cruises/zante-cruises': '/cruises/zakynthos-shipwreck',
      '/kefalonia-cruises/koutsoupia-kefalonia-cruises': '/cruises/mini-myrtos-bbq',
      '/cruise-kefalonia/wedding-cruises-kefalonia': '/cruises/wedding-cruises',
      '/cruise-kefalonia/private-cruises-kefalonia': '/cruises/private-cruises',
      '/policy': '/terms',
      '/payment-methods': '/terms',
      '/transaction-security': '/terms',
      '/component/sppagebuilder/page/53': '/cruises',
    }
    // Greek pages whose old slug differs from the English twin (paired by the old site's hreflang tags and Greek menu).
    const elOnly = {
      '/el/kefalonia-cruises/ithaca-cruises': '/el/cruises/ithaca-vathi-kioni',
      '/el/kefalonia-cruises/ithaca-cruises-2': '/el/cruises/ithaca-vathi',
      '/el/book-online-2': '/el/cruises',
      '/el/policy-el': '/el/terms',
      '/el/payment-methods-el': '/el/terms',
      '/el/transaction-security-el': '/el/terms',
      '/el/component/sppagebuilder/page/68': '/el/cruises',
    }
    return [
      ...Object.entries(map).flatMap(([from, to]) => [
        { source: from, destination: `/en${to}`, permanent: true },
        { source: `/el${from}`, destination: `/el${to}`, permanent: true },
      ]),
      ...Object.entries(elOnly).map(([source, destination]) => ({ source, destination, permanent: true })),
    ]
  },
  async headers() {
    const noindex = process.env.NEXT_PUBLIC_NOINDEX === '1'
    return [
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // the preloaded web fonts (copies of the pinned @fontsource files)
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      ...(noindex ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] : []),
    ]
  },
}
export default nextConfig
