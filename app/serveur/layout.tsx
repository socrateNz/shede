import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { getT } from '@/lib/i18n/server';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('waiter.meta.title'),
    // Application installable (écran d'accueil), limitée au mode serveur
    manifest: '/serveur.webmanifest',
    appleWebApp: { capable: true, title: t('waiter.meta.title'), statusBarStyle: 'default' },
    icons: { apple: '/icons/waiter-192.png' },
  };
}

// Téléphone : pas de zoom involontaire sur les boutons, couleur de barre claire.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f6f5f2',
};

/** Mode serveur : plein écran, sans la barre latérale du back-office, thème clair. */
export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${jakarta.className} min-h-[100dvh] bg-[#e9e7e1] text-[#17181c] antialiased`}>{children}</div>;
}
