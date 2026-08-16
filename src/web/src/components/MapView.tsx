import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import type { Activity } from '../api'
import { kmToUnit } from '../format'
import { loc } from '../localization'

export type MapHandle = {
  focusVisible: () => void
}

type Props = {
  styleUrl: string
  /** the fetched dataset (streams in page by page) */
  allActivities: Activity[]
  /** bumped when a re-fit is wanted: first page of a new range, and again when history finishes */
  fitVersion: number
  /** what the map actually shows (filters + selection applied) */
  visible: Activity[]
  /** history pages are still streaming in */
  loading: boolean
  hasSelection: boolean
  showBadge: boolean
  selSummary: string
  units: 'km' | 'mi'
  /** activity whose detail panel is open — its marker gets the active ring */
  detailId: string | null
  /** a detail/trip panel is overlaying the left side of the map */
  panelOpen: boolean
  onOpenDetail: (id: string) => void
  children?: ReactNode
}

type Bounds = [[number, number], [number, number]]

function boundsOf(acts: Activity[]): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  for (const a of acts) {
    if (a.kind === 'drive') a.coords?.forEach((c) => add(c[0], c[1]))
    else if (a.pt) add(a.pt[0], a.pt[1])
  }
  if (!isFinite(minX)) return null
  return [[minX, minY], [maxX, maxY]]
}

// Route segments carry their activity id so a map click can open the panel.
function routeFeatures(acts: Activity[]): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = []
  for (const a of acts) {
    if (a.kind !== 'drive' || !a.coords || a.coords.length < 2) continue
    for (let i = 0; i < a.coords.length - 1; i++) {
      const p = a.coords[i]
      const q = a.coords[i + 1]
      out.push({
        type: 'Feature',
        properties: { speed: Math.max(p[2] ?? 0, q[2] ?? 0), aid: a.id },
        geometry: { type: 'LineString', coordinates: [[p[0], p[1]], [q[0], q[1]]] },
      })
    }
  }
  return out
}

function chargeMarkerEl(a: Activity, active: boolean): HTMLDivElement {
  const homeDest = a.category === 'home' || a.category === 'destination'
  const color = homeDest ? '#7d9bf0' : '#2fbf82'
  const halo = active ? 'rgba(224,34,58,0.5)' : homeDest ? 'rgba(125,155,240,0.18)' : 'rgba(47,191,130,0.18)'
  const size = active ? 30 : 26
  const el = document.createElement('div')
  el.className = 'cluster'
  el.title = a.title
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:${active ? 3 : 2.5}px solid #fff;box-shadow:0 3px 10px rgba(20,80,120,0.4),0 0 0 ${active ? 6 : 5}px ${halo};cursor:pointer`
  el.innerHTML = '<svg width="12" height="14" viewBox="0 0 12 14"><polygon points="7,0 0,8 5,8 4,14 12,5 6,5" fill="#fff"/></svg>'
  return el
}

function endpointEl(color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `width:15px;height:15px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)`
  return el
}

const MapView = forwardRef<MapHandle, Props>(function MapView(
  { styleUrl, allActivities, fitVersion, visible, loading, hasSelection, showBadge, selSummary, units, detailId, panelOpen, onOpenDetail, children },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const allRef = useRef(allActivities)
  allRef.current = allActivities
  const hasSelectionRef = useRef(hasSelection)
  hasSelectionRef.current = hasSelection
  const detailIdRef = useRef(detailId)
  detailIdRef.current = detailId
  const panelOpenRef = useRef(panelOpen)
  panelOpenRef.current = panelOpen
  const onOpenDetailRef = useRef(onOpenDetail)
  onOpenDetailRef.current = onOpenDetail

  // Panels overlay the left ~380px of the map; pad fits so routes stay visible.
  const fitPadding = (base: number) => ({
    top: base, bottom: base, right: base,
    left: panelOpenRef.current ? 410 : base,
  })

  // Single fit path for every trigger, so map-load vs data-arrival ordering
  // doesn't matter: whichever side is ready last completes the pending fit.
  // The first fit is instant and frames whatever the map is showing — a
  // shared/featured selection included; later fits animate to the full
  // dataset and never override a selection the user is presenting.
  const didFitRef = useRef(false)
  const pendingFitRef = useRef(false)
  const fitNow = () => {
    const map = mapRef.current
    if (!map || !loadedRef.current) {
      pendingFitRef.current = true
      return
    }
    if (didFitRef.current && hasSelectionRef.current) return
    const b = boundsOf(hasSelectionRef.current ? visibleRef.current : allRef.current)
    if (!b) {
      pendingFitRef.current = true
      return
    }
    pendingFitRef.current = false
    const first = !didFitRef.current
    didFitRef.current = true
    map.fitBounds(b, { padding: fitPadding(60), duration: first ? 0 : 700 })
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [10, 50],
      zoom: 3.5,
      attributionControl: false,
      dragRotate: false,
    })
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': 3.6,
          'line-color': ['interpolate', ['linear'], ['get', 'speed'], 30, '#a9c0dd', 85, '#4f6bc0', 150, '#1b2b74'],
        },
      })
      map.on('click', 'route-line', (e) => {
        const aid = e.features?.[0]?.properties?.aid as string | undefined
        if (aid) onOpenDetailRef.current(aid)
      })
      map.on('mouseenter', 'route-line', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'route-line', () => { map.getCanvas().style.cursor = '' })
      // Test/debug hook (see __dash below).
      ;(window as unknown as Record<string, unknown>).__dashMap = map
      loadedRef.current = true
      render(visibleRef.current, hasSelectionRef.current, detailIdRef.current)
      fitNow()
    })
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function render(acts: Activity[], sel: boolean, activeId: string | null) {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: routeFeatures(acts) })

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    for (const a of acts) {
      if (a.kind === 'charge' && a.pt) {
        const el = chargeMarkerEl(a, a.id === activeId)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          onOpenDetailRef.current(a.id)
        })
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([a.pt[0], a.pt[1]]).addTo(map),
        )
      }
    }
    if (!sel) {
      // Feed is newest first: journey start is the oldest drive, latest
      // position is the newest drive's end.
      const drives = acts.filter((a) => a.kind === 'drive' && a.coords && a.coords.length >= 2)
      const oldest = drives[drives.length - 1]
      const newest = drives[0]
      if (oldest?.coords) {
        const c = oldest.coords[0]
        markersRef.current.push(new maplibregl.Marker({ element: endpointEl('#e0223a') }).setLngLat([c[0], c[1]]).addTo(mapRef.current!))
      }
      if (newest?.coords) {
        const c = newest.coords[newest.coords.length - 1]
        markersRef.current.push(new maplibregl.Marker({ element: endpointEl('#111318') }).setLngLat([c[0], c[1]]).addTo(mapRef.current!))
      }
    }
    // Test/debug hook: lets headless checks read what the map shows without
    // racing the WebGL worker.
    ;(window as unknown as Record<string, unknown>).__dash = {
      routeFeatures: routeFeatures(acts).length,
      markers: markersRef.current.length,
      visible: acts.length,
      hasSelection: sel,
      detailId: activeId,
      ids: acts.map((a) => a.id),
    }
  }

  useEffect(() => {
    render(visible, hasSelection, detailId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasSelection, detailId])

  // Re-fit when App asks for it (new range's first page, or history finished
  // streaming) — not on every appended page.
  useEffect(() => {
    fitNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitVersion])

  useImperativeHandle(ref, () => ({
    focusVisible() {
      const b = boundsOf(visibleRef.current)
      if (b && mapRef.current) mapRef.current.fitBounds(b, { padding: fitPadding(90), duration: 700, maxZoom: 9 })
    },
  }))

  const glass: React.CSSProperties = {
    background: 'var(--glass)',
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
  }

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 0, background: '#dfe3ea' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {loading && (
        <div style={{ ...glass, position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 11, padding: '8px 14px' }}>
          <svg className="spin" width="14" height="14" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" stroke="var(--muted)" strokeWidth="2.2" fill="none" opacity="0.35" />
            <path d="M8 2 a6 6 0 0 1 6 6" stroke="#e0223a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{loc('loadingHistory')}</span>
        </div>
      )}

      {showBadge && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(224,34,58,0.94)', borderRadius: 11, padding: '8px 14px', boxShadow: '0 6px 22px rgba(0,0,0,0.28)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.35)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{loc('presentationView')} · {selSummary}</span>
        </div>
      )}

      {children}

      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2 }}>
        <div style={{ ...glass, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid var(--glass-divider)', cursor: 'pointer', color: 'var(--text)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </div>
        <button
          onClick={() => {
            const b = boundsOf(visibleRef.current)
            if (b && mapRef.current) mapRef.current.fitBounds(b, { padding: fitPadding(60), duration: 700 })
          }}
          title={loc('fitRoute')}
          style={{ ...glass, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, cursor: 'pointer', color: 'var(--text)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ ...glass, position: 'absolute', bottom: 16, right: 16, zIndex: 2, borderRadius: 14, padding: '14px 16px', minWidth: 186 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: '#4f6bc0' }} />
            <span style={{ fontSize: 11.5, color: 'var(--legend)' }}>{loc('drives')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#3ecf8e', boxShadow: '0 0 0 3px rgba(62,207,142,0.22)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--legend)' }}>{loc('charging')}</span>
          </div>
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{loc('topSpeed')}</div>
        <div style={{ height: 7, borderRadius: 4, background: 'linear-gradient(90deg,#a9c0dd,#4f6bc0,#1b2b74)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: 'var(--muted)' }}>
          <span>{Math.round(kmToUnit(30, units))}</span>
          <span>{Math.round(kmToUnit(150, units))} {units === 'mi' ? 'mph' : 'km/h'}</span>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 2, fontSize: 10, color: '#5a6070', fontFamily: "'JetBrains Mono',monospace", background: 'rgba(255,255,255,0.7)', padding: '3px 8px', borderRadius: 6 }}>
        MapLibre · OpenFreeMap © OpenStreetMap
      </div>
    </div>
  )
})

export default MapView
