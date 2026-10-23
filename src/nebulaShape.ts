import * as THREE from 'three'

/** Deterministic PRNG (mulberry32) — each genre gets its own seeded shape. */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 2D value noise / fbm for feathered, domain-warped masks ──
function vhash(x: number, y: number, s: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = vhash(xi, yi, s), b = vhash(xi + 1, yi, s), c = vhash(xi, yi + 1, s), d = vhash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, y: number, s: number, oct = 5): number {
  let sum = 0, amp = 0.5, f = 1
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 13); f *= 2.03; amp *= 0.5 }
  return sum
}

export type MaskKind = 'wisp' | 'knot' | 'pillar' | 'dust'

/**
 * Grayscale alpha masks with irregular, domain-warped silhouettes and soft feathered edges.
 * Never a circle: elongated falloff + warped noise threshold + tendril streaks.
 */
function makeMask(kind: MaskKind, seed: number, size = 192): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  const r = rng(seed)
  const ax = kind === 'pillar' ? 0.32 : 0.55 + r() * 0.35
  const ay = kind === 'pillar' ? 1.0 : 0.45 + r() * 0.3
  const shear = (r() - 0.5) * 0.8
  const ox = (r() - 0.5) * 0.25, oy = (r() - 0.5) * 0.25
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let px = (x / size) * 2 - 1
      let py = (y / size) * 2 - 1
      // domain warp
      const wx = fbm(px * 1.6 + 3.1, py * 1.6, seed, 4) - 0.5
      const wy = fbm(px * 1.6, py * 1.6 + 7.7, seed + 5, 4) - 0.5
      px += wx * 0.75; py += wy * 0.75
      const qx = (px - ox + py * shear) / ax
      const qy = (py - oy) / ay
      const rad = Math.sqrt(qx * qx + qy * qy)
      let fall = 1 - smooth(0.25, 1.0, rad)
      if (kind === 'pillar') fall *= smooth(-1.0, -0.55, py) // flat-ish base, eroded tip via noise
      const n = fbm(px * 3.2 + 11, py * 3.2 - 4, seed + 9, 5)
      let a: number
      if (kind === 'knot') a = Math.pow(fall, 1.6) * (0.55 + n * 0.9)
      else if (kind === 'dust') a = smooth(0.42, 0.75, n * fall * 1.5) * fall
      else {
        // wisps: streaky tendrils along a seeded direction
        const streak = fbm(qx * 1.2 + 5, qy * 6.0, seed + 17, 4)
        a = smooth(0.32, 0.82, n * 0.6 + streak * 0.55) * fall
      }
      a = Math.max(0, Math.min(1, a))
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  g.putImageData(img, 0, 0)
  return c
}
function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

let MASKS: Record<MaskKind, HTMLCanvasElement[]> | null = null
/** Shared mask bank (built once, ~11 small canvases). */
export function maskBank(): Record<MaskKind, HTMLCanvasElement[]> {
  if (!MASKS) {
    MASKS = {
      wisp: [1, 2, 3, 4].map((s) => makeMask('wisp', 100 + s)),
      knot: [1, 2].map((s) => makeMask('knot', 200 + s)),
      pillar: [1, 2].map((s) => makeMask('pillar', 300 + s)),
      dust: [1, 2, 3].map((s) => makeMask('dust', 400 + s)),
    }
  }
  return MASKS
}

/** Compose a puff texture: photo crop (or flat tint) cut out by an irregular mask. */
export function puffTexture(mask: HTMLCanvasElement, src: HTMLImageElement | null, tint: THREE.Color, seed: number, size = 384): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = rng(seed)
  if (src) {
    const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height
    const crop = Math.min(iw, ih) * (0.35 + r() * 0.4)
    const sx = r() * (iw - crop), sy = r() * (ih - crop)
    g.save()
    g.translate(size / 2, size / 2); g.rotate(r() * Math.PI * 2); g.translate(-size / 2, -size / 2)
    g.drawImage(src, sx, sy, crop, crop, -size * 0.2, -size * 0.2, size * 1.4, size * 1.4)
    g.restore()
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = `rgba(${(tint.r * 255) | 0},${(tint.g * 255) | 0},${(tint.b * 255) | 0},0.2)`
    g.fillRect(0, 0, size, size)
  } else {
    const grd = g.createLinearGradient(0, 0, size, size)
    grd.addColorStop(0, `#${tint.clone().offsetHSL(0.03, 0, 0.12).getHexString()}`)
    grd.addColorStop(1, `#${tint.clone().offsetHSL(-0.04, 0, -0.1).getHexString()}`)
    g.fillStyle = grd
    g.fillRect(0, 0, size, size)
  }
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(mask, 0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function dustTexture(mask: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(mask)
  tex.needsUpdate = true
  return tex
}

export type SkelPoint = { p: THREE.Vector3; r: number; t: number; branch: number; pillar: boolean }

/**
 * Seeded nebula skeleton in local space: curved, tapering branches from an offset core
 * through each anchor (subgenre centers, so artists sit inside the cloud), plus stray
 * tendrils and 1–2 pillars. Lopsided by construction.
 */
export function buildSkeleton(seed: number, R: number, anchors: THREE.Vector3[]): SkelPoint[] {
  const r = rng(seed)
  const out: SkelPoint[] = []
  const core = new THREE.Vector3((r() - 0.5) * R * 0.5, (r() - 0.5) * R * 0.3, (r() - 0.5) * R * 0.5)
  const rv = () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize()
  const addBranch = (dir: THREE.Vector3, len: number, width: number, steps: number, through: THREE.Vector3 | null, pillar = false) => {
    const bi = out.length ? out[out.length - 1].branch + 1 : 0
    const p = core.clone()
    const d = dir.clone().normalize()
    const curl = rv().multiplyScalar(0.35 + r() * 0.5)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      if (through) {
        // bend toward the anchor, then continue past it a bit
        const want = through.clone().sub(p).normalize()
        d.lerp(t < 0.75 ? want : d, 0.35)
      }
      d.addScaledVector(curl, 0.18).addScaledVector(rv(), 0.22).normalize()
      p.addScaledVector(d, len / steps)
      const taper = pillar ? 1 - t * 0.35 : Math.pow(1 - t, 0.7) * 0.85 + 0.15
      out.push({ p: p.clone(), r: width * taper * (0.75 + r() * 0.5), t, branch: bi, pillar })
    }
  }
  for (const a of anchors) {
    const dir = a.clone().sub(core)
    addBranch(dir, dir.length() * (1.15 + r() * 0.35), R * (0.32 + r() * 0.12), 7, a)
  }
  const tendrils = 3 + Math.floor(r() * 3)
  for (let i = 0; i < tendrils; i++) addBranch(rv(), R * (0.6 + r() * 0.9), R * (0.14 + r() * 0.1), 6, null)
  const pillars = 1 + Math.floor(r() * 2)
  for (let i = 0; i < pillars; i++) {
    const dir = new THREE.Vector3((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5)
    if (r() > 0.5) dir.y = -1
    addBranch(dir, R * (0.7 + r() * 0.5), R * (0.16 + r() * 0.06), 5, null, true)
  }
  out.unshift({ p: core.clone(), r: R * 0.42, t: 0, branch: -1, pillar: false })
  return out
}
