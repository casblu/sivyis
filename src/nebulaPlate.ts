/**
 * Turn a nebula photograph into a straight-alpha plate:
 * black space drops out, dark dust silhouettes stay, the border feathers.
 */
import * as THREE from 'three'
import type { PlateMask } from './nebulaPhotos.ts'

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function vhash(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = vhash(xi, yi), b = vhash(xi + 1, yi), c = vhash(xi, yi + 1), d = vhash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`nebula load failed: ${src}`))
    img.src = src
  })
}

/** Soft stand-in so the cluster is visible before the photograph decodes. */
export function fallbackPlate(hexes: [number, number]): HTMLCanvasElement {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const css = (hex: number, a: number) => {
    const r = (hex >> 16) & 255, gv = (hex >> 8) & 255, b = hex & 255
    return `rgba(${r},${gv},${b},${a})`
  }
  g.clearRect(0, 0, size, size)
  const blobs: [number, number, number, string][] = [
    [0.5, 0.48, 0.42, css(hexes[0], 0.85)],
    [0.32, 0.4, 0.28, css(hexes[1], 0.55)],
    [0.68, 0.58, 0.26, css(hexes[0], 0.4)],
  ]
  for (const [x, y, rad, color] of blobs) {
    const grd = g.createRadialGradient(x * size, y * size, 0, x * size, y * size, rad * size)
    grd.addColorStop(0, color)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, size, size)
  }
  g.globalCompositeOperation = 'destination-in'
  const m = g.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5)
  m.addColorStop(0, 'rgba(0,0,0,1)')
  m.addColorStop(0.7, 'rgba(0,0,0,0.7)')
  m.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = m
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * Draw the image and write an alpha channel.
 * Object plates key out empty space. Field plates keep dark dust and only feather the rim.
 */
export function bakePlate(
  img: HTMLImageElement,
  mask: PlateMask,
  keyLow: number,
  keyHigh: number,
  edge?: { ell: number; from: number; to: number },
): HTMLCanvasElement {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const maxEdge = 1280
  const scale = Math.min(1, maxEdge / Math.max(iw, ih))
  const w = Math.max(2, Math.round(iw * scale))
  const h = Math.max(2, Math.round(ih * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, w, h)
  const image = g.getImageData(0, 0, w, h)
  const d = image.data
  for (let y = 0; y < h; y++) {
    const ny = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w
      const i = (y * w + x) * 4
      const r = d[i] / 255, gv = d[i + 1] / 255, b = d[i + 2] / 255
      const luma = 0.2126 * r + 0.7152 * gv + 0.0722 * b
      const chroma = Math.max(r, gv, b) - Math.min(r, gv, b)
      const ex = Math.min(nx, 1 - nx, ny, 1 - ny)
      const border = smooth(0, 0.045, ex)
      const rad = Math.hypot((nx - 0.5) * 1.08, (ny - 0.5) * 1.02) * 2
      const vig = 1 - smooth(0.92, 1.18, rad)
      let a: number
      if (mask === 'field') {
        // Wide, lumpy falloff so a full-frame photo reads as a cloud, not a card.
        const ellScale = edge?.ell ?? 2.05
        const from = edge?.from ?? 0.18
        const to = edge?.to ?? 0.58
        const ell = Math.hypot((nx - 0.5) * ellScale, (ny - 0.5) * ellScale * 0.92)
        const wobble = (vnoise(nx * 2.4 + 1.7, ny * 2.4) - 0.5) * 0.28
        a = 1 - smooth(from + wobble, to + wobble * 0.35, ell)
      } else {
        const presence = Math.max(luma, chroma * 1.35)
        a = smooth(keyLow, keyHigh, presence)
        // Keep a thin tail so faint rays and outer shells don't clip.
        a = Math.max(a, smooth(keyLow * 0.55, keyHigh, luma) * 0.55)
        a *= border * Math.max(vig, 0.15)
      }
      d[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)))
    }
  }
  g.putImageData(image, 0, 0)
  return c
}

export function canvasTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

let NOISE: THREE.CanvasTexture | null = null

/** Tiling noise: r low, g mid, b high. Used for drift and close-up filaments. */
export function detailNoise(): THREE.CanvasTexture {
  if (NOISE) return NOISE
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  const h = (ix: number, iy: number) => {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), d = h(xi + 1, yi + 1)
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v
  }
  const fbm = (x: number, y: number, oct: number) => {
    let s = 0, a = 0.5, f = 1
    for (let i = 0; i < oct; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5 }
    return s
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const i = (y * size + x) * 4
      img.data[i] = Math.round(fbm(u * 4, v * 4, 4) * 255)
      img.data[i + 1] = Math.round(fbm(u * 9 + 3, v * 9 + 1, 3) * 255)
      img.data[i + 2] = Math.round(fbm(u * 18 + 7, v * 18 + 4, 2) * 255)
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  NOISE = canvasTexture(c, true)
  NOISE.colorSpace = THREE.NoColorSpace
  return NOISE
}
