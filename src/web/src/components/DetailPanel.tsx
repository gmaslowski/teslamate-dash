import { useEffect, useState } from 'react'
import { api, type ActivityDetail, type CurvePoint, type SeriesPoint } from '../api'
import { feedDate, fmtHShort, fmtInt, kmToUnit } from '../format'
import { loc } from '../localization'

type Props = {
  id: string
  units: 'km' | 'mi'
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

// Chart geometry mirrors the reference mock (viewBox 304×128).
const W = 304, H = 128, PL = 6, PR = 6, PT = 10, PB = 12
const IW = W - PL - PR, IH = H - PT - PB

// The three horizontal gridlines the mock draws.
const GRID_YS = [34, 70, 106]

function chargePaths(curve: CurvePoint[]) {
  const s0 = curve[0].soc
  const s1 = curve[curve.length - 1].soc
  const peak = Math.max(...curve.map((p) => p.kw))
  const scale = peak * 1.1 || 1
  const x = (soc: number) => PL + ((soc - s0) / (s1 - s0 || 1)) * IW
  const y = (kw: number) => PT + (1 - kw / scale) * IH
  const line = curve.map((p) => `${x(p.soc).toFixed(1)},${y(p.kw).toFixed(1)}`).join(' ')
  const area = `${PL},${PT + IH} ${line} ${PL + IW},${PT + IH}`
  const pk = curve.reduce((b, p) => (p.kw > b.kw ? p : b), curve[0])
  return { line, area, scale, markX: x(pk.soc).toFixed(1), markY: y(pk.kw).toFixed(1) }
}

function drivePaths(series: SeriesPoint[]) {
  const n = series.length
  const maxV = Math.max(...series.map((p) => p.speed), 1)
  const scale = maxV * 1.12
  const x = (i: number) => PL + (i / (n - 1 || 1)) * IW
  const y = (v: number) => PT + (1 - v / scale) * IH
  const ySoc = (s: number) => PT + (1 - s / 100) * IH
  const line = series.map((p, i) => `${x(i).toFixed(1)},${y(p.speed).toFixed(1)}`).join(' ')
  const area = `${PL},${PT + IH} ${line} ${PL + IW},${PT + IH}`
  const socLine = series.map((p, i) => `${x(i).toFixed(1)},${ySoc(p.soc).toFixed(1)}`).join(' ')
  return { line, area, scale, socLine }
}

// Value of the chart's primary axis at a gridline y (inverse of the y scale).
const gridValue = (gy: number, scale: number) => Math.round(scale * (1 - (gy - PT) / IH))
// The dashed SoC overlay is plotted on a fixed 0-100% scale.
const gridSoc = (gy: number) => Math.round(100 * (1 - (gy - PT) / IH))

const navBtn: React.CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--chip)', border: '1px solid var(--border-chip)', borderRadius: 9, cursor: 'pointer', color: 'var(--legend)',
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 11px 10px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 600, color: 'var(--text-strong)' }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  )
}

export default function DetailPanel({ id, units, onClose, onPrev, onNext }: Props) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    setDetail(null)
    setError(null)
    api
      .detail(id)
      .then((d) => !stale && setDetail(d))
      .catch((e) => !stale && setError(String(e)))
    return () => {
      stale = true
    }
  }, [id])

  const d = detail
  const isCharge = d?.kind === 'charge'
  const dist = (km: number) => (kmToUnit(km, units) >= 100 ? fmtInt(kmToUnit(km, units)) : kmToUnit(km, units).toFixed(1))
  const spd = (kmh: number) => Math.round(kmToUnit(kmh, units))
  const effFactor = units === 'mi' ? 1.60934 : 1
  const speedUnit = units === 'mi' ? 'mph' : 'km/h'

  let badge = ''
  let badgeColor = '#7d9bf0'
  let badgeBg = 'rgba(125,155,240,0.14)'
  if (d) {
    if (!isCharge) badge = loc('drive')
    else if (d.category === 'supercharger') {
      badge = loc('superchargerDc')
      badgeColor = '#3ecf8e'
      badgeBg = 'rgba(62,207,142,0.14)'
    } else badge = d.category === 'home' ? loc('homeAc') : loc('destinationAc')
  }

  const socLo = d ? Math.min(d.socStart, d.socEnd) : 0
  const socHi = d ? Math.max(d.socStart, d.socEnd) : 0

  const curve = isCharge && d?.curve && d.curve.length >= 2 ? chargePaths(d.curve) : null
  const series = !isCharge && d?.series && d.series.length >= 2 ? drivePaths(d.series) : null

  const socPer100 =
    d && !isCharge && d.km ? (((d.socStart - d.socEnd) / kmToUnit(d.km, units)) * 100).toFixed(1) : null

  return (
    <div
      className="panel-anim"
      style={{ position: 'absolute', top: 14, left: 14, bottom: 14, width: 366, zIndex: 6, background: 'var(--panel)', border: '1px solid var(--border-chip)', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title={loc('close')} style={{ ...navBtn, width: 34, height: 34, borderRadius: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M9.5 3.5 L5 8 L9.5 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {badge && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: badgeColor, background: badgeBg }}>{badge}</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{d ? feedDate(d.date) : ''}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d?.title ?? (error ? loc('notFound') : loc('loading'))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
          <button onClick={onPrev} title={loc('previous')} style={navBtn}>
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M9.5 3.5 L5 8 L9.5 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={onNext} title={loc('next')} style={navBtn}>
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M6.5 3.5 L11 8 L6.5 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        {error && <div style={{ fontSize: 12, color: '#e0223a', fontFamily: "'JetBrains Mono',monospace" }}>{error}</div>}
        {d && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 14 }}>
              {isCharge ? (
                <>
                  <StatCard label={loc('energy')} value={`+${d.kWh}`} unit="kWh" />
                  <StatCard label={loc('duration')} value={fmtHShort(d.durMin)} unit="" />
                  <StatCard label={loc('rangeAdded')} value={fmtInt(kmToUnit(d.rangeAddedKm ?? 0, units))} unit={units} />
                  <StatCard label={loc('peak')} value={Math.round(d.peakKw ?? 0)} unit="kW" />
                  <StatCard label={loc('average')} value={Math.round(d.avgKw ?? 0)} unit="kW" />
                  <StatCard label={loc('minimum')} value={Math.round(d.minKw ?? 0)} unit="kW" />
                </>
              ) : (
                <>
                  <StatCard label={loc('distance')} value={dist(d.km ?? 0)} unit={units} />
                  <StatCard label={loc('duration')} value={fmtHShort(d.durMin)} unit="" />
                  <StatCard label={loc('averageSpeed')} value={spd(d.avgKmh ?? 0)} unit={speedUnit} />
                  <StatCard label={loc('topSpeed')} value={spd(d.maxKmh ?? 0)} unit={speedUnit} />
                  <StatCard label={loc('energy')} value={d.kWh} unit="kWh" />
                  <StatCard label={loc('efficiency')} value={Math.round((d.effWhKm ?? 0) * effFactor)} unit={`Wh/${units}`} />
                </>
              )}
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('stateOfCharge')}</div>
                <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--legend)' }}>
                  {d.socStart}% → {d.socEnd}%
                </div>
              </div>
              <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'var(--input)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${socLo}%`, width: `${socHi - socLo}%`, background: isCharge ? '#3ecf8e' : '#7d9bf0', borderRadius: 6 }} />
              </div>
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 13px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {isCharge ? loc('chargingCurve') : loc('speedAndBattery')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>
                  {isCharge ? loc('powerVsSoc') : socPer100 != null ? loc('socPerDistance', { soc: socPer100, unit: units }) : ''}
                </div>
              </div>
              {curve || series ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="140" preserveAspectRatio="none" style={{ display: 'block' }}>
                      <defs>
                        <linearGradient id="fillCharge" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#3ecf8e" stopOpacity="0.34" />
                          <stop offset="1" stopColor="#3ecf8e" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="fillSpeed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#5f7fd6" stopOpacity="0.34" />
                          <stop offset="1" stopColor="#5f7fd6" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {GRID_YS.map((gy) => (
                        <line key={gy} x1="6" y1={gy} x2="298" y2={gy} stroke="var(--chart-grid)" strokeWidth="1" />
                      ))}
                      <polygon points={(curve ?? series)!.area} fill={curve ? 'url(#fillCharge)' : 'url(#fillSpeed)'} />
                      <polyline points={(curve ?? series)!.line} fill="none" stroke={curve ? '#3ecf8e' : '#5f7fd6'} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                      {series && (
                        <polyline points={series.socLine} fill="none" stroke="#e6a94f" strokeWidth="1.7" strokeDasharray="4 3" strokeLinejoin="round" />
                      )}
                      {curve && <circle cx={curve.markX} cy={curve.markY} r="3.6" fill="#fff" stroke="#3ecf8e" strokeWidth="2" />}
                    </svg>
                    {/* Y-axis values at the gridlines. The svg stretches, so labels
                        live in HTML: primary axis (kW / speed) on the left, the
                        dashed SoC scale on the right for drives. */}
                    {GRID_YS.map((gy, i) => {
                      const scale = (curve ?? series)!.scale
                      const v = curve ? gridValue(gy, scale) : Math.round(kmToUnit(gridValue(gy, scale), units))
                      const unit = i === 0 ? (curve ? ' kW' : ` ${units === 'mi' ? 'mph' : 'km/h'}`) : ''
                      return (
                        <span
                          key={gy}
                          style={{ position: 'absolute', left: 4, top: (gy / H) * 140, transform: 'translateY(-100%)', fontSize: 8.5, fontFamily: "'JetBrains Mono',monospace", color: 'var(--faint)', pointerEvents: 'none' }}
                        >
                          {v}{unit}
                        </span>
                      )
                    })}
                    {series &&
                      GRID_YS.map((gy, i) => (
                        <span
                          key={`soc${gy}`}
                          style={{ position: 'absolute', right: 4, top: (gy / H) * 140, transform: 'translateY(-100%)', fontSize: 8.5, fontFamily: "'JetBrains Mono',monospace", color: '#e6a94f', opacity: 0.85, pointerEvents: 'none' }}
                        >
                          {gridSoc(gy)}{i === 0 ? '%' : ''}
                        </span>
                      ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: 'var(--faint)' }}>
                    <span>{isCharge ? `${d.socStart}%` : loc('start')}</span>
                    <span>{isCharge ? `${d.socEnd}%` : loc('end')}</span>
                  </div>
                  {series && (
                    <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 3, borderRadius: 2, background: '#5f7fd6' }} />
                        <span style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{loc('speed')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 0, borderTop: '2px dashed #e6a94f' }} />
                        <span style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{loc('battery')}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'JetBrains Mono',monospace", padding: '20px 0' }}>
                  {isCharge ? loc('noChargeSamples') : loc('noDriveSamples')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
