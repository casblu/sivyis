/** Hollow genre-ball layout: main genres equally spaced on a sphere shell. */

export const GENRE_BALL_RADIUS = 92
/** Soft cluster size for main-genre nebulas on the shell. */
export const GENRE_CLUSTER_RADIUS = 20
/** Subgenre orbit radius relative to parent cluster. */
export const SUBGENRE_ORBIT_MUL = 0.62
export const SUBGENRE_CLUSTER_RADIUS = 7.5

/** Camera starts near the hollow origin, looking outward at the shell. */
export const START_INSIDE_POS: [number, number, number] = [0, 3, 8]
/** Rough look-at on the shell (first fibonacci genre is near +Y; we aim mid-lat). */
export const START_LOOK_AT: [number, number, number] = [55, 12, 70]

export const OVERVIEW_ORBIT_RADIUS = GENRE_BALL_RADIUS + 160 // ~252

/** Fibonacci / golden-angle sphere — equal spacing, hollow (nothing at origin). */
export function fibonacciSphere(n: number, radius: number): [number, number, number][] {
  const pts: [number, number, number][] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius])
  }
  return pts
}

/** Five points on a small tilted ring around a parent (local web). */
export function pentagonOffsets(radius: number, seed = 0): [number, number, number][] {
  const out: [number, number, number][] = []
  const tilt = 0.48 + seed * 0.07
  const twist = seed * 0.55
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + twist
    const x = Math.cos(a) * radius
    const z = Math.sin(a) * radius
    const y = Math.sin(a * 2.0) * radius * 0.28
    const cy = y * Math.cos(tilt) - z * Math.sin(tilt)
    const cz = y * Math.sin(tilt) + z * Math.cos(tilt)
    out.push([x, cy, cz])
  }
  return out
}

export function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

export function rgbToHex(r: number, g: number, b: number): number {
  return (
    (Math.round(Math.max(0, Math.min(255, r))) << 16) |
    (Math.round(Math.max(0, Math.min(255, g))) << 8) |
    Math.round(Math.max(0, Math.min(255, b)))
  )
}

export function lerpHex(a: number, b: number, t: number): number {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

export function rgbaFromHex(hex: number, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

export function dist3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Nearest other shell points (by index), excluding self. */
export function nearestIndices(
  centers: [number, number, number][],
  index: number,
  k: number,
): number[] {
  const scored = centers
    .map((c, i) => ({ i, d: i === index ? Infinity : dist3(centers[index], c) }))
    .sort((a, b) => a.d - b.d)
  return scored.slice(0, k).map((s) => s.i)
}
