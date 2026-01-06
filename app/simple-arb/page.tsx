'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { LegInput, PromoType, Side, SlipInput } from '@/lib/arbMath';
import { computeArb } from '@/lib/arbMath';
import { computeBBEfficiencyFromArb } from '@/lib/bbEfficiency';
import { ArbResultsPanel } from '@/components/ArbResultsPanel';
import { makeId } from '@/lib/id';

type Draft = {
  dog: LegInput;
  fav: LegInput;
};

const LS_KEY = 'simple-arb-draft-v1';

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit Boost (+% profit)',
  odds_boost: 'Odds Boost (+% odds)',
  bonus_bet: 'Bonus Bet / Free Bet (stake not returned)',
  insured: 'Insured / Risk-Free (treat losing stake as refunded)',
};

function newSlip(partial?: Partial<SlipInput>): SlipInput {
  return {
    id: makeId(),
    book: '',
    oddsAmerican: 100,
    stake: 0,
    promo: { type: 'none', boostPct: 0, bbValue: 0, note: '' },
    payoutOverride: null,
    note: '',
    ...partial,
  };
}

function makeLeg(side: Side): LegInput {
  return {
    side,
    team: '',
    market: 'ML',
    event: '',
    note: '',
    slips: [newSlip()], // exactly one stake line
  };
}

function numberOr(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SimpleArbPage() {
  const [draft, setDraft] = useState<Draft>({
    dog: makeLeg('dog'),
    fav: makeLeg('fav'),
  });

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed?.dog?.slips?.length && parsed?.fav?.slips?.length) setDraft(parsed);
    } catch {}
  }, []);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const computed = useMemo(() => computeArb([draft.dog, draft.fav]), [draft]);
  const bb = useMemo(() => computeBBEfficiencyFromArb([draft.dog, draft.fav]), [draft]);

  function updateSlip(legKey: 'dog' | 'fav', patch: Partial<SlipInput>) {
    setDraft((prev) => {
      const leg = prev[legKey];
      const current = leg.slips[0];
      const next: SlipInput = {
        ...current,
        ...patch,
        promo: {
          ...(current.promo ?? { type: 'none', boostPct: 0, bbValue: 0, note: '' }),
          ...(patch.promo ?? {}),
        },
      };
      return {
        ...prev,
        [legKey]: {
          ...leg,
          slips: [next],
        },
      };
    });
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    setDraft({
      dog: makeLeg('dog'),
      fav: makeLeg('fav'),
    });
  }

  const dogSlip = draft.dog.slips[0];
  const favSlip = draft.fav.slips[0];

  function SlipEditor({
    slip,
    legKey,
    title,
  }: {
    slip: SlipInput;
    legKey: 'dog' | 'fav';
    title: string;
  }) {
    const promoType = slip.promo?.type ?? 'none';
    const showBoost = promoType === 'profit_boost' || promoType === 'odds_boost';
    const showBB = promoType === 'bonus_bet';

    return (
      <div className="card">
        <div className="h2">{title}</div>
        <div className="small" style={{ marginTop: 6 }}>
          One stake line on this side.
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="field" style={{ minWidth: 140 }}>
            <div className="label">Book</div>
            <input value={slip.book} onChange={(e) => updateSlip(legKey, { book: e.target.value })} />
          </div>

          <div className="field" style={{ minWidth: 120 }}>
            <div className="label">Odds (American)</div>
            <input
              inputMode="numeric"
              value={String(slip.oddsAmerican)}
              onChange={(e) => updateSlip(legKey, { oddsAmerican: numberOr(e.target.value, slip.oddsAmerican) })}
            />
          </div>

          <div className="field" style={{ minWidth: 120 }}>
            <div className="label">Stake</div>
            <input
              inputMode="decimal"
              value={String(slip.stake)}
              onChange={(e) => updateSlip(legKey, { stake: numberOr(e.target.value, slip.stake) })}
            />
          </div>

          <div className="field" style={{ minWidth: 240 }}>
            <div className="label">Promo</div>
            <select
              value={promoType}
              onChange={(e) =>
                updateSlip(legKey, { promo: { ...slip.promo, type: e.target.value as PromoType } })
              }
            >
              {Object.entries(PROMO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showBoost && (
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ minWidth: 160 }}>
              <div className="label">Boost %</div>
              <input
                inputMode="decimal"
                value={String(slip.promo?.boostPct ?? 0)}
                onChange={(e) =>
                  updateSlip(legKey, {
                    promo: { ...slip.promo, boostPct: numberOr(e.target.value, slip.promo?.boostPct ?? 0) },
                  })
                }
              />
            </div>
          </div>
        )}

        {showBB && (
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ minWidth: 200 }}>
              <div className="label">Bonus Bet Value (for efficiency)</div>
              <input
                inputMode="decimal"
                value={String(slip.promo?.bbValue ?? 0)}
                onChange={(e) =>
                  updateSlip(legKey, {
                    promo: { ...slip.promo, bbValue: numberOr(e.target.value, slip.promo?.bbValue ?? 0) },
                  })
                }
              />
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          <div className="field" style={{ minWidth: 220 }}>
            <div className="label">Payout Override (optional)</div>
            <input
              inputMode="decimal"
              placeholder="Leave blank to auto-calc"
              value={slip.payoutOverride == null ? '' : String(slip.payoutOverride)}
              onChange={(e) =>
                updateSlip(legKey, {
                  payoutOverride: e.target.value.trim() ? numberOr(e.target.value, 0) : null,
                })
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'baseline',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="h1">Simple Arb (2-leg)</h1>
        <button className="card" style={{ padding: '10px 12px' }} onClick={reset}>
          Reset
        </button>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'start',
        }}
      >
        <SlipEditor legKey="dog" title="Dog Side" slip={dogSlip} />
        <SlipEditor legKey="fav" title="Fav Side" slip={favSlip} />
      </div>

      <ArbResultsPanel
        variant="two-leg"
        title="Arb Results"
        computed={computed}
        bb={bb}
        leftLabel="Dog"
        rightLabel="Fav"
        note="Net Win if a side wins = winning side net payout minus cash at risk on the other side."
      />
    </div>
  );
}
