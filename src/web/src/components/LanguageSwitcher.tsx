import { useEffect, useRef, useState } from 'react'
import { currentLanguage, languages, loc, setLanguage } from '../localization'

export default function LanguageSwitcher() {
  const current = currentLanguage
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        title={loc('selectLanguage')}
        aria-label={loc('selectLanguage')}
        aria-haspopup="true"
        aria-expanded={open}
        style={{ height: 36, minWidth: 48, padding: '0 9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'var(--chip)', border: '1px solid var(--border-faint)', borderRadius: 10, cursor: 'pointer', color: 'var(--muted-2)' }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.3 8h11.4M8 2c1.7 1.7 2.6 3.7 2.6 6S9.7 12.3 8 14M8 2C6.3 3.7 5.4 5.7 5.4 8s.9 4.3 2.6 6" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' }}>{current}</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 206, maxHeight: 'calc(100vh - 82px)', overflowY: 'auto', background: 'var(--popover)', border: '1px solid var(--border-strong)', borderRadius: 13, padding: 6, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 50 }}>
          <div style={{ padding: '7px 9px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{loc('selectLanguage')}</div>
          {languages.map((language) => {
            const active = language.code === current
            return (
              <button
                key={language.code}
                onClick={() => {
                  setLanguage(language.code)
                  setOpen(false)
                }}
                aria-pressed={active}
                className={active ? undefined : 'row-hover'}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', color: active ? 'var(--text-strong)' : 'var(--legend)', background: active ? 'var(--row-active)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ width: 26, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: active ? '#e0223a' : 'var(--muted)' }}>{language.code}</span>
                <span lang={language.code} style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 600 : 500 }}>{language.label}</span>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 6.3 4.8 8.6 9.5 3.7" stroke="#e0223a" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
