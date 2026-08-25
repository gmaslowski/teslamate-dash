import type { Activity } from './api'
import { loc } from './localization'

export type RangeKey = 'all' | '1y' | '90d' | '30d' | 'custom'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 864e5)
}

/** "Jun 21", with the year appended when it isn't the current one. */
export function feedDate(iso: string): string {
  const d = new Date(iso)
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`
}

function monthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** The Overview chip label, e.g. "Apr — Jul 2026" or "2026-06-20 → 2026-07-08". */
export function rangeLabel(
  range: RangeKey,
  customFrom: string,
  customTo: string,
  activities: Activity[],
): string {
  const now = new Date()
  if (range === 'custom') return `${customFrom} → ${customTo}`
  if (range === '1y') return `${monthYear(daysAgo(365))} — ${monthYear(now)}`
  if (range === '90d') return `${MONTHS[daysAgo(90).getMonth()]} — ${monthYear(now)}`
  if (range === '30d') return `${MONTHS[daysAgo(30).getMonth()]} — ${monthYear(now)}`
  if (activities.length) {
    const oldest = new Date(activities[activities.length - 1].date)
    const newest = new Date(activities[0].date)
    return `${monthYear(oldest)} — ${monthYear(newest)}`
  }
  return loc('allTime')
}

export function kmToUnit(km: number, units: 'km' | 'mi'): number {
  return units === 'mi' ? km * 0.621371 : km
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** "4h 38m" / "41m" — compact duration for panels and the itinerary. */
export function fmtHShort(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h
    ? loc('durationHours', { hours: h, minutes: m })
    : loc('durationMinutes', { minutes: m })
}
