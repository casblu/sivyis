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
