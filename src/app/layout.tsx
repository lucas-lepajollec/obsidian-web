import type { Metadata, Viewport } from 'next'
import 'katex/dist/katex.min.css'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'ShardNote',
  description: 'A private, self-hosted Markdown workspace for the web.',
  applicationName: 'ShardNote',
  icons: { icon: '/shardnote-mark.svg' },
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body>{children}</body>
    </html>
  )
}
