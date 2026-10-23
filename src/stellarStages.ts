/**
 * Stellar life-cycle visuals (shared canvas textures, built once).
 *  - planetary nebula (dead star): ionised shell, teal-cyan [O III] interior, red-orange [N II]/Hα rim, faint white-dwarf core.
 *  - supernova remnant (dead + very influential): Crab-like filamentary shell, blue synchrotron haze, red/orange filaments.
 *  - protostar (new artist): young star in a dusty cocoon, bipolar Herbig–Haro jets, faint edge-on disk.
 */
import * as THREE from 'three'

const SIZE = 256
let cache: Partial<Record<'nebula' | 'remnant' | 'protostar', THREE.Texture>> = {}

function rnd(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = c.height = SIZE
  return [c, c.getContext('2d')!]
}
function tex(c: HTMLCanvasElement): THREE.Texture {
  // Circular soft mask so no sprite edge/square is ever visible.
  const g = c.getContext('2d')!; const C = SIZE / 2
  g.globalCompositeOperation = 'destination-in'
  const m = g.createRadialGradient(C, C, 0, C, C, C)
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,1)'); m.addColorStop(0.97, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = m; g.fillRect(0, 0, SIZE, SIZE)
  g.globalCompositeOperation = 'source-over'
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t
}
function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [o, c] of stops) gr.addColorStop(o, c)
  g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE)
}

function planetaryNebula(): THREE.Texture {
  const [c, g] = canvas(); const C = SIZE / 2; const r = rnd(7)
  g.globalCompositeOperation = 'lighter'
  // faint outer halo
  radial(g, C, C, C, [[0.55, 'rgba(255,90,60,0)'], [0.75, 'rgba(255,90,60,0.10)'], [1, 'rgba(255,60,40,0)']])
  // teal [O III] interior
  radial(g, C, C, C * 0.62, [[0, 'rgba(60,200,220,0.10)'], [0.6, 'rgba(70,220,230,0.38)'], [1, 'rgba(70,220,230,0)']])
  // clumpy ring: red-orange outer rim, yellowish inner edge
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2, rr = C * (0.5 + r() * 0.16), s = 3 + r() * 9
    const x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr * 0.86
    const outer = rr > C * 0.58
    g.fillStyle = outer ? `rgba(255,${80 + r() * 50 | 0},50,${0.05 + r() * 0.07})` : `rgba(255,220,140,${0.03 + r() * 0.05})`
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill()
  }
  // tiny hot white dwarf
  radial(g, C, C, 10, [[0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(200,230,255,0.5)'], [1, 'rgba(200,230,255,0)']])
  return tex(c)
}

function supernovaRemnant(): THREE.Texture {
  const [c, g] = canvas(); const C = SIZE / 2; const r = rnd(11)
  g.globalCompositeOperation = 'lighter'
  radial(g, C, C, C * 0.7, [[0, 'rgba(140,170,255,0.35)'], [0.6, 'rgba(110,140,255,0.15)'], [1, 'rgba(90,120,255,0)']])
  g.lineCap = 'round'
  for (let i = 0; i < 160; i++) {
    let a = r() * Math.PI * 2, rr = C * (0.15 + r() * 0.2)
    let x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr * 0.8
    g.strokeStyle = r() < 0.6 ? `rgba(255,${90 + r() * 80 | 0},60,${0.12 + r() * 0.18})` : `rgba(255,230,170,${0.08 + r() * 0.12})`
    g.lineWidth = 0.6 + r() * 1.6
    g.beginPath(); g.moveTo(x, y)
    const steps = 6 + (r() * 8 | 0)
    for (let k = 0; k < steps; k++) {
      a += (r() - 0.5) * 0.5; rr += C * (0.03 + r() * 0.05)
      if (rr > C * 0.92) break
      x = C + Math.cos(a) * rr; y = C + Math.sin(a) * rr * 0.8; g.lineTo(x, y)
    }
    g.stroke()
  }
  radial(g, C, C, 8, [[0, 'rgba(230,240,255,0.9)'], [1, 'rgba(230,240,255,0)']]) // pulsar
  return tex(c)
}

function protostar(): THREE.Texture {
  const [c, g] = canvas(); const C = SIZE / 2; const r = rnd(3)
  // dusty cocoon
  g.globalCompositeOperation = 'lighter'
  radial(g, C, C, C * 0.7, [[0, 'rgba(255,170,90,0.55)'], [0.35, 'rgba(220,100,50,0.28)'], [1, 'rgba(120,40,20,0)']])
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, rr = C * r() * 0.55, s = 4 + r() * 12
    g.fillStyle = `rgba(${200 + r() * 55 | 0},${90 + r() * 60 | 0},40,${0.03 + r() * 0.05})`
    g.beginPath(); g.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, s, 0, Math.PI * 2); g.fill()
  }
  // bipolar Herbig–Haro jets (vertical) with knots
  for (const dir of [-1, 1]) {
    const jg = g.createLinearGradient(C, C, C, C + dir * C * 0.95)
    jg.addColorStop(0, 'rgba(255,220,200,0.7)'); jg.addColorStop(1, 'rgba(255,120,120,0)')
    g.fillStyle = jg
    g.beginPath(); g.moveTo(C - 3, C); g.lineTo(C - 9, C + dir * C * 0.95); g.lineTo(C + 9, C + dir * C * 0.95); g.lineTo(C + 3, C); g.fill()
    for (let k = 1; k <= 3; k++) {
      const y = C + dir * C * (0.3 + k * 0.17)
      const kg = g.createRadialGradient(C, y, 0, C, y, 9)
      kg.addColorStop(0, `rgba(255,140,150,${0.5 / k})`); kg.addColorStop(1, 'rgba(255,140,150,0)')
      g.fillStyle = kg; g.fillRect(C - 12, y - 12, 24, 24)
    }
  }
  // dark edge-on disk lane, then faint disk glow
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = 'rgba(20,8,4,0.55)'; g.beginPath(); g.ellipse(C, C, C * 0.36, 7, 0, 0, Math.PI * 2); g.fill()
  g.globalCompositeOperation = 'lighter'
  g.strokeStyle = 'rgba(255,190,120,0.25)'; g.lineWidth = 2; g.beginPath(); g.ellipse(C, C, C * 0.38, 9, 0, 0, Math.PI * 2); g.stroke()
  // bright young star
  radial(g, C, C, 18, [[0, 'rgba(255,255,240,1)'], [0.35, 'rgba(255,230,180,0.8)'], [1, 'rgba(255,180,100,0)']])
  return tex(c)
}

export type StageFx = 'nebula' | 'remnant' | 'protostar'
export function stageTexture(kind: StageFx): THREE.Texture {
  return (cache[kind] ??= kind === 'nebula' ? planetaryNebula() : kind === 'remnant' ? supernovaRemnant() : protostar())
}
export function resetStageTextures(): void { cache = {} }
