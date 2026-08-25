import type { Summary } from '../api'
import { fmtInt, kmToUnit } from '../format'
import { loc } from '../localization'

type Props = {
  summary: Summary | null
  units: 'km' | 'mi'
  label: string
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 70
  const h = 26
  if (!values.length) return <svg width={w} height={h} />
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Delta({ value, invert }: { value: number | undefined; invert?: boolean }) {
  if (value === undefined || value === 0 || !isFinite(value)) return <div style={{ fontSize: 11 }}>&nbsp;</div>
  const up = value > 0
  const good = invert ? !up : up
  return (
    <div style={{ fontSize: 11, color: good ? '#3ecf8e' : 'var(--muted-2)', fontFamily: "'JetBrains Mono',monospace" }}>
      {up ? '▲' : '▼'} {fmtInt(Math.abs(value))}
    </div>
  )
}

export default function KpiGrid({ summary, units, label }: Props) {
  const s = summary
  const effFactor = units === 'mi' ? 1.60934 : 1
  const cards = [
    {
      name: loc('distance'),
      value: s ? fmtInt(kmToUnit(s.distance_km, units)) : '—',
      unit: units,
      delta: s?.deltas ? kmToUnit(s.deltas.distance_km, units) : undefined,
      invert: false,
      spark: s?.sparklines.distance ?? [],
      color: '#5f7fd6',
    },
    {
      name: loc('drives'),
      value: s ? fmtInt(s.drives) : '—',
      unit: '',
      delta: s?.deltas?.drives,
      invert: false,
      spark: s?.sparklines.drives ?? [],
      color: '#5f7fd6',
    },
    {
      name: loc('energy'),
      value: s ? fmtInt(s.energy_kwh) : '—',
      unit: 'kWh',
      delta: s?.deltas?.energy_kwh,
      invert: false,
      spark: s?.sparklines.energy ?? [],
      color: '#3ecf8e',
    },
    {
      name: loc('efficiency'),
      value: s ? fmtInt(s.efficiency_wh_km * effFactor) : '—',
      unit: `Wh/${units}`,
      delta: s?.deltas ? s.deltas.efficiency_wh_km * effFactor : undefined,
      invert: true,
      spark: s?.sparklines.efficiency ?? [],
      color: '#5f7fd6',
    },
  ]

  return (
    <div style={{ flex: '0 0 auto', padding: '18px 20px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('overview')}</div>
        <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--muted-3)', background: 'var(--chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
          {label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {cards.map((c) => (
          <div key={c.name} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{c.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 23, fontWeight: 600, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>
              {c.value}
              {c.unit && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>{c.unit}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 9 }}>
              <Delta value={c.delta} invert={c.invert} />
              <Sparkline values={c.spark} color={c.color} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
