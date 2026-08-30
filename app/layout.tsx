import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';

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
  title: "24hrs.lol — The internet has 24 hours. We're auctioning all of them.",
  description:
    '24 hours. 24 advertising moments. One brand gets the spotlight every hour — the highest bid owns it.',
  openGraph: {
    title: "24hrs.lol — The internet has 24 hours. We're auctioning all of them.",
    description:
      '24 hourly advertising slots. The highest bid owns that hour on the homepage clock.',
    url: publicEnv.siteUrl,
    siteName: '24hrs.lol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "24hrs.lol — The internet has 24 hours. We're auctioning all of them.",
    description: '24 hourly advertising slots. The highest bid owns that hour.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

/** Bare hostname of the deployed site, e.g. "24hrs.lol". */
function resolveTrackingDomain(): string {
  try {
    return new URL(publicEnv.siteUrl).hostname;
  } catch {
    return '24hrs.lol';
  }
}

const trackingDomain = resolveTrackingDomain();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        {children}

        {/*
          Website id and domain both come from the environment, so page views are
          recorded into the same Datafast project the API reads its numbers from.
          A hardcoded id here would silently track this site into another project.

          next/script injects this on the client rather than rendering it into the
          server HTML. NEXT_PUBLIC_* values are inlined at build time, so a plain
          conditional <script> would mismatch on hydration if the variable were
          added in the host without a redeploy.
        */}
        {publicEnv.datafastWebsiteId && (
          <Script
            strategy="afterInteractive"
            src="https://datafa.st/js/script.js"
            data-website-id={publicEnv.datafastWebsiteId}
            data-domain={trackingDomain}
          />
        )}

        {/*
          TinyAdz. Loaded through next/script for the same reason as above; the
          site id is a public identifier, so it is inline rather than an env var.
        */}
        <Script
          strategy="afterInteractive"
          src="https://cdn.apitiny.net/scripts/v2.0/main.js"
          data-site-id="6a948fe1851f91b5406b824a"
          data-test-mode="false"
        />
      </body>
    </html>
  );
}
