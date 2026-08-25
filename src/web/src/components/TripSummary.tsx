import { useState } from 'react'
import type { Activity } from '../api'
import { fmtHShort, fmtInt, kmToUnit } from '../format'
import { loc } from '../localization'

type Props = {
  /** the selected activities in chronological order */
  acts: Activity[]
  units: 'km' | 'mi'
  onClose: () => void
  onFitRoute: () => void
  selectedIds: string[]
}

export default function TripSummary({ acts, units, onClose, onFitRoute, selectedIds }: Props) {
  const [copied, setCopied] = useState(false)

  const drives = acts.filter((a) => a.kind === 'drive')
  const charges = acts.filter((a) => a.kind === 'charge')
  const distance = drives.reduce((t, a) => t + (a.km ?? 0), 0)
  const energy = charges.reduce((t, a) => t + a.kWh, 0)
  const driveMin = drives.reduce((t, a) => t + a.durMin, 0)
  // Overnight stops would dwarf the total, so each charge counts at most 2h.
  const chargeMin = charges.reduce((t, a) => t + Math.min(a.durMin, 120), 0)

  const first = acts[0]
  const last = acts[acts.length - 1]
  const origin = (drives[0] ?? first)?.title.split(' → ')[0] ?? '—'
  const lastDrive = drives[drives.length - 1]
  const dest = lastDrive ? lastDrive.title.split(' → ')[1] : last?.title ?? '—'
  const originSoc = (drives[0] ?? first)?.socStart ?? 0
  const destSoc = last?.socEnd ?? 0

  const share = () => {
    const url = `${location.origin}${location.pathname}?sel=${selectedIds.join(',')}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  // Battery over the whole trip: piecewise SoC, discharge (drives, blue) vs
  // charge (green). X is elapsed time with the same 2h cap as the totals.
  const CW = 304, CH = 64, CPT = 6, CPB = 6
  const segs = (() => {
    let x = 0
    return acts.map((a) => {
      const w = Math.max(a.kind === 'drive' ? a.durMin : Math.min(a.durMin, 120), 1)
      const s = { x0: x, x1: x + w, s0: a.socStart, s1: a.socEnd, drive: a.kind === 'drive' }
      x += w
      return s
    })
  })()
  const totalX = segs.length ? segs[segs.length - 1].x1 : 0
  const px = (x: number) => (x / (totalX || 1)) * CW
  const py = (soc: number) => CPT + (1 - soc / 100) * (CH - CPT - CPB)

  return (
    <div
      className="panel-anim"
      style={{ position: 'absolute', top: 14, left: 14, bottom: 14, width: 378, zIndex: 6, background: 'var(--panel)', border: '1px solid var(--border-chip)', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onClose}
          title={loc('close')}
          style={{ width: 34, height: 34, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--chip)', border: '1px solid var(--border-chip)', borderRadius: 10, cursor: 'pointer', color: 'var(--legend)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M9.5 3.5 L5 8 L9.5 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('tripSummary')}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dest}</div>
        </div>
        <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 600, color: 'var(--text-strong)' }}>{fmtHShort(driveMin + chargeMin)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{loc('total')}</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8 H12 M8.5 4.5 L12.5 8 L8.5 11.5" stroke="#7d9bf0" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{fmtHShort(driveMin)}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtInt(kmToUnit(distance, units))} {units} {loc('driving')}</div>
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="15" height="16" viewBox="0 0 12 14"><polygon points="7,0 0,8 5,8 4,14 12,5 6,5" fill="#3ecf8e" /></svg>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{fmtHShort(chargeMin)}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtInt(energy)} kWh · {loc('stopCount', { count: charges.length })}</div>
            </div>
          </div>
        </div>

        {segs.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px 9px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('batteryOverTrip')}</div>
              <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--legend)' }}>{originSoc}% → {destSoc}%</div>
            </div>
            <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" height="64" preserveAspectRatio="none">
              <line x1="0" y1={py(50)} x2={CW} y2={py(50)} stroke="var(--chart-grid)" strokeWidth="1" />
              {segs.map((s, i) => (
                <polyline
                  key={i}
                  points={`${px(s.x0).toFixed(1)},${py(s.s0).toFixed(1)} ${px(s.x1).toFixed(1)},${py(s.s1).toFixed(1)}`}
                  fill="none"
                  stroke={s.drive ? '#5f7fd6' : '#3ecf8e'}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: '#5f7fd6' }} />
                <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>{loc('driving')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: '#3ecf8e' }} />
                <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>{loc('charging')}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'relative', paddingLeft: 26 }}>
          <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 2, background: 'var(--timeline)' }} />

          <div style={{ position: 'relative', marginBottom: 4 }}>
            <span style={{ position: 'absolute', left: -22, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#e0223a', border: '3px solid var(--panel)', boxShadow: '0 0 0 2px rgba(224,34,58,0.5)' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{origin}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--legend)' }}>{originSoc}%</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{loc('departure')}</div>
          </div>

          {acts.map((a) => {
            if (a.kind === 'drive') {
              const dLo = Math.min(a.socStart, a.socEnd)
              const dHi = Math.max(a.socStart, a.socEnd)
              return (
                <div key={a.id} style={{ position: 'relative', margin: '2px 0 6px' }}>
                  <span style={{ position: 'absolute', left: -22, top: 14, width: 14, height: 14, borderRadius: '50%', background: '#4f6bc0', border: '3px solid var(--panel)', boxShadow: '0 0 0 2px rgba(79,107,192,0.4)' }} />
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 7, color: '#7d9bf0', background: 'rgba(125,155,240,0.14)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <svg width="11" height="11" viewBox="0 0 16 16"><path d="M2 8 H12 M8.5 4.5 L12.5 8 L8.5 11.5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {fmtInt(kmToUnit(a.km ?? 0, units))} {units}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {loc('drive')} · ↯ {Math.round(kmToUnit(a.maxKmh ?? 0, units))} {units === 'mi' ? 'mph' : 'km/h'}
                        </span>
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted)' }}>{fmtHShort(a.durMin)}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <div style={{ flex: 1, position: 'relative', height: 9, borderRadius: 5, background: 'var(--input)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${dLo}%`, width: `${dHi - dLo}%`, background: 'linear-gradient(90deg, #7d9bf0, rgba(125,155,240,0.35))', borderRadius: 5 }} />
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: 'var(--legend)', flex: '0 0 auto' }}>
                        {a.socStart}→{a.socEnd}%
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 600, color: '#7d9bf0', flex: '0 0 auto' }}>
                        −{Math.round(a.kWh)} kWh
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            const homeDest = a.category === 'home' || a.category === 'destination'
            const socLo = Math.min(a.socStart, a.socEnd)
            const socHi = Math.max(a.socStart, a.socEnd)
            return (
              <div key={a.id} style={{ position: 'relative', margin: '2px 0 6px' }}>
                <span style={{ position: 'absolute', left: -22, top: 14, width: 14, height: 14, borderRadius: '50%', background: homeDest ? '#7d9bf0' : '#2fbf82', border: '3px solid var(--panel)', boxShadow: `0 0 0 2px ${homeDest ? 'rgba(125,155,240,0.4)' : 'rgba(47,191,130,0.4)'}` }} />
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 7,
                          ...(homeDest
                            ? { color: '#7d9bf0', background: 'rgba(125,155,240,0.14)' }
                            : { color: '#04150e', background: '#3ecf8e' }),
                        }}
                      >
                        {Math.round(a.peakKw ?? 0)} kW
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {a.category === 'home' ? loc('homeAc') : a.category === 'destination' ? loc('destination') : loc('dcFast')}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted)' }}>{fmtHShort(a.durMin)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{ flex: 1, position: 'relative', height: 9, borderRadius: 5, background: 'var(--input)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${socLo}%`, width: `${socHi - socLo}%`, background: '#3ecf8e', borderRadius: 5 }} />
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: 'var(--legend)', flex: '0 0 auto' }}>
                      {a.socStart}→{a.socEnd}%
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 600, color: '#3ecf8e', flex: '0 0 auto' }}>
                      +{Math.round(a.kWh)} kWh
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div style={{ position: 'relative', marginTop: 4 }}>
            <span style={{ position: 'absolute', left: -23, top: 1, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-strong)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1v10M2 1.5h7l-1.5 2.2L9 6H2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" /></svg>
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{dest}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--legend)' }}>{destSoc}%</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{loc('arrival')}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button
          onClick={onFitRoute}
          className="hover-bright"
          style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', background: 'var(--chip-active)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 10, cursor: 'pointer' }}
        >
          {loc('fitRoute')}
        </button>
        <button
          onClick={share}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#fff', background: '#e0223a', border: 'none', borderRadius: 10, padding: 10, cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M11 5.5 L14 3 v5 M14 3 L8.5 8.5 M13 9v3.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {copied ? loc('copied') : loc('share')}
        </button>
      </div>
    </div>
  )
}
