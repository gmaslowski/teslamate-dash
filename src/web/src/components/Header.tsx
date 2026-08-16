import { useEffect, useRef, useState } from 'react'
import type { Car } from '../api'
import type { Theme } from '../App'
import { daysAgo, isoDay, type RangeKey } from '../format'
import { loc } from '../localization'
import LanguageSwitcher from './LanguageSwitcher'

type Props = {
  cars: Car[]
  carId: number | null
  onPickCar: (id: number) => void
  range: RangeKey
  onPickRange: (r: RangeKey) => void
  applied: { from: string; to: string }
  onApplyCustom: (from: string, to: string) => void
  theme: Theme
  onToggleTheme: () => void
}

const RANGES: Array<[RangeKey, string]> = [
  ['all', loc('all')],
  ['1y', loc('oneYear')],
  ['90d', loc('ninetyDays')],
  ['30d', loc('thirtyDays')],
]

const QUICK: Array<[string, number]> = [
  [loc('thisWeek'), 7],
  [loc('thisMonth'), 30],
  [loc('thisTrip'), 18],
]

export default function Header({ cars, carId, onPickCar, range, onPickRange, applied, onApplyCustom, theme, onToggleTheme }: Props) {
  const [showCars, setShowCars] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [from, setFrom] = useState(applied.from)
  const [to, setTo] = useState(applied.to)
  const customRef = useRef<HTMLDivElement>(null)
  const carsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false)
      if (carsRef.current && !carsRef.current.contains(e.target as Node)) setShowCars(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const car = cars.find((c) => c.id === carId)
  const custom = range === 'custom'
  const segBase: React.CSSProperties = { fontSize: 12, border: 'none', borderRadius: 8, padding: '7px 15px', cursor: 'pointer' }

  return (
    <header style={{ flex: '0 0 auto', height: 62, display: 'flex', alignItems: 'center', gap: 22, padding: '0 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', zIndex: 20, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: '#e0223a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(224,34,58,0.4)' }}>
          <svg width="12" height="14" viewBox="0 0 12 14"><polygon points="7,0 0,8 5,8 4,14 12,5 6,5" fill="#fff" /></svg>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.14em', color: 'var(--text-strong)' }}>
          TESLAMATE<span style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: 7 }}>DASH</span>
        </div>
      </div>

      <div ref={carsRef} style={{ position: 'relative' }}>
        <div
          onClick={() => cars.length > 1 && setShowCars((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', background: 'var(--chip)', border: '1px solid var(--border-faint)', borderRadius: 10, cursor: cars.length > 1 ? 'pointer' : 'default' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', boxShadow: '0 0 8px rgba(62,207,142,0.6)' }} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--title)' }}>{car?.name || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{car?.model || ''}</div>
          </div>
          {cars.length > 1 && (
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2 }}>
              <path d="M2 3.5 L5 6.5 L8 3.5" stroke="var(--muted)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>
        {showCars && (
          <div style={{ position: 'absolute', top: 48, left: 0, minWidth: 180, background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 40 }}>
            {cars.map((c) => (
              <div
                key={c.id}
                className="row-hover"
                onClick={() => {
                  onPickCar(c.id)
                  setShowCars(false)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.id === carId ? '#3ecf8e' : 'var(--border-check)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--title)' }}>{c.name || loc('carFallback', { id: c.id })}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{c.model || ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--chip)', border: '1px solid var(--border-faint)', borderRadius: 11, padding: 3 }}>
        {RANGES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onPickRange(key)}
            style={{
              ...segBase,
              ...(range === key
                ? { fontWeight: 600, color: '#fff', background: '#e0223a' }
                : { fontWeight: 500, color: 'var(--muted-2)', background: 'transparent' }),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={customRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowCustom((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 500, borderRadius: 11, padding: '8px 13px', cursor: 'pointer',
            ...(custom
              ? { color: '#fff', background: '#e0223a', border: '1px solid #e0223a' }
              : { color: 'var(--legend)', background: 'var(--chip)', border: '1px solid var(--border-faint)' }),
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: 0.8 }}>
            <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>{custom ? `${applied.from} → ${applied.to}` : loc('custom')}</span>
        </button>

        {showCustom && (
          <div style={{ position: 'absolute', top: 44, right: 0, width: 288, background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 14, padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>{loc('customRange')}</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {(
                [
                  [loc('from'), from, setFrom],
                  [loc('to'), to, setTo],
                ] as Array<[string, string, (v: string) => void]>
              ).map(([label, value, set]) => (
                <label key={label} style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{label}</span>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '8px 9px', color: 'var(--title)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {QUICK.map(([label, days]) => (
                <button
                  key={label}
                  className="hover-bright"
                  onClick={() => {
                    setFrom(isoDay(daysAgo(days)))
                    setTo(isoDay(new Date()))
                  }}
                  style={{ fontSize: 11, color: 'var(--legend)', background: 'var(--chip-active)', border: '1px solid var(--border-faint)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowCustom(false)}
                style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--muted-2)', background: 'transparent', border: '1px solid var(--border-input)', borderRadius: 9, padding: 9, cursor: 'pointer' }}
              >
                {loc('cancel')}
              </button>
              <button
                onClick={() => {
                  onApplyCustom(from, to)
                  setShowCustom(false)
                }}
                style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#fff', background: '#e0223a', border: 'none', borderRadius: 9, padding: 9, cursor: 'pointer' }}
              >
                {loc('apply')}
              </button>
            </div>
          </div>
        )}
      </div>

      <LanguageSwitcher />

      <button
        onClick={onToggleTheme}
        title={theme === 'dark' ? loc('switchToLight') : loc('switchToDark')}
        style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--chip)', border: '1px solid var(--border-faint)', borderRadius: 10, cursor: 'pointer' }}
      >
        {theme === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="2.2" stroke="var(--muted-2)" strokeWidth="1.4" fill="none" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="var(--muted-2)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" stroke="var(--muted-2)" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </header>
  )
}
