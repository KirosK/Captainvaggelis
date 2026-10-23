import type { Metadata } from 'next'
import '../globals.css'
import { fontVars } from '@/lib/fonts'
import { MotionProvider } from '@/components/ui/MotionProvider'

export const metadata: Metadata = {
  title: 'Διαχείριση · Captain Vangelis',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el-GR" className={fontVars}>
      <body className="bg-sand">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
