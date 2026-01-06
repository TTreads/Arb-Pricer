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

const LS_KEY = 'multi-stake-arb-draft-v1';

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
    slips: [newSlip()],
  };
}

function numberOr(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function MultiStakeArbPage() {
  const [draft, setDraft] = useState<Draft>({
    dog: makeLeg('dog'),
    fav: makeLeg('fav'),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed?.dog && parsed?.fav) setDraft(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const computed = useMemo(() => computeArb([draft.dog, draft.fav]), [draft]);
  const bb = useMemo(() => computeBBEfficiencyFromArb([draft.dog, draft.fav]), [draft]);

  function updateSlip(legKey: 'dog' | 'fav', slipId: string, patch: Partial<SlipInput>) {
    setDraft((prev) => {
      const leg = prev[legKey];
      const slips = leg.slips.map((s) =>
        s.id === slipId
          ? {
              ...s,
              ...patch,
              promo: {
                ...(s.promo ?? { type: 'none', boostPct: 0, bbValue: 0, note: '' }),
                ...(patch.promo ?? {}),
              },
            }
          : s,
      );

      return {
        ...prev,
        [legKey]: { ...leg, slips },
      };
    });
  }

  function addSlip(legKey: 'dog' | 'fav') {
    setDraft((prev) => ({
      ...prev,
      [legKey]: {
        ...prev[legKey],
        slips: [...prev[legKey].slips, newSlip()],
      },
    }));
  }

  function removeSlip(legKey: 'dog' | 'fav', slipId: string) {
    setDraft((prev) => {
      const leg = prev[legKey];
      const slips = leg.slips.filter((s) => s.id !== slipId);
      return {
        ...prev,
        [legKey]: { ...leg, slips: slips.length ? slips : [newSlip()] },
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

  function LegEditor({ legKey, title }: { legKey: 'dog' | 'fav'; title: string }) {
    const leg = draft[legKey];

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <div>
            <div className="h2">{title}</div>
            <div className="small" style={{ marginTop: 6 }}>
              Add multiple stake lines for this side.
            </div>
          </div>

          <button className="card" style={{ padding: '10px 12px' }} onClick={() => addSlip(legKey)}>
            + Add Stake
          </button>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {leg.slips.map((s, idx) => {
            const promoType = s.promo?.type ?? 'none';
            const showBoost = promoType === 'profit_boost' || promoType === 'odds_boost';
            const showBB = promoType === 'bonus_bet';

            return (
              <div key={s.id} className="card" style={{ borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 900 }}>Stake {idx + 1}</div>
                  <button onClick={() => removeSlip(legKey, s.id)}>Remove</button>
                </div>

                <div className="row" style={{ marginTop: 10 }}>
                  <div className="field" style={{ minWidth: 140 }}>
                    <div className="label">Book</div>
                    <input value={s.book} onChange={(e) => updateSlip(legKey, s.id, { book: e.target.value })} />
                  </div>

                  <div className="field" style={{ minWidth: 120 }}>
                    <div className="label">Odds (American)</div>
                    <input
                      inputMode="numeric"
                      value={String(s.oddsAmerican)}
                      onChange={(e) =>
                        updateSlip(legKey, s.id, { oddsAmerican: numberOr(e.target.value, s.oddsAmerican) })
                      }
                    />
                  </div>

                  <div className="field" style={{ minWidth: 120 }}>
                    <div className="label">Stake</div>
                    <input
                      inputMode="decimal"
                      value={String(s.stake)}
                      onChange={(e) => updateSlip(legKey, s.id, { stake: numberOr(e.target.value, s.stake) })}
                    />
                  </div>

                  <div className="field" style={{ minWidth: 240 }}>
                    <div className="label">Promo</div>
                    <select
                      value={promoType}
                      onChange={(e) =>
                        updateSlip(legKey, s.id, { promo: { ...s.promo, type: e.target.value as PromoType } })
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
                        value={String(s.promo?.boostPct ?? 0)}
                        onChange={(e) =>
                          updateSlip(legKey, s.id, {
                            promo: { ...s.promo, boostPct: numberOr(e.target.value, s.promo?.boostPct ?? 0) },
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
                        value={String(s.promo?.bbValue ?? 0)}
                        onChange={(e) =>
                          updateSlip(legKey, s.id, {
                            promo: { ...s.promo, bbValue: numberOr(e.target.value, s.promo?.bbValue ?? 0) },
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
                      value={s.payoutOverride == null ? '' : String(s.payoutOverride)}
                      onChange={(e) =>
                        updateSlip(legKey, s.id, {
                          payoutOverride: e.target.value.trim() ? numberOr(e.target.value, 0) : null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
        <h1 className="h1">Multi-Stake Arb (2-leg)</h1>
        <button className="card" style={{ padding: '10px 12px' }} onClick={reset}>
          Reset
        </button>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          alignItems: 'start',
        }}
      >
        <LegEditor legKey="dog" title="Dog Side" />
        <LegEditor legKey="fav" title="Fav Side" />
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
