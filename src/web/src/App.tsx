import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Activity, type AppConfig, type Car, type Summary, type Window } from './api'
import { daysAgo, isoDay, rangeLabel, type RangeKey } from './format'
import { loc } from './localization'
import Header from './components/Header'
import KpiGrid from './components/KpiGrid'
import ActivityFeed from './components/ActivityFeed'
import SelectionBar from './components/SelectionBar'
import MapView, { type MapHandle } from './components/MapView'
import DetailPanel from './components/DetailPanel'
import TripSummary from './components/TripSummary'

const FEED_LIMIT = 200

export type TypeFilter = 'all' | 'drive' | 'charge'

function computeWindow(range: RangeKey, from: string, to: string): Window {
  switch (range) {
    case 'all':
      return {}
    case '1y':
      return { from: isoDay(daysAgo(365)) }
    case '90d':
      return { from: isoDay(daysAgo(90)) }
    case '30d':
      return { from: isoDay(daysAgo(30)) }
    case 'custom':
      return { from, to }
  }
}

export type Theme = 'dark' | 'light'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('tc-theme') === 'light' ? 'light' : 'dark',
  )
  const [cars, setCars] = useState<Car[]>([])
  const [carId, setCarId] = useState<number | null>(null)

  const [range, setRange] = useState<RangeKey>('all')
  const [applied, setApplied] = useState({ from: isoDay(daysAgo(18)), to: isoDay(new Date()) })

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [hideHomeDest, setHideHomeDest] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showTrip, setShowTrip] = useState(false)
  // Shift-click range-select: the last plainly-clicked row is the anchor.
  const anchorRef = useRef<number | null>(null)
  // ?sel=d1,c2 from a shared link is applied once, after the feed loads.
  const pendingShareRef = useRef<string[] | null>(
    new URLSearchParams(location.search).get('sel')?.split(',').filter(Boolean) ?? null,
  )
  // Without a shared link, the server's featured selection (demo mode's
  // showcase trip) is preselected once on the first feed load.
  const featuredDoneRef = useRef(false)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [fitVersion, setFitVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mapRef = useRef<MapHandle>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tc-theme', theme)
  }, [theme])

  useEffect(() => {
    Promise.all([api.config(), api.cars()])
      .then(([cfg, cs]) => {
        setConfig(cfg)
        document.title = cfg.title
        setCars(cs)
        setCarId(cs.length ? cs[0].id : null)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const win = useMemo(
    () => computeWindow(range, applied.from, applied.to),
    [range, applied],
  )

  // Fetch the summary plus the FULL feed for the range: the first page renders
  // immediately, then older pages stream in until the range is exhausted, so
  // All / 1Y really show everything. Each page is cursor-keyed (before=) and
  // served from the backend's short TTL cache on repeat visits.
  useEffect(() => {
    if (!config) return
    let stale = false
    setError(null)
    setHistoryLoading(true)
    ;(async () => {
      try {
        const [s, first] = await Promise.all([api.summary(carId, win), api.activities(carId, win)])
        if (stale) return
        setSummary(s)
        setActivities(first)
        setFitVersion((v) => v + 1)
        if (pendingShareRef.current) {
          setSelected(pendingShareRef.current)
          pendingShareRef.current = null
          featuredDoneRef.current = true
        } else if (!featuredDoneRef.current) {
          featuredDoneRef.current = true
          if (config.featured_sel?.length) setSelected(config.featured_sel)
        }

        let all = first
        let page = first
        while (page.length === FEED_LIMIT) {
          const more = await api.activities(carId, win, page[page.length - 1].date)
          if (stale) return
          const seen = new Set(all.map((a) => a.id))
          const fresh = more.filter((a) => !seen.has(a.id))
          if (!fresh.length) break
          all = [...all, ...fresh]
          setActivities(all)
          page = more
        }
        if (all.length > first.length) setFitVersion((v) => v + 1)
      } catch (e) {
        if (!stale) setError(String(e))
      } finally {
        if (!stale) setHistoryLoading(false)
      }
    })()
    return () => {
      stale = true
    }
  }, [config, carId, win])

  const units = config?.units ?? 'km'

  // Global filters (type + hide home/destination) drive both list and map.
  const filtered = useMemo(
    () =>
      activities.filter((a) => {
        if (typeFilter === 'drive' && a.kind !== 'drive') return false
        if (typeFilter === 'charge' && a.kind !== 'charge') return false
        if (hideHomeDest && a.kind === 'charge' && (a.category === 'home' || a.category === 'destination'))
          return false
        return true
      }),
    [activities, typeFilter, hideHomeDest],
  )

  // Selection isolates the map: any selection means only those activities show.
  const selSet = useMemo(() => new Set(selected), [selected])
  const visibleSelection = useMemo(() => filtered.filter((a) => selSet.has(a.id)), [filtered, selSet])
  const mapActs = visibleSelection.length ? visibleSelection : filtered
  const hasSel = visibleSelection.length > 0

  const nDrives = visibleSelection.filter((a) => a.kind === 'drive').length
  const nCharges = visibleSelection.filter((a) => a.kind === 'charge').length
  const selKm = visibleSelection.reduce((t, a) => t + (a.km ?? 0), 0)
  const selParts: string[] = []
  if (nDrives) selParts.push(loc('driveCount', { count: nDrives }))
  if (nCharges) selParts.push(loc('chargeCount', { count: nCharges }))
  const selSummary = selParts.join(' · ') || loc('nothingSelected')

  // Plain click toggles one row and sets the anchor; shift-click adds the
  // whole anchor→target range to the selection (additive).
  const toggle = (id: string, idx: number, shift: boolean) => {
    if (shift && anchorRef.current != null && anchorRef.current < filtered.length) {
      const lo = Math.min(anchorRef.current, idx)
      const hi = Math.max(anchorRef.current, idx)
      const rangeIds = filtered.slice(lo, hi + 1).map((a) => a.id)
      setSelected((cur) => Array.from(new Set([...cur, ...rangeIds])))
      return
    }
    anchorRef.current = idx
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }
  const allSelected = filtered.length > 0 && filtered.every((a) => selSet.has(a.id))

  const openDetail = (id: string) => {
    setDetailId(id)
    setShowTrip(false)
  }
  const stepDetail = (dir: number) => {
    const i = filtered.findIndex((a) => a.id === detailId)
    if (i < 0 || !filtered.length) return
    setDetailId(filtered[(i + dir + filtered.length) % filtered.length].id)
  }
  const panelOpen = detailId != null || showTrip

  // Trip itinerary wants chronological order (feed is newest first).
  const tripActs = useMemo(
    () => [...visibleSelection].sort((a, b) => a.date.localeCompare(b.date)),
    [visibleSelection],
  )

  const pickCar = (id: number) => {
    if (id === carId) return
    setCarId(id)
    setSelected([])
    setDetailId(null)
    setShowTrip(false)
    anchorRef.current = null
  }

  if (!config) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontSize: 13 }}>
        {error ?? loc('loading')}
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header
        cars={cars}
        carId={carId}
        onPickCar={pickCar}
        range={range}
        onPickRange={setRange}
        applied={applied}
        onApplyCustom={(from, to) => {
          setApplied({ from, to })
          setRange('custom')
        }}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside style={{ flex: '0 0 auto', width: 384, background: 'var(--panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <KpiGrid
            summary={summary}
            units={units}
            label={rangeLabel(range, applied.from, applied.to, activities)}
          />
          <ActivityFeed
            activities={filtered}
            selected={selSet}
            detailId={detailId}
            onToggle={toggle}
            onOpen={openDetail}
            typeFilter={typeFilter}
            onTypeFilter={setTypeFilter}
            hideHomeDest={hideHomeDest}
            onToggleHide={() => setHideHomeDest((v) => !v)}
            allSelected={allSelected}
            onToggleSelectAll={() =>
              setSelected(allSelected ? [] : filtered.map((a) => a.id))
            }
            historyLoading={historyLoading}
            error={error}
          />
          <SelectionBar
            hasSel={hasSel}
            summary={selSummary}
            km={selKm}
            units={units}
            onClear={() => setSelected([])}
            onFocus={() => mapRef.current?.focusVisible()}
            onTrip={() => {
              setShowTrip(true)
              setDetailId(null)
            }}
          />
        </aside>

        <MapView
          ref={mapRef}
          styleUrl={config.map_style_url}
          allActivities={activities}
          fitVersion={fitVersion}
          visible={mapActs}
          loading={historyLoading}
          hasSelection={hasSel}
          showBadge={hasSel && !panelOpen}
          selSummary={selSummary}
          units={units}
          detailId={detailId}
          panelOpen={panelOpen}
          onOpenDetail={openDetail}
        >
          {detailId != null && (
            <DetailPanel
              key={detailId}
              id={detailId}
              units={units}
              onClose={() => setDetailId(null)}
              onPrev={() => stepDetail(-1)}
              onNext={() => stepDetail(1)}
            />
          )}
          {showTrip && (
            <TripSummary
              acts={tripActs}
              units={units}
              onClose={() => setShowTrip(false)}
              onFitRoute={() => mapRef.current?.focusVisible()}
              selectedIds={selected}
            />
          )}
        </MapView>
      </div>

      <footer style={{ flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', padding: '0 20px', background: 'var(--panel)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--faint)' }}>
        {loc('footer')}
      </footer>
    </div>
  )
}
