import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Providers } from './provider'
import { I18nProvider } from '@/lib/i18n/client'
import { getLocale, getT } from '@/lib/i18n/server'
const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
// Police de la marque Tavola (logo, titres de marque) ; l'interface reste en Geist
const marque = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-marque', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    // Application installable sur tout le site (le mode serveur a son propre manifeste)
    manifest: '/manifest.webmanifest',
    applicationName: 'Tavola',
    appleWebApp: { capable: true, title: 'Tavola', statusBarStyle: 'black' },
    icons: { apple: '/icons/app-apple-180.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b0b0b',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} translate="no" className={marque.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
        {/* Statistiques de visite Vercel : sans objet sur le VPS */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}
