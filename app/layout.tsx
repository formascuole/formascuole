import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FormaScuola',
  description: 'Gestione progetti formativi nelle scuole',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
