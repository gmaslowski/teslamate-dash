import type { Activity } from '../api'
import type { TypeFilter } from '../App'
import { feedDate } from '../format'
import { loc } from '../localization'

type Props = {
  activities: Activity[]
  selected: Set<string>
  detailId: string | null
  onToggle: (id: string, idx: number, shift: boolean) => void
  onOpen: (id: string) => void
  typeFilter: TypeFilter
  onTypeFilter: (t: TypeFilter) => void
  hideHomeDest: boolean
  onToggleHide: () => void
  allSelected: boolean
  onToggleSelectAll: () => void
  historyLoading: boolean
  error: string | null
}

const TYPES: Array<[TypeFilter, string]> = [
  ['all', loc('all')],
  ['drive', loc('drives')],
  ['charge', loc('charging')],
]

export default function ActivityFeed(p: Props) {
  const chip: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }

  return (
    <>
      <div style={{ flex: '0 0 auto', padding: '4px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('recentActivity')}</div>
          <button
            onClick={p.onToggleSelectAll}
            style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-2)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {p.allSelected ? loc('clearAll') : loc('selectAll')}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {TYPES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => p.onTypeFilter(key)}
              style={{
                ...chip,
                ...(p.typeFilter === key
                  ? { color: 'var(--type-active-text)', background: 'var(--type-active)', border: '1px solid var(--border-type-active)' }
                  : { color: 'var(--muted-2)', background: 'transparent', border: '1px solid var(--border-chip)' }),
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={p.onToggleHide}
            title={loc('hideHomeDestination')}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer',
              ...(p.hideHomeDest
                ? { color: '#fff', background: '#e0223a', border: '1px solid #e0223a' }
                : { color: 'var(--muted-2)', background: 'transparent', border: '1px solid var(--border-chip)' }),
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16">
              <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <circle cx="8" cy="8" r="1.6" fill="currentColor" />
              {p.hideHomeDest && <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {p.error && (
          <div style={{ padding: '10px 11px', fontSize: 12, color: '#e0223a', fontFamily: "'JetBrains Mono',monospace" }}>{p.error}</div>
        )}
        {p.activities.map((a, idx) => {
          const isCharge = a.kind === 'charge'
          const sel = p.selected.has(a.id)
          const active = p.detailId === a.id
          return (
            <div
              key={a.id}
              className={sel || active ? undefined : 'row-hover'}
              style={{
                display: 'flex', gap: 11, alignItems: 'center', padding: '10px 11px', borderRadius: 12, cursor: 'pointer', transition: 'background .12s',
                ...(active
                  ? { background: 'var(--row-active)', boxShadow: 'inset 0 0 0 1px var(--row-active-border)' }
                  : sel
                    ? { background: 'rgba(224,34,58,0.10)', boxShadow: 'inset 0 0 0 1px rgba(224,34,58,0.35)' }
                    : {}),
              }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  p.onToggle(a.id, idx, e.shiftKey)
                }}
                style={{
                  flex: '0 0 auto', width: 18, height: 18, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  ...(sel
                    ? { background: '#e0223a', border: '1px solid #e0223a' }
                    : { background: 'transparent', border: '1.5px solid var(--border-check)' }),
                }}
              >
                {sel && (
                  <svg width="11" height="11" viewBox="0 0 12 12">
                    <path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div
                onClick={() => p.onOpen(a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, cursor: 'pointer' }}
              >
                <div
                  style={{
                    flex: '0 0 auto', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCharge ? 'rgba(62,207,142,0.14)' : 'rgba(95,127,214,0.16)',
                  }}
                >
                  {isCharge ? (
                    <svg width="13" height="15" viewBox="0 0 12 14"><polygon points="7,0 0,8 5,8 4,14 12,5 6,5" fill="#3ecf8e" /></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 16 16">
                      <path d="M2 8 H12 M8.5 4.5 L12.5 8 L8.5 11.5" stroke="#7d9bf0" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{a.sub}</div>
                </div>
                <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: isCharge ? '#3ecf8e' : 'var(--title)' }}>{a.right}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-3)' }}>{feedDate(a.date)}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ flex: '0 0 auto', opacity: 0.42 }}>
                  <path d="M6 3.5 L10.5 8 L6 12.5" stroke="var(--legend)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )
        })}
        {!p.error && !p.activities.length && !p.historyLoading && (
          <div style={{ padding: '14px 11px', fontSize: 12, color: 'var(--faint)' }}>{loc('noActivity')}</div>
        )}
        {p.historyLoading && (
          <div style={{ padding: '10px 11px', fontSize: 11, color: 'var(--faint)', fontFamily: "'JetBrains Mono',monospace" }}>
            {loc('loadingOlderActivity')}
          </div>
        )}
      </div>
    </>
  )
}
