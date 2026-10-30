import type { Artist } from './artists.ts'

/**
 * Album cover art. Real art only when the source data has it: an open-catalog
 * V4V RSS artist with a single album, where the feed image IS that album's cover.
 * Everything else gets a deterministic nebula-style SVG seeded by artist + album
 * (clearly generated, titled — never a fake real-world cover).
 */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0
  return h
}

function rng(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function wrap(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 14 && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, 12) + '…' }
  return lines
}

const cache = new Map<string, string>()

export function placeholderCover(artistName: string, albumName: string): string {
  const k = artistName + '|' + albumName
  const hit = cache.get(k)
  if (hit) return hit
  const r = rng(hash(k))
  const h1 = Math.floor(r() * 360)
  const h2 = (h1 + 60 + Math.floor(r() * 140)) % 360
  const h3 = (h1 + 180 + Math.floor(r() * 60)) % 360
  let blobs = ''
  for (let i = 0; i < 4; i++) {
    const hue = [h1, h2, h3][i % 3]
    blobs += `<circle cx="${(15 + r() * 70).toFixed(1)}" cy="${(15 + r() * 60).toFixed(1)}" r="${(18 + r() * 26).toFixed(1)}" fill="hsl(${hue} 85% 60%)" opacity="${(0.35 + r() * 0.35).toFixed(2)}"/>`
  }
  let stars = ''
  for (let i = 0; i < 22; i++) {
    stars += `<circle cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(0.2 + r() * 0.7).toFixed(2)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`
  }
  const lines = wrap(albumName)
  const text = lines
    .map((l, i) => `<text x="8" y="${(92 - (lines.length - 1 - i) * 9).toFixed(0)}" font-family="Exo 2, sans-serif" font-weight="700" font-size="8" fill="#fff">${esc(l)}</text>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 60% 14%)"/><stop offset="1" stop-color="hsl(${h3} 55% 8%)"/></linearGradient><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><g filter="url(#b)">${blobs}</g>${stars}<rect width="100" height="100" fill="url(#s)"/>${text}</svg>`
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  cache.set(k, url)
  return url
}

export function albumCoverUrl(artist: Artist, albumName: string): string {
  const open = artist.open
  if (open?.image && open.sources?.length === 1 && open.sources[0] === 'rss') {
    const albums = new Set(artist.tracks.map((t) => t.album?.trim() || 'Singles'))
    if (albums.size === 1) return open.image
  }
  return placeholderCover(artist.name, albumName)
}

/** <img> markup with a placeholder fallback if the real URL fails to load. */
export function albumCoverImg(artist: Artist, albumName: string, cls: string): string {
  const url = albumCoverUrl(artist, albumName)
  const fb = placeholderCover(artist.name, albumName)
  const onerr = url === fb ? '' : ` onerror="this.onerror=null;this.src='${fb}'"`
  return `<img class="${cls}" src="${esc(url)}" alt="${esc(albumName)} cover" loading="lazy" width="48" height="48"${onerr} />`
}

/* ---------- Merch placeholders: product silhouette over a seeded palette ---------- */
export type MerchKind = 'tee' | 'hoodie' | 'vinyl' | 'poster' | 'hat' | 'ticket' | 'tote' | 'feed'

export function merchKind(name: string): MerchKind {
  const n = name.toLowerCase()
  if (/hoodie|sweat/.test(n)) return 'hoodie'
  if (/hat|cap|beanie/.test(n)) return 'hat'
  if (/vinyl|record|lp\b|album|cd\b/.test(n)) return 'vinyl'
  if (/tour|ticket|show|concert/.test(n)) return 'ticket'
  if (/rss|feed|podcast/.test(n)) return 'feed'
  if (/poster|print|press|page|profile|kit/.test(n)) return 'poster'
  if (/store|shop|bag|tote/.test(n)) return 'tote'
  return 'tee'
}

export const MERCH_LABEL: Record<MerchKind, string> = {
  tee: 'Apparel', hoodie: 'Apparel', vinyl: 'Music', poster: 'Print', hat: 'Headwear', ticket: 'Tickets', tote: 'Store', feed: 'Feed',
}

const SHAPES: Record<MerchKind, string> = {
  tee: '<path d="M34 22 L22 28 L14 42 L24 47 L28 40 L28 80 L72 80 L72 40 L76 47 L86 42 L78 28 L66 22 Q58 30 50 30 Q42 30 34 22 Z"/>',
  hoodie: '<path d="M36 22 Q50 10 64 22 L80 30 L88 70 L78 72 L72 46 L72 82 L28 82 L28 46 L22 72 L12 70 L20 30 Z"/><path d="M40 24 Q50 40 60 24" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>',
  vinyl: '<circle cx="50" cy="48" r="32"/><circle cx="50" cy="48" r="10" fill="rgba(0,0,0,.4)"/><circle cx="50" cy="48" r="2" fill="#000"/><circle cx="50" cy="48" r="24" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/><circle cx="50" cy="48" r="18" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>',
  poster: '<rect x="28" y="14" width="44" height="62" rx="2"/><rect x="33" y="19" width="34" height="34" fill="rgba(0,0,0,.25)"/><rect x="33" y="58" width="24" height="3" fill="rgba(0,0,0,.3)"/><rect x="33" y="64" width="16" height="3" fill="rgba(0,0,0,.3)"/>',
  hat: '<path d="M24 58 Q24 28 50 28 Q76 28 76 58 Z"/><path d="M20 58 L90 58 Q86 66 70 64 L20 62 Z"/><circle cx="50" cy="28" r="3"/>',
  ticket: '<path d="M16 32 H84 V42 A6 6 0 0 0 84 54 V64 H16 V54 A6 6 0 0 0 16 42 Z"/><path d="M62 32 V64" stroke="rgba(0,0,0,.35)" stroke-dasharray="3 3" stroke-width="1.5"/>',
  tote: '<path d="M38 34 Q38 18 50 18 Q62 18 62 34" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 34 H76 L72 80 H28 Z"/>',
  feed: '<circle cx="32" cy="66" r="6"/><path d="M26 44 A22 22 0 0 1 54 72" fill="none" stroke="currentColor" stroke-width="7"/><path d="M26 26 A40 40 0 0 1 72 72" fill="none" stroke="currentColor" stroke-width="7"/>',
}

const mcache = new Map<string, string>()

export function merchPlaceholder(artistName: string, itemName: string): string {
  const k = artistName + '|' + itemName
  const hit = mcache.get(k)
  if (hit) return hit
  const r = rng(hash('m:' + k))
  const h1 = Math.floor(r() * 360)
  const h2 = (h1 + 90 + Math.floor(r() * 120)) % 360
  const kind = merchKind(itemName)
  const fg = `hsl(${h2} 70% 70%)`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="hsl(${h1} 45% 26%)"/><stop offset="1" stop-color="hsl(${h1} 50% 9%)"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><g fill="${fg}" color="${fg}" transform="translate(0 -2)">${SHAPES[kind]}</g><text x="50" y="94" text-anchor="middle" font-family="Exo 2, sans-serif" font-weight="700" font-size="7" fill="#fff" opacity=".9">${esc(itemName.length > 22 ? itemName.slice(0, 21) + '…' : itemName)}</text></svg>`
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  mcache.set(k, url)
  return url
}

export function merchImg(artistName: string, itemName: string, realUrl?: string | null): string {
  const fb = merchPlaceholder(artistName, itemName)
  const url = realUrl || fb
  const onerr = url === fb ? '' : ` onerror="this.onerror=null;this.src='${fb}'"`
  return `<img class="tile-img" src="${esc(url)}" alt="${esc(itemName)}" loading="lazy" decoding="async" width="160" height="160"${onerr} />`
}
