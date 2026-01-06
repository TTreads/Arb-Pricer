'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { PromoType, SlipInput } from '@/lib/arbMath';
import type { ParlayGroup } from '@/lib/parlayArbMath';
import { computeParlayArb } from '@/lib/parlayArbMath';
import { computeBBEfficiencyFromParlay } from '@/lib/bbEfficiency';
import { ArbResultsPanel } from '@/components/ArbResultsPanel';
import { makeId } from '@/lib/id';

const LS_KEY = 'parlay-arb-draft-v1';

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit Boost (+% profit)',
  odds_boost: 'Odds Boost (+% odds)',
  bonus_bet: 'Bonus Bet / Free Bet',
  insured: 'Insured / Risk-Free',
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

function newGroup(partial?: Partial<ParlayGroup>): ParlayGroup {
  return {
    id: makeId(),
    label: 'Team Mix',
    headerBook: '',
    headerOddsAmerican: 0,
    parlayDesc: '',
    note: '',
    slips: [newSlip()],
    ...partial,
  };
}

function numberOr(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ParlayArbPage() {
  const [groups, setGroups] = useState<ParlayGroup[]>([
    newGroup({ label: 'Team Favs', parlayDesc: 'Parlay CHI & LAC' }),
    newGroup({ label: 'Team Dogs', parlayDesc: 'Parlay CHA & BOS' }),
    newGroup({ label: 'Team Mix 1', parlayDesc: 'Parlay CHI-BOS' }),
    newGroup({ label: 'Team Mix 2', parlayDesc: 'Parlay CHA-LAC' }),
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setGroups(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(groups));
    } catch {}
  }, [groups]);

  const computed = useMemo(() => computeParlayArb(groups), [groups]);
  const bb = useMemo(() => computeBBEfficiencyFromParlay(groups), [groups]);

  function updateGroup(id: string, patch: Partial<ParlayGroup>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function updateSlip(groupId: string, slipId: string, patch: Partial<SlipInput>) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          slips: g.slips.map((s) =>
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
          ),
        };
      }),
    );
  }

  function addSlip(groupId: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, slips: [...g.slips, newSlip()] } : g)));
  }

  function removeSlip(groupId: string, slipId: string) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const slips = g.slips.filter((s) => s.id !== slipId);
        return { ...g, slips: slips.length ? slips : [newSlip()] };
      }),
    );
  }

  function addGroup() {
    setGroups((prev) => [...prev, newGroup({ label: `Team Mix ${prev.length - 1}` })]);
  }

  function removeGroup(id: string) {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    setGroups([
      newGroup({ label: 'Team Favs', parlayDesc: 'Parlay CHI & LAC' }),
      newGroup({ label: 'Team Dogs', parlayDesc: 'Parlay CHA & BOS' }),
      newGroup({ label: 'Team Mix 1', parlayDesc: 'Parlay CHI-BOS' }),
      newGroup({ label: 'Team Mix 2', parlayDesc: 'Parlay CHA-LAC' }),
    ]);
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
        <h1 className="h1">Parlay Arb (Buckets)</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="card" style={{ padding: '10px 12px' }} onClick={addGroup}>
            + Add Bucket
          </button>
          <button className="card" style={{ padding: '10px 12px' }} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      <ArbResultsPanel
        variant="parlay"
        title="Parlay Arb Results"
        computed={computed}
        bb={bb}
        bucketLabels={groups.map((g) => g.label)}
        note="Net Win per bucket = bucket net payout − cash at risk on all other buckets."
      />

      <div className="grid" style={{ gap: 14 }}>
        {groups.map((g) => (
          <div key={g.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div className="h2">{g.label}</div>
                <div className="small" style={{ marginTop: 6 }}>{g.parlayDesc || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => addSlip(g.id)}>+ Add Stake</button>
                <button onClick={() => removeGroup(g.id)}>Remove Bucket</button>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div className="field" style={{ minWidth: 220 }}>
                <div className="label">Bucket Label</div>
                <input value={g.label} onChange={(e) => updateGroup(g.id, { label: e.target.value })} />
              </div>
              <div className="field" style={{ minWidth: 340 }}>
                <div className="label">Parlay Description</div>
                <input value={g.parlayDesc} onChange={(e) => updateGroup(g.id, { parlayDesc: e.target.value })} />
              </div>
            </div>

            <div className="grid" style={{ marginTop: 12 }}>
              {g.slips.map((s, si) => {
                const promoType = s.promo?.type ?? 'none';
                const showBoost = promoType === 'profit_boost' || promoType === 'odds_boost';
                const showBB = promoType === 'bonus_bet';

                return (
                  <div key={s.id} className="card" style={{ borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <div style={{ fontWeight: 900 }}>Stake {si + 1}</div>
                      <button onClick={() => removeSlip(g.id, s.id)}>Remove</button>
                    </div>

                    <div className="row" style={{ marginTop: 10 }}>
                      <div className="field" style={{ minWidth: 140 }}>
                        <div className="label">Book</div>
                        <input value={s.book} onChange={(e) => updateSlip(g.id, s.id, { book: e.target.value })} />
                      </div>

                      <div className="field" style={{ minWidth: 120 }}>
                        <div className="label">Odds (American)</div>
                        <input
                          inputMode="numeric"
                          value={String(s.oddsAmerican)}
                          onChange={(e) => updateSlip(g.id, s.id, { oddsAmerican: numberOr(e.target.value, s.oddsAmerican) })}
                        />
                      </div>

                      <div className="field" style={{ minWidth: 120 }}>
                        <div className="label">Stake</div>
                        <input
                          inputMode="decimal"
                          value={String(s.stake)}
                          onChange={(e) => updateSlip(g.id, s.id, { stake: numberOr(e.target.value, s.stake) })}
                        />
                      </div>

                      <div className="field" style={{ minWidth: 240 }}>
                        <div className="label">Promo</div>
                        <select
                          value={promoType}
                          onChange={(e) => updateSlip(g.id, s.id, { promo: { ...s.promo, type: e.target.value as PromoType } })}
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
                              updateSlip(g.id, s.id, { promo: { ...s.promo, boostPct: numberOr(e.target.value, s.promo?.boostPct ?? 0) } })
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
                              updateSlip(g.id, s.id, { promo: { ...s.promo, bbValue: numberOr(e.target.value, s.promo?.bbValue ?? 0) } })
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
                            updateSlip(g.id, s.id, { payoutOverride: e.target.value.trim() ? numberOr(e.target.value, 0) : null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
