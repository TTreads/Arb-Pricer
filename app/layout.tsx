import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Noto_Serif, Plus_Jakarta_Sans } from 'next/font/google';

const notoSerif = Noto_Serif({
  subsets: ['latin'],
  variable: '--font-noto-serif',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ambience sports',
  description: 'Simple calculators for arb / multi-stake / parlay arb.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${notoSerif.variable} ${plusJakartaSans.variable}`}>
      <body>
        <header style={{ borderBottom: '1px solid #eee' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ fontWeight: 900 }}>ambience sports</Link>
            <nav style={{ display: 'flex', gap: 12, fontSize: 14 }}>
              <Link href="/pick-sizer">Pick Sizer</Link>
              <Link href="/simple-arb">Simple Arb</Link>
              <Link href="/multi-stake-arb">Multi-Stake Arb</Link>
              <Link href="/parlay-arb">Parlay Arb</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
