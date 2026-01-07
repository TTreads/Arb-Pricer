import Link from 'next/link'

function Tile({ title, href, desc }: { title: string; href: string; desc: string }) {
  return (
    <Link href={href} className="card" style={{ display: 'block' }}>
      <div className="h2">{title}</div>
      <div className="small" style={{ marginTop: 6 }}>{desc}</div>
      <div className="small" style={{ marginTop: 10 }}>
        Open: <span className="kbd">{href}</span>
      </div>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 className="h1">Stake Sizing Sandbox</h1>
      <div className="small">
        Choose a calculator, enter odds / stakes / promos, and see your net win outcomes.
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Tile
          title="Pick Sizer"
          href="/pick-sizer"
          desc="Calculate the stakes per pick"
        />
        <Tile
          title="Simple Arb (2-leg)"
          href="/simple-arb"
          desc="One stake line on each side (dog + fav). Fast sanity checks."
        />
        <Tile
          title="Multi-Stake Arb (2-leg)"
          href="/multi-stake-arb"
          desc="Multiple stake lines on each side (e.g., split across books or promos)."
        />
        <Tile
          title="Parlay Arb (Buckets)"
          href="/parlay-arb"
          desc="Mutually exclusive outcome buckets each bucket can have multiple stakes."
        />
      </div>

      <div className="card">
        <div className="h2">Notes</div>

        <ul className="small" style={{ marginTop: 8, paddingLeft: 18 }}>
          <li>All pages save your current draft, unless you clear your browser history</li>
          <li>Bonus Bet 'efficiency' is computed based on Bonus Bet usage vs. lowest guaranteed win</li>
          <li>Premium version securely stores your information long-term</li>
        </ul>
      </div>
    </div>
  )
}
