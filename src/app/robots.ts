import type { MetadataRoute } from 'next'
import { site } from '@/data/site'

export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_NOINDEX === '1') return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin'] },
      // AI assistants are welcome: they help travellers find and compare places to stay.
      { userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'], allow: '/', disallow: ['/admin'] },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  }
}
