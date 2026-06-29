import type { Metadata, Viewport } from 'next'
import './globals.css'

const isStaging = process.env.NEXT_PUBLIC_STAGING_MODE === 'true'

export function generateMetadata(): Metadata {
  const appTitle = isStaging ? '[STAGING] FormaScuole' : 'FormaScuole'
  return {
    title: appTitle,
    description: 'Gestione corsi di formazione scolastica',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: appTitle,
    },
    icons: {
      icon: [
        { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#d64b55',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="h-full">
      <body className={`min-h-full${isStaging ? ' pt-8' : ''}`}>
        {isStaging && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              height: '32px',
              backgroundColor: '#991B1B',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            ⚠️ AMBIENTE DI TEST — Le modifiche non impattano la produzione
          </div>
        )}
        {children}
      </body>
    </html>
  )
}
