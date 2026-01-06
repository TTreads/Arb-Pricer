'use client';

import React from 'react';
import type { ArbComputed } from '@/lib/arbMath';
import type { ParlayArbComputed } from '@/lib/parlayArbMath';
import type { BBEfficiencyResult } from '@/lib/bbEfficiency';
import { fmtMoney, fmtX, minNumber, maxNumber, get2LegOutcomeCards, getParlayOutcomeCards } from '@/lib/arbFormat';

type Props =
  | {
      variant: 'two-leg';
      title?: string;
      computed: ArbComputed;
      bb?: BBEfficiencyResult | null;
      leftLabel?: string;
      rightLabel?: string;
      note?: string;
    }
  | {
      variant: 'parlay';
      title?: string;
      computed: ParlayArbComputed;
      bb?: BBEfficiencyResult | null;
      bucketLabels?: string[];
      note?: string;
    };

export function ArbResultsPanel(props: Props) {
  const title = props.title ?? 'Results';

  const outcomeCards =
    props.variant === 'two-leg' ? get2LegOutcomeCards(props.computed) : getParlayOutcomeCards(props.computed);

  const netWins = outcomeCards.map((x) => x.value);
  const minNet = minNumber(netWins);
  const maxNet = maxNumber(netWins);

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <div>
          <div style={hTitle}>{title}</div>
          {props.note ? <div style={subtle}>{props.note}</div> : null}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Badge label="Min" value={fmtMoney(minNet)} />
          <Badge label="Max" value={fmtMoney(maxNet)} />
        </div>
      </div>

      <div style={grid2}>
        {outcomeCards.map((o, i) => {
          const label =
            props.variant === 'parlay'
              ? props.bucketLabels?.[i] ?? `Bucket ${i + 1}`
              : i === 0
                ? props.leftLabel ?? 'Left'
                : props.rightLabel ?? 'Right';

          return (
            <div key={i} style={card}>
              <div style={smallCap}>{label}</div>
              <div style={bigMoney}>{fmtMoney(o.value)}</div>
              <div style={subtle}>{o.title}</div>
            </div>
          );
        })}
      </div>

      {props.bb ? (
        <div style={bbWrap}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <div style={{ fontWeight: 900 }}>Bonus Bet Summary</div>
            <div style={subtle}>
              Total BB Used: <b>{fmtMoney(props.bb.totalBB)}</b>
            </div>
          </div>

          <div style={grid2}>
            {props.bb.netWins.map((v, i) => (
              <div key={i} style={miniCard}>
                <div style={smallCap}>
                  {props.variant === 'parlay'
                    ? props.bucketLabels?.[i] ?? `Bucket ${i + 1}`
                    : i === 0
                      ? props.leftLabel ?? 'Left'
                      : props.rightLabel ?? 'Right'}
                </div>
                <div style={{ fontWeight: 900 }}>
                  {fmtMoney(v)} → {fmtX(props.bb.efficiencies[i])}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 13 }}>
            <b>MIN BB EFF:</b> {fmtX(props.bb.minEfficiency)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={badge}>
      <div style={badgeLabel}>{label}</div>
      <div style={badgeValue}>{value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 12, padding: 14 };
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12 };
const hTitle: React.CSSProperties = { fontSize: 16, fontWeight: 900 };
const subtle: React.CSSProperties = { fontSize: 13, opacity: 0.75, marginTop: 4 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const card: React.CSSProperties = { border: '1px solid #eee', borderRadius: 12, padding: 12 };
const miniCard: React.CSSProperties = { border: '1px solid #f0f0f0', borderRadius: 12, padding: 10 };
const smallCap: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginBottom: 6 };
const bigMoney: React.CSSProperties = { fontSize: 26, fontWeight: 900, lineHeight: 1.05 };
const bbWrap: React.CSSProperties = { marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 12 };
const badge: React.CSSProperties = { border: '1px solid #eee', borderRadius: 12, padding: '8px 10px', minWidth: 90 };
const badgeLabel: React.CSSProperties = { fontSize: 11, opacity: 0.7 };
const badgeValue: React.CSSProperties = { fontSize: 14, fontWeight: 900 };
