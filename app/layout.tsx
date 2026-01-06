import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Arb Pricer',
  description: 'Simple calculators for arb / multi-stake / parlay arb.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid #eee' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ fontWeight: 900 }}>Arb Pricer</Link>
            <nav style={{ display: 'flex', gap: 12, fontSize: 14 }}>
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
