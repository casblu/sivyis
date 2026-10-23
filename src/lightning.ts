import * as THREE from 'three'

/** BTC-send "lightning strike": jagged branching bolts + flash around a star. Self-cleaning. */
type Strike = {
  group: THREE.Group
  bolts: { line: THREE.LineSegments; mat: THREE.LineBasicMaterial; delay: number; seed: number }[]
  flash: THREE.Sprite
  flashMat: THREE.SpriteMaterial
  light: THREE.PointLight
  age: number
  life: number
  regenAt: number
  radius: number
}

let flashTex: THREE.CanvasTexture | null = null
function getFlashTex(): THREE.CanvasTexture {
  if (flashTex) return flashTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.2, 'rgba(190,220,255,0.75)')
  grd.addColorStop(0.55, 'rgba(90,140,255,0.18)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  flashTex = new THREE.CanvasTexture(c)
  return flashTex
}

/** Build jagged branching bolt segments from origin outward along dir. */
function boltSegments(dir: THREE.Vector3, length: number, out: number[], depth = 0, start = new THREE.Vector3()): void {
  const steps = depth === 0 ? 9 : 5
  const p = start.clone()
  const segLen = length / steps
  const perpA = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
  const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize()
  for (let i = 0; i < steps; i++) {
    const jag = segLen * 0.75
    const n = p.clone()
      .addScaledVector(dir, segLen)
      .addScaledVector(perpA, (Math.random() - 0.5) * jag)
      .addScaledVector(perpB, (Math.random() - 0.5) * jag)
    out.push(p.x, p.y, p.z, n.x, n.y, n.z)
    if (depth < 2 && Math.random() < (depth === 0 ? 0.38 : 0.2)) {
      const bdir = dir.clone()
        .addScaledVector(perpA, (Math.random() - 0.5) * 1.6)
        .addScaledVector(perpB, (Math.random() - 0.5) * 1.6)
        .normalize()
      boltSegments(bdir, length * (0.25 + Math.random() * 0.3), out, depth + 1, n)
    }
    p.copy(n)
  }
}

export class LightningFX {
  private strikes: Strike[] = []
  private camShake = 0
  private camOffset = new THREE.Vector3()
  private scene: THREE.Scene
  private lowQuality: () => boolean
  constructor(scene: THREE.Scene, lowQuality: () => boolean) {
    this.scene = scene
    this.lowQuality = lowQuality
  }

  strike(pos: THREE.Vector3, starSize: number): void {
    const radius = Math.max(3, starSize * 6)
    const group = new THREE.Group()
    group.position.copy(pos)
    const count = this.lowQuality() ? 6 : 10
    const bolts: Strike['bolts'] = []
    for (let i = 0; i < count; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: i % 3 === 0 ? 0xffffff : 0xa8d4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const line = new THREE.LineSegments(new THREE.BufferGeometry(), mat)
      line.frustumCulled = false
      group.add(line)
      bolts.push({ line, mat, delay: Math.random() * 0.18, seed: Math.random() })
      this.regen(bolts[i], radius)
    }
    const flashMat = new THREE.SpriteMaterial({
      map: getFlashTex(), color: 0xcfe6ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const flash = new THREE.Sprite(flashMat)
    flash.scale.setScalar(radius * 2.6)
    group.add(flash)
    const light = new THREE.PointLight(0xbfe0ff, 0, radius * 4)
    group.add(light)
    this.scene.add(group)
    this.strikes.push({ group, bolts, flash, flashMat, light, age: 0, life: 0.75, regenAt: 0.06, radius })
    this.camShake = 1
  }

  private regen(b: Strike['bolts'][number], radius: number): void {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    const pts: number[] = []
    boltSegments(dir, radius * (0.6 + Math.random() * 0.6), pts)
    b.line.geometry.dispose()
    // WebGL lines are 1px: add 2 offset copies so bolts read thick + glowy (bloom catches them)
    const off = radius * 0.012
    const n = pts.length
    for (const [ox, oy] of [[off, 0], [0, off]]) for (let i = 0; i < n; i += 3) pts.push(pts[i] + ox, pts[i + 1] + oy, pts[i + 2])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    b.line.geometry = geo
  }

  get active(): boolean { return this.strikes.length > 0 || this.camShake > 0.01 }

  update(dt: number): void {
    for (let s = this.strikes.length - 1; s >= 0; s--) {
      const st = this.strikes[s]
      st.age += dt
      const k = st.age / st.life
      // re-randomize bolts a few times for crackling flicker
      if (st.age > st.regenAt && k < 0.8) {
        st.regenAt = st.age + 0.07 + Math.random() * 0.05
        for (const b of st.bolts) if (Math.random() < 0.5) this.regen(b, st.radius)
      }
      for (const b of st.bolts) {
        const local = st.age - b.delay
        if (local < 0) { b.mat.opacity = 0; continue }
        const fade = Math.max(0, 1 - local / (st.life - b.delay))
        b.mat.opacity = fade * (Math.random() < 0.25 ? 0.25 : 1)
      }
      const fl = k < 0.08 ? k / 0.08 : Math.max(0, 1 - (k - 0.08) / 0.5)
      st.flashMat.opacity = Math.min(1, fl * (0.9 + Math.random() * 0.3))
      st.light.intensity = fl * 60
      if (k >= 1) {
        for (const b of st.bolts) { b.line.geometry.dispose(); b.mat.dispose() }
        st.flashMat.dispose()
        this.scene.remove(st.group)
        this.strikes.splice(s, 1)
      }
    }
    this.camShake = Math.max(0, this.camShake - dt * 2.2)
  }

  /** Apply transient camera jitter before render; call restoreCamera after. */
  applyCamera(cam: THREE.Camera): void {
    const a = this.camShake * this.camShake * 0.35
    this.camOffset.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a)
    cam.position.add(this.camOffset)
  }
  restoreCamera(cam: THREE.Camera): void {
    cam.position.sub(this.camOffset)
    this.camOffset.set(0, 0, 0)
  }
}

let thunderCtx: AudioContext | null = null
/** Synth thunder: sharp crack + low rolling rumble. Call from a user gesture. */
export function playThunder(): void {
  try {
    thunderCtx ??= new AudioContext()
    const ctx = thunderCtx
    void ctx.resume()
    const now = ctx.currentTime
    const dur = 3.2
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    let brown = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      brown = (brown + 0.02 * w) / 1.02
      d[i] = brown * 3.5
    }
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination)
    // crack
    const crackSrc = ctx.createBufferSource()
    const cb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate)
    const cd = cb.getChannelData(0)
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 3)
    crackSrc.buffer = cb
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.9, now)
    crackSrc.connect(hp).connect(cg).connect(out)
    crackSrc.start(now)
    // rumble
    const rs = ctx.createBufferSource(); rs.buffer = buf
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, now)
    lp.frequency.exponentialRampToValueAtTime(120, now + dur)
    const rg = ctx.createGain()
    rg.gain.setValueAtTime(0.0001, now)
    rg.gain.exponentialRampToValueAtTime(1.0, now + 0.06)
    for (let t = 0.3; t < 2.4; t += 0.35 + Math.random() * 0.3) rg.gain.setValueAtTime(0.4 + Math.random() * 0.6, now + t)
    rg.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    rs.connect(lp).connect(rg).connect(out)
    rs.start(now)
  } catch {
    /* audio unavailable */
  }
}
