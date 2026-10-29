/**
 * Simulated Energy amounts are integer satoshis.
 * User-facing copy is always "N sat of Energy" / "N sats of Energy".
 * Nothing here moves real bitcoin.
 */

export function baseId(id: string): string {
  const i = id.indexOf('__')
  return i === -1 ? id : id.slice(0, i)
}

/** "1 sat of Energy" or "1,200 sats of Energy". */
export function energyPhrase(sats: number): string {
  const n = Math.max(0, Math.round(Number.isFinite(sats) ? sats : 0))
  const num = n.toLocaleString('en-US')
  return n === 1 ? '1 sat of Energy' : `${num} sats of Energy`
}

export function energyUnit(sats: number): string {
  const n = Math.max(0, Math.round(Number.isFinite(sats) ? sats : 0))
  return n === 1 ? 'sat of Energy' : 'sats of Energy'
}

/**
 * Slow-start standout, 0..1.
 * log10(1 + sats / 250_000) stays nearly flat for small totals
 * (a few plays, a single album) and only climbs once a star has
 * accumulated a lot of Energy. ~100,000,000 sats reaches 1.
 * Monotonic, so the star with the most Energy is the brightest.
 */
const ENERGY_LOG_SATS = 250_000
const ENERGY_FULL_DECADES = 2.6

export function energyGlow(sats: number): number {
  const n = Math.max(0, Math.round(Number.isFinite(sats) ? sats : 0))
  if (n <= 0) return 0
  const decades = Math.log10(1 + n / ENERGY_LOG_SATS)
  return Math.min(1, decades / ENERGY_FULL_DECADES)
}

/**
 * Merge fan Energy onto the existing zap-interest brightness.
 * glow 0 leaves the base (dormant stays dim, new stars keep zapEnergy).
 * glow 1 lifts any star to the cap, above an established star with no Energy.
 */
export function brightnessWithEnergy(base: number, glow: number): number {
  const b = Math.max(0, Math.min(1.2, base))
  const g = Math.max(0, Math.min(1, glow))
  const lifted = b + g * (1.42 - b * 0.25)
  return Math.max(0.08, Math.min(1.42, lifted))
}

export type AlbumOffer = {
  key: string
  name: string
  trackCount: number
  priceSats: number
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function albumKey(artistId: string, albumName: string): string {
  return `${baseId(artistId)}::${slug(albumName)}`
}

/** Stable simulated price. One album is a real deposit, not a full glow. */
export function albumPriceSats(artistId: string, albumName: string, trackCount: number): number {
  let h = 0
  const s = `${baseId(artistId)}|${albumName}`
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  const raw = 40_000 + Math.max(1, trackCount) * 8_000 + (h % 5_000)
  return Math.round(raw / 1_000) * 1_000
}

export function albumsFor(artistId: string, tracks: { album?: string }[]): AlbumOffer[] {
  const groups = new Map<string, number>()
  for (const t of tracks) {
    const name = t.album?.trim() || 'Singles'
    groups.set(name, (groups.get(name) ?? 0) + 1)
  }
  return [...groups.entries()].map(([name, trackCount]) => ({
    key: albumKey(artistId, name),
    name,
    trackCount,
    priceSats: albumPriceSats(artistId, name, trackCount),
  }))
}

export function albumForTrack(artistId: string, track: { album?: string }, tracks: { album?: string }[]): AlbumOffer {
  const name = track.album?.trim() || 'Singles'
  const found = albumsFor(artistId, tracks).find((a) => a.name === name)
  if (found) return found
  return {
    key: albumKey(artistId, name),
    name,
    trackCount: 1,
    priceSats: albumPriceSats(artistId, name, 1),
  }
}

export const ZAP_PRESETS = [21, 100, 1_000, 10_000] as const
