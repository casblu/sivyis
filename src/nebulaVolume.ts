/**
 * Each genre nebula is a 3D cloud of large, soft smoke sprites, not sparkly points.
 * The shape is the morphology (ring, wings, hourglass, pillars, jet, …).
 * Colors start from that nebula's palette and are then tinted from its NASA plate
 * so the front view keeps the photographic identity.
 */
import * as THREE from 'three'
import type { GenreId } from './artists.ts'
import { rng } from './nebulaShape.ts'

export type VolumeKind =
  | 'ring'
  | 'helix'
  | 'butterfly'
  | 'hourglass'
  | 'horse'
  | 'pillars'
  | 'mystic'
  | 'crab'
  | 'orion'
  | 'jet'

const KIND: Record<Exclude<GenreId, 'classical'>, VolumeKind> = {
  electronic: 'ring',
  indie: 'helix',
  pop: 'butterfly',
  latin: 'hourglass',
  metal: 'horse',
  jazz: 'pillars',
  country: 'mystic',
  hiphop: 'crab',
  rnb: 'orion',
  rock: 'jet',
}

export function volumeKindFor(id: string): VolumeKind {
  return KIND[id as Exclude<GenreId, 'classical'>] ?? 'orion'
}

/** Few large puffs. They overlap into continuous smoke; a phone tier draws fewer of them. */
export const NEBULA_VOLUME_COUNT = 220

const NEBULA_VOL_VERT = `
attribute vec2 corner;
attribute vec2 aSize;
attribute vec3 aDrift;
attribute float aPhase;
attribute vec3 color;
uniform float uTime;
varying vec3 vColor;
varying float vFade;
varying vec2 vUv;
void main() {
  vColor = color;
  float t = uTime * 0.07 + aPhase;
  vec3 p = position;
  p += aDrift * sin(t);
  p.x += aDrift.z * sin(t * 0.62 + position.y * 0.04);
  p.z += aDrift.y * cos(t * 0.54 + position.x * 0.04);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float ang = aPhase + uTime * 0.035;
  float c = cos(ang), s = sin(ang);
  vec2 q = corner * aSize;
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  mv.xy += q;
  vUv = corner + 0.5;
  vFade = smoothstep(1.4, 9.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const NEBULA_VOL_FRAG = `
uniform sampler2D uSmoke;
uniform float uOpacity;
varying vec3 vColor;
varying float vFade;
varying vec2 vUv;
void main() {
  float smoke = texture2D(uSmoke, vUv).a;
  float a = smoke * uOpacity * vFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`

function smokeTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const img = g.createImageData(size, size)
  const hash = (ix: number, iy: number) => {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x: number, y: number) => noise(x, y) * 0.65 + noise(x * 2.1 + 4.0, y * 2.1) * 0.35
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5
      const dy = (y + 0.5) / size - 0.5
      const r = Math.hypot(dx, dy) / 0.5
      const n = fbm(dx * 2.2 + 1.7, dy * 2.2 + 0.6)
      let a = Math.exp(-r * r * 1.05)
      a *= 0.88 + 0.12 * n
      if (r > 0.72) a *= Math.max(0, 1 - (r - 0.72) / 0.42)
      const i = (y * size + x) * 4
      const v = Math.max(0, Math.min(255, Math.round(a * 255)))
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = v
    }
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

let SMOKE: THREE.CanvasTexture | null = null

export function createVolumeMaterial(): THREE.ShaderMaterial {
  SMOKE ??= smokeTexture()
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.12 },
      uSmoke: { value: SMOKE },
    },
    vertexShader: NEBULA_VOL_VERT,
    fragmentShader: NEBULA_VOL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  mat.userData.baseOpacity = 0.12
  return mat
}

/** Camera-facing quads, one per puff. Colors live in `vol.color` and are copied onto the mesh. */
export function createSmokeMesh(vol: VolumeBuffers): THREE.Mesh {
  const n = vol.position.length / 3
  const pos = new Float32Array(n * 12)
  const corner = new Float32Array(n * 8)
  const size = new Float32Array(n * 8)
  const drift = new Float32Array(n * 12)
  const phase = new Float32Array(n * 4)
  const color = new Float32Array(n * 12)
  const index: number[] = []
  const corners = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]
  for (let i = 0; i < n; i++) {
    const sx = vol.size[i]
    const sy = sx * (0.82 + (vol.phase[i] % 1) * 0.36)
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v
      pos[k * 3] = vol.position[i * 3]
      pos[k * 3 + 1] = vol.position[i * 3 + 1]
      pos[k * 3 + 2] = vol.position[i * 3 + 2]
      corner[k * 2] = corners[v * 2]
      corner[k * 2 + 1] = corners[v * 2 + 1]
      size[k * 2] = sx
      size[k * 2 + 1] = sy
      drift[k * 3] = vol.drift[i * 3]
      drift[k * 3 + 1] = vol.drift[i * 3 + 1]
      drift[k * 3 + 2] = vol.drift[i * 3 + 2]
      phase[k] = vol.phase[i]
      color[k * 3] = vol.color[i * 3]
      color[k * 3 + 1] = vol.color[i * 3 + 1]
      color[k * 3 + 2] = vol.color[i * 3 + 2]
    }
    const o = i * 4
    index.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 2))
  geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 3))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geo.setIndex(index)
  const mesh = new THREE.Mesh(geo, createVolumeMaterial())
  mesh.frustumCulled = false
  mesh.userData.puffCount = n
  return mesh
}

/** Copy tinted puff colors onto the four corners of each sprite. */
export function syncSmokeColors(mesh: THREE.Mesh, color: Float32Array): void {
  const attr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
  const n = color.length / 3
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v
      attr.setXYZ(k, color[i * 3], color[i * 3 + 1], color[i * 3 + 2])
    }
  }
  attr.needsUpdate = true
}

export type VolumeBuffers = {
  position: Float32Array
  color: Float32Array
  size: Float32Array
  drift: Float32Array
  phase: Float32Array
}

type RGB = [number, number, number]

function hexRgb(hex: number): RGB {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k]
}

export function buildNebulaVolume(kind: VolumeKind, count: number, span: number, seed: number, mist: [number, number]): VolumeBuffers {
  const rand = rng(seed)
  const H = span * 0.5
  const position = new Float32Array(count * 3)
  const color = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const drift = new Float32Array(count * 3)
  const phase = new Float32Array(count)
  const A = hexRgb(mist[0])
  const B = hexRgb(mist[1])
  const TAU = Math.PI * 2
  const gauss = () => rand() + rand() + rand() - 1.5

  const put = (i: number, x: number, y: number, z: number, col: RGB, sz: number) => {
    position[i * 3] = x
    position[i * 3 + 1] = y
    position[i * 3 + 2] = z
    const k = 0.55 + rand() * 0.7
    color[i * 3] = Math.min(1, col[0] * k)
    color[i * 3 + 1] = Math.min(1, col[1] * k)
    color[i * 3 + 2] = Math.min(1, col[2] * k)
    size[i] = sz
    const amp = span * (0.02 + rand() * 0.03)
    drift[i * 3] = (rand() - 0.5) * 2 * amp
    drift[i * 3 + 1] = (rand() - 0.5) * 2 * amp
    drift[i * 3 + 2] = (rand() - 0.5) * 2 * amp
    phase[i] = rand() * TAU
  }

  const inHorse = (x: number, y: number, z: number) => {
    const e = (dx: number, dy: number, dz: number, rx: number, ry: number, rz: number) =>
      (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz)
    const head = e(x - H * 0.02, y - H * 0.12, z, H * 0.26, H * 0.32, H * 0.2)
    const snout = e(x - H * 0.28, y - H * 0.02, z * 0.3, H * 0.2, H * 0.12, H * 0.12)
    const neck = e(x + H * 0.08, y + H * 0.28, z, H * 0.2, H * 0.34, H * 0.16)
    return head < 1 || snout < 1 || neck < 1
  }

  for (let i = 0; i < count; i++) {
    const sz = span * (0.15 + rand() * 0.11)
    let x = 0, y = 0, z = 0
    let col: RGB = A

    if (kind === 'ring' || kind === 'helix') {
      const round = kind === 'helix'
      const interior = rand() < (round ? 0.34 : 0.16)
      const ray = !round && !interior && rand() < 0.2
      if (interior) {
        const r = Math.pow(rand(), 0.55) * H * (round ? 0.48 : 0.38)
        const a = rand() * TAU
        x = Math.cos(a) * r
        y = Math.sin(a) * r * (round ? 1 : 0.9)
        z = (rand() - 0.5) * H * (round ? 0.28 : 0.16)
        col = shade(round ? B : A, 0.75 + rand() * 0.4)
      } else if (ray) {
        const a = rand() * TAU
        const r = H * (0.55 + rand() * 0.48)
        x = Math.cos(a) * r
        y = Math.sin(a) * r * 0.9
        z = (rand() - 0.5) * H * 0.12
        col = shade(B, 0.5 + rand() * 0.6)
      } else {
        const a = rand() * TAU
        const tube = H * (round ? 0.2 : 0.15)
        const phi = rand() * TAU
        const R = H * (round ? 0.52 : 0.58) + Math.cos(phi) * tube * rand()
        x = Math.cos(a) * R
        y = Math.sin(a) * R * (round ? 1 : 0.88)
        z = Math.sin(phi) * tube * (round ? 1.7 : 1.55)
        const rim = Math.abs(Math.sin(phi))
        col = mix(A, B, round ? 0.25 + rim * 0.6 : rim)
      }
      if (round) {
        const tilt = 0.22
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt)
        const z2 = y * Math.sin(tilt) + z * Math.cos(tilt)
        y = y2
        z = z2
      }
    } else if (kind === 'butterfly') {
      if (rand() < 0.08) {
        const r = Math.pow(rand(), 0.5) * H * 0.1
        const a = rand() * TAU
        x = Math.cos(a) * r
        y = Math.sin(a) * r
        z = (rand() - 0.5) * H * 0.08
        col = [1, 0.95, 0.98]
      } else {
        const lobe = rand() < 0.5 ? 1 : -1
        const along = Math.pow(rand(), 0.4) * H * 0.98
        const wing = along / (H * 0.98)
        const spread = (rand() - 0.5) * H * 0.62 * (0.2 + Math.sin(wing * Math.PI) * 0.8)
        const thick = (rand() - 0.5) * H * 0.42 * (0.35 + wing)
        const ang = 0.95
        x = Math.cos(ang) * along * lobe + Math.sin(ang) * spread
        y = Math.sin(ang) * along * lobe - Math.cos(ang) * spread * 0.2
        z = thick * lobe
        col = mix(A, B, wing)
      }
    } else if (kind === 'hourglass') {
      if (rand() < 0.14) {
        const r = Math.pow(rand(), 0.45) * H * 0.14
        const a = rand() * TAU
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        y = (rand() - 0.5) * H * 0.08
        col = B
      } else {
        const ySign = rand() < 0.5 ? 1 : -1
        const t = 0.08 + Math.pow(rand(), 0.65) * 0.9
        y = ySign * t * H
        const flare = Math.abs(t)
        const shell = Math.floor(rand() * 4)
        const R = H * (0.07 + flare * 0.46) * (0.5 + shell * 0.18)
        const a = rand() * TAU
        const j = (rand() - 0.5) * H * 0.035
        x = Math.cos(a) * (R + j)
        z = Math.sin(a) * (R + j)
        col = mix(B, A, Math.min(1, shell / 3))
      }
    } else if (kind === 'horse') {
      let placed = false
      for (let t = 0; t < 10 && !placed; t++) {
        x = (rand() - 0.5) * H * 1.55
        y = (rand() - 0.5) * H * 1.35
        z = (rand() - 0.5) * H * 0.95
        const ex = (x / H) ** 2 / 0.55 + (y / H) ** 2 / 0.42 + (z / H) ** 2 / 0.22
        if (ex > 1 || inHorse(x, y, z)) continue
        placed = true
      }
      const blue = x < -H * 0.15 && y < -H * 0.05
      col = blue ? B : A
    } else if (kind === 'pillars' || kind === 'mystic') {
      const mystic = kind === 'mystic'
      const cols = mystic
        ? [
            { x: 0.02, z: 0.0, h: 0.95, r: 0.16 },
            { x: -0.22, z: 0.12, h: 0.55, r: 0.1 },
          ]
        : [
            { x: -0.32, z: 0.06, h: 0.82, r: 0.12 },
            { x: 0.02, z: -0.1, h: 0.98, r: 0.14 },
            { x: 0.3, z: 0.08, h: 0.68, r: 0.09 },
          ]
      if (rand() < (mystic ? 0.62 : 0.58)) {
        const c = cols[Math.floor(rand() * cols.length)]!
        const ty = Math.pow(rand(), mystic ? 0.7 : 0.85)
        y = -H * c.h * 0.15 + ty * H * c.h
        const taper = 1 - ty * 0.45
        const rad = H * c.r * taper * Math.sqrt(rand())
        const a = rand() * TAU
        x = H * c.x + Math.cos(a) * rad
        z = H * c.z + Math.sin(a) * rad
        const rim = rad / (H * c.r * taper + 0.001)
        col = mix(shade(A, 0.45), A, rim)
      } else {
        x = gauss() * H * 0.55
        y = gauss() * H * 0.5
        z = gauss() * H * 0.4
        col = shade(B, 0.45 + rand() * 0.5)
      }
    } else if (kind === 'crab') {
      if (rand() < 0.28) {
        const r = Math.pow(rand(), 0.4) * H * 0.45
        const a = rand() * TAU
        const b = Math.acos(2 * rand() - 1)
        x = r * Math.sin(b) * Math.cos(a)
        y = r * Math.sin(b) * Math.sin(a)
        z = r * Math.cos(b)
        col = shade(A, 0.7)
      } else {
        const a = Math.round(rand() * 14) * (TAU / 14) + (rand() - 0.5) * 0.18
        const b = Math.round(rand() * 8) * (Math.PI / 8) + (rand() - 0.5) * 0.16
        const r = H * (0.48 + rand() * 0.28)
        x = r * Math.sin(b) * Math.cos(a)
        y = r * Math.sin(b) * Math.sin(a)
        z = r * Math.cos(b)
        col = mix(A, B, rand())
      }
    } else if (kind === 'orion') {
      x = gauss() * H * 0.52
      y = gauss() * H * 0.46
      z = gauss() * H * 0.34
      const r2 = (x * x + y * y + z * z) / (H * H)
      const hot = Math.exp(-r2 * 3.2)
      col = mix(shade(A, 0.4), [1, 0.92, 0.75], hot)
      if (Math.abs(y - x * 0.25) < H * 0.06) col = shade(col, 0.35)
    } else {
      // jet: red volume plus a real cyan column
      if (rand() < 0.3) {
        y = (rand() - 0.5) * H * 1.75
        const yn = y / H
        const bulge = 1 + 0.55 * Math.exp(-((yn - 0.15) ** 2) / 0.05) + 0.4 * Math.exp(-((yn + 0.35) ** 2) / 0.06)
        const rad = H * 0.085 * bulge * Math.sqrt(rand())
        const a = rand() * TAU
        x = Math.cos(a) * rad + Math.sin(yn * 5) * H * 0.03
        z = Math.sin(a) * rad
        col = B
      } else {
        x = gauss() * H * 0.5
        y = gauss() * H * 0.55
        z = gauss() * H * 0.4
        col = A
      }
    }
    put(i, x, y, z, col, sz)
  }
  return { position, color, size, drift, phase }
}

/** Pull photographic color onto particles from their front-view (x, y) position. Cyan jets stay cyan. */
export function tintVolumeFromImage(color: Float32Array, position: Float32Array, span: number, img: HTMLImageElement): void {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 512 / Math.max(w, h))
  canvas.width = Math.max(2, Math.round(w * scale))
  canvas.height = Math.max(2, Math.round(h * scale))
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) return
  g.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = g.getImageData(0, 0, canvas.width, canvas.height).data
  const n = position.length / 3
  for (let i = 0; i < n; i++) {
    const br = color[i * 3 + 2] - Math.max(color[i * 3], color[i * 3 + 1])
    if (br > 0.18) continue
    const u = position[i * 3] / span + 0.5
    const v = 0.5 - position[i * 3 + 1] / span
    if (u < 0 || v < 0 || u > 1 || v > 1) continue
    const px = Math.min(canvas.width - 1, Math.max(0, (u * (canvas.width - 1)) | 0))
    const py = Math.min(canvas.height - 1, Math.max(0, (v * (canvas.height - 1)) | 0))
    const o = (py * canvas.width + px) * 4
    const r = data[o] / 255
    const gv = data[o + 1] / 255
    const b = data[o + 2] / 255
    const luma = 0.2126 * r + 0.7152 * gv + 0.0722 * b
    if (luma < 0.05) continue
    color[i * 3] = Math.min(1, color[i * 3] * 0.22 + r * 0.95)
    color[i * 3 + 1] = Math.min(1, color[i * 3 + 1] * 0.22 + gv * 0.95)
    color[i * 3 + 2] = Math.min(1, color[i * 3 + 2] * 0.22 + b * 0.95)
  }
}
