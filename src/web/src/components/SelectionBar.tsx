import { fmtInt, kmToUnit } from '../format'
import { loc } from '../localization'

type Props = {
  hasSel: boolean
  summary: string
  km: number
  units: 'km' | 'mi'
  onClear: () => void
  onFocus: () => void
  onTrip: () => void
}

export default function SelectionBar({ hasSel, summary, km, units, onClear, onFocus, onTrip }: Props) {
  return (
    <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border)', padding: '11px 16px' }}>
      {hasSel ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--title)' }}>{summary}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>
                {km > 0 ? loc('distanceOnMap', { distance: fmtInt(kmToUnit(km, units)), unit: units }) : loc('chargingStopsOnly')}
              </div>
            </div>
            <button
              onClick={onClear}
              style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--muted-2)', background: 'transparent', border: '1px solid var(--border-input)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer' }}
            >
              {loc('clear')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onFocus}
              className="hover-bright"
              style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--text)', background: 'var(--chip-active)', border: '1px solid var(--border-strong)', borderRadius: 9, padding: 9, cursor: 'pointer' }}
            >
              {loc('focusMap')}
            </button>
            <button
              onClick={onTrip}
              style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: '#fff', background: '#e0223a', border: 'none', borderRadius: 9, padding: 9, cursor: 'pointer', boxShadow: '0 2px 10px rgba(224,34,58,0.35)' }}
            >
              {loc('tripSummary')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--faint)' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" style={{ flex: '0 0 auto' }}>
            <path d="M3 8s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <circle cx="8" cy="8" r="1.7" fill="currentColor" />
          </svg>
          <div style={{ fontSize: 11.5, lineHeight: 1.35 }}>
            {loc('selectionHint')}
          </div>
        </div>
      )}
    </div>
  )
}
