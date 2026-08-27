import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import './globals.css';
import { publicEnv } from '@/lib/public-env';

// Self-hosted at build time: no render-blocking request to Google.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: '24hrs.lol — Own an hour. Own the attention.',
  description:
    '24 hourly advertising slots. The highest bid owns that hour on the homepage clock. Live, every day.',
  openGraph: {
    title: '24hrs.lol — Own an hour. Own the attention.',
    description:
      '24 hourly advertising slots. The highest bid owns that hour on the homepage clock.',
    url: publicEnv.siteUrl,
    siteName: '24hrs.lol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '24hrs.lol — Own an hour. Own the attention.',
    description: '24 hourly advertising slots. The highest bid owns that hour.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          defer
          data-website-id="dfid_jhlWORpexNZ5I45JtmIZa"
          data-domain="24hrs.lol"
          src="https://datafa.st/js/script.js"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
