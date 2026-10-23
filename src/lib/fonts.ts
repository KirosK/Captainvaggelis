// Self-hosted variable fonts (Latin + Greek), loaded through @fontsource CSS with unicode-range,
// so a visitor only downloads the subsets the page actually uses.
import '@fontsource-variable/noto-serif-display/wght.css'
import '@fontsource-variable/noto-serif-display/wght-italic.css'
import '@fontsource-variable/commissioner/wght.css'
// the above-the-fold subsets again, at fixed URLs that the layout preloads (see fonts.css)
import './fonts.css'

export const fontVars = 'font-vars'

/** The files preloaded on each language: Latin everywhere, plus Greek on the Greek pages. */
export function preloadFonts(locale: 'en' | 'el' | 'it') {
  const latin = ['/fonts/noto-serif-display-latin-wght-normal.woff2', '/fonts/commissioner-latin-wght-normal.woff2']
  return locale === 'el' ? ['/fonts/noto-serif-display-greek-wght-normal.woff2', '/fonts/commissioner-greek-wght-normal.woff2', ...latin] : latin
}
