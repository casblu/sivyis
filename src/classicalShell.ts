import * as THREE from 'three'
import {
  CLASSICAL_PERIODS,
  CLASSICAL_SHELL_HALF,
  CLASSICAL_SHELL_RADIUS,
  CLASSICAL_SUBS,
  type ClassicalPeriod,
} from './classicalData.ts'
import { fibonacciSphere } from './genreBall.ts'

/**
 * Classical outer shell renderer.
 *
 * Scale architecture: the sphere is split into CHUNKS angular cells (fibonacci
 * directions). Each cell is its own THREE.Points (one draw call, GPU-animated
 * drift, bounding sphere => frustum culled) and is only made visible when the
 * camera is within CHUNK_VIS_DIST. Per-quality draw ranges trim particle counts
 * on phones. The same cell index can later page in per-cell star/user data.
 */
const CHUNKS = 64
const PER_CHUNK = 900
const CHUNK_VIS_DIST = 760
const FADE_FAR = 520 // distance from shell surface where smoke starts appearing
const FADE_NEAR = 60

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function hash(i: number, s: number): number {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function smokeTexture(): THREE.CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  for (let i = 0; i < 7; i++) {
    const x = size * (0.3 + hash(i, 1) * 0.4)
    const y = size * (0.3 + hash(i, 2) * 0.4)
    const r = size * (0.18 + hash(i, 3) * 0.22)
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,0.6)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, size, size)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Smooth gradient color for a direction: soft-max blend of period + subgenre tints. */
function colorAt(d: THREE.Vector3, out: THREE.Color): THREE.Color {
  let r = 0, g = 0, b = 0, w = 0
  const tmp = new THREE.Color()
  for (const p of CLASSICAL_PERIODS) {
    const dot = d.x * p.dir[0] + d.y * p.dir[1] + d.z * p.dir[2]
    const k = Math.exp((dot - 1) * 4.5)
    tmp.setHex(p.color)
    r += tmp.r * k; g += tmp.g * k; b += tmp.b * k; w += k
  }
  for (const s of CLASSICAL_SUBS) {
    const dot = d.x * s.dir[0] + d.y * s.dir[1] + d.z * s.dir[2]
    const k = Math.exp((dot - 1) * 40) * 0.35
    tmp.setHex(s.color).offsetHSL(0.03, 0.05, 0.08)
    r += tmp.r * k; g += tmp.g * k; b += tmp.b * k; w += k
  }
  return out.setRGB(r / w, g / w, b / w)
}


const PULSES = 6
/** GLSL: rare soft glow pulses on the sphere (dir.xyz + start time; width rad + duration). */
const PULSE_GLSL = /* glsl */ `
  uniform vec4 uPulse[${PULSES}]; uniform vec2 uPulseB[${PULSES}];
  float shellPulse(vec3 n, float time) {
    float acc = 0.0;
    for (int i = 0; i < ${PULSES}; i++) {
      float age = (time - uPulse[i].w) / uPulseB[i].y;
      if (age <= 0.0 || age >= 1.0) continue;
      float env = sin(3.14159265 * age); env *= env;
      float w = uPulseB[i].x;
      float sp = exp((dot(n, uPulse[i].xyz) - 1.0) / (w * w * 0.5));
      acc += env * sp;
    }
    return min(acc, 1.5);
  }
`

type Chunk = { points: THREE.Points; center: THREE.Vector3; mat: THREE.ShaderMaterial }

export class ClassicalShell {
  readonly group = new THREE.Group()
  private chunks: Chunk[] = []
  private uTime = { value: 0 }
  private uPulse = { value: Array.from({ length: PULSES }, () => new THREE.Vector4(0, 1, 0, -100)) }
  private uPulseB = { value: Array.from({ length: PULSES }, () => new THREE.Vector2(0.2, 3)) }
  /** Next start time per pulse slot (CPU only schedules; GPU does all shading). */
  private pulseNext = Array.from({ length: PULSES }, (_, i) => 0.8 + i * 1.7 + Math.random() * 2)
  private drawCount = PER_CHUNK
  private periodCenters = CLASSICAL_PERIODS.map((p) => new THREE.Vector3(...p.dir).multiplyScalar(CLASSICAL_SHELL_RADIUS))
  private subCenters = CLASSICAL_SUBS.map((s) => new THREE.Vector3(...s.dir).multiplyScalar(CLASSICAL_SHELL_RADIUS))
  /** 0..1 how "inside the shell" the camera currently is (for UI/labels). */
  proximity = 0

  constructor(scene: THREE.Scene) {
    const tex = smokeTexture()
    const dirs = fibonacciSphere(CHUNKS, 1).map((d) => new THREE.Vector3(...d))
    const cellAngle = Math.sqrt((4 * Math.PI) / CHUNKS) * 0.75
    const d = new THREE.Vector3()
    const tA = new THREE.Vector3()
    const tB = new THREE.Vector3()
    const col = new THREE.Color()
    dirs.forEach((cd, ci) => {
      tA.set(0, 1, 0)
      if (Math.abs(cd.y) > 0.9) tA.set(1, 0, 0)
      tA.cross(cd).normalize()
      tB.crossVectors(cd, tA).normalize()
      const pos = new Float32Array(PER_CHUNK * 3)
      const colr = new Float32Array(PER_CHUNK * 3)
      const size = new Float32Array(PER_CHUNK)
      const seed = new Float32Array(PER_CHUNK)
      for (let i = 0; i < PER_CHUNK; i++) {
        const k = ci * PER_CHUNK + i
        const a = hash(k, 1) * Math.PI * 2
        const rr = Math.sqrt(hash(k, 2)) * cellAngle
        d.copy(cd).addScaledVector(tA, Math.cos(a) * rr).addScaledVector(tB, Math.sin(a) * rr).normalize()
        // Thicker toward mid-band (smoke) with wispy fringes
        const band = (hash(k, 3) + hash(k, 4) + hash(k, 5) - 1.5) / 1.5
        const r = CLASSICAL_SHELL_RADIUS + band * CLASSICAL_SHELL_HALF
        pos[i * 3] = d.x * r
        pos[i * 3 + 1] = d.y * r
        pos[i * 3 + 2] = d.z * r
        colorAt(d, col)
        col.offsetHSL((hash(k, 6) - 0.5) * 0.03, 0, (hash(k, 7) - 0.5) * 0.1)
        colr[i * 3] = col.r
        colr[i * 3 + 1] = col.g
        colr[i * 3 + 2] = col.b
        // ~18% big smoke puffs, rest fine dust (shuffled order so drawRange trims evenly)
        size[i] = hash(k, 8) < 0.3 ? 120 + hash(k, 9) * 160 : 4 + hash(k, 9) * 7
        seed[i] = hash(k, 10) * 100
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colr, 3))
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
      geo.computeBoundingSphere()
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: this.uTime, uPulse: this.uPulse, uPulseB: this.uPulseB, uRest: { value: 0.04 }, uOpacity: { value: 0 }, uMap: { value: tex }, uScale: { value: window.innerHeight * 0.5 } },
        vertexShader: /* glsl */ `
          attribute float aSize; attribute float aSeed; attribute vec3 color;
          uniform float uTime; uniform float uScale; uniform float uRest;
          varying vec3 vColor; varying float vFade; varying float vRot;
          ${PULSE_GLSL}
          void main() {
            vec3 p = position;
            float t = uTime * 0.05 + aSeed;
            p += vec3(sin(t * 1.3), cos(t * 0.9), sin(t * 1.1 + 2.0)) * (aSize > 30.0 ? 18.0 : 7.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float dist = -mv.z;
            gl_PointSize = clamp(aSize * uScale / max(dist, 1.0), 0.0, aSize > 30.0 ? 220.0 : 24.0);
            // Fade puffs that are right on the camera (fly-through) to avoid fill-rate spikes
            // Near-transparent at rest; rare pulses light the smoke in local period colors.
            float pl = shellPulse(normalize(position), uTime);
            vFade = smoothstep(4.0, 40.0, dist) * (aSize > 30.0 ? 0.7 : 1.0) * (uRest + pl * 1.1);
            vColor = color;
            vRot = aSeed + uTime * 0.02;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uOpacity;
          varying vec3 vColor; varying float vFade; varying float vRot;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float s = sin(vRot), co = cos(vRot);
            c = mat2(co, -s, s, co) * c;
            vec4 tx = texture2D(uMap, c + 0.5);
            float a = tx.a * uOpacity * vFade;
            if (a < 0.003) discard;
            gl_FragColor = vec4(vColor * 1.6, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
      const points = new THREE.Points(geo, mat)
      points.visible = false
      points.renderOrder = -1
      this.group.add(points)
      this.chunks.push({ points, center: cd.clone().multiplyScalar(CLASSICAL_SHELL_RADIUS), mat })
    })
    scene.add(this.group)
    this.glow = this.makeGlow()
    scene.add(this.glow)
  }

  /**
   * Distant haze: one back-faced sphere (single draw call) tinted by the period gradient,
   * very faint so the shell reads as a colored horizon from inside the galaxy / overview.
   * It fades out as you enter the band, where the particle smoke takes over.
   */
  private glow: THREE.Mesh
  private glowMat!: THREE.ShaderMaterial
  private makeGlow(): THREE.Mesh {
    const dirs = CLASSICAL_PERIODS.map((p) => new THREE.Vector3(...p.dir))
    const cols = CLASSICAL_PERIODS.map((p) => new THREE.Color(p.color))
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uDirs: { value: dirs }, uCols: { value: cols }, uOpacity: { value: 0.006 }, uPulseGain: { value: 0.4 }, uTime: this.uTime, uPulse: this.uPulse, uPulseB: this.uPulseB },
      vertexShader: /* glsl */ `
        varying vec3 vDir; varying vec3 vWorld;
        void main() {
          vDir = normalize(position);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDirs[${CLASSICAL_PERIODS.length}]; uniform vec3 uCols[${CLASSICAL_PERIODS.length}];
        uniform float uOpacity; uniform float uTime; uniform float uPulseGain;
        varying vec3 vDir; varying vec3 vWorld;
        ${PULSE_GLSL}
        void main() {
          vec3 c = vec3(0.0); float w = 0.0;
          for (int i = 0; i < ${CLASSICAL_PERIODS.length}; i++) {
            float k = exp((dot(vDir, uDirs[i]) - 1.0) * 4.5);
            c += uCols[i] * k; w += k;
          }
          c /= w;
          // soft cloudy banding so it reads as smoke, not a flat wall
          float n = 0.65 + 0.35 * sin(vDir.x * 9.0 + uTime * 0.03) * sin(vDir.y * 7.0 - uTime * 0.02) * sin(vDir.z * 8.0);
          vec3 view = normalize(vWorld - cameraPosition);
          float rim = 0.55 + 0.45 * (1.0 - abs(dot(view, vDir)));
          float pl = shellPulse(vDir, uTime);
          gl_FragColor = vec4(c * (1.0 + pl * 0.6), (uOpacity + pl * uPulseGain) * n * rim);
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const m = new THREE.Mesh(new THREE.SphereGeometry(CLASSICAL_SHELL_RADIUS + CLASSICAL_SHELL_HALF * 0.6, 48, 32), this.glowMat)
    m.renderOrder = -2
    m.frustumCulled = false
    return m
  }

  setQuality(q: 0 | 1 | 2): void {
    this.drawCount = q === 2 ? PER_CHUNK : q === 1 ? 600 : 420
    for (const c of this.chunks) c.points.geometry.setDrawRange(0, this.drawCount)
  }

  resize(): void {
    for (const c of this.chunks) c.mat.uniforms.uScale.value = window.innerHeight * 0.5
  }

  update(t: number, cam: THREE.Vector3): void {
    this.uTime.value = t
    const surf = Math.abs(cam.length() - CLASSICAL_SHELL_RADIUS)
    this.proximity = smooth(FADE_FAR, FADE_NEAR, surf)
    // Haze: faint from afar, swells a little on approach, gives way to particles inside the band.
    const approach = smooth(1300, 300, surf)
    const inside = smooth(CLASSICAL_SHELL_HALF * 1.6, CLASSICAL_SHELL_HALF * 0.4, surf)
    // Almost fully transparent at rest; a touch more inside the band so you can navigate.
    this.glowMat.uniforms.uOpacity.value = 0.004 + 0.03 * inside
    this.glowMat.uniforms.uPulseGain.value = 0.32 + 0.12 * approach
    this.schedulePulses(t)
    if (this.proximity <= 0.001) {
      if (this.group.visible) this.group.visible = false
      return
    }
    this.group.visible = true
    const base = 1.5 * this.proximity
    const rest = 0.03 + 0.22 * inside
    for (const c of this.chunks) c.mat.uniforms.uRest.value = rest
    for (const c of this.chunks) {
      const d = cam.distanceTo(c.center)
      const vis = d < CHUNK_VIS_DIST
      c.points.visible = vis
      if (vis) c.mat.uniforms.uOpacity.value = base * smooth(CHUNK_VIS_DIST, CHUNK_VIS_DIST * 0.5, d)
    }
  }

  private schedulePulses(t: number): void {
    for (let i = 0; i < PULSES; i++) {
      const p = this.uPulse.value[i]
      const b = this.uPulseB.value[i]
      const end = p.w + b.y
      if (t < end || t < this.pulseNext[i]) continue
      // Random point on the sphere, random size/length; then rest 2–9s before this slot fires again.
      const z = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const rr = Math.sqrt(1 - z * z)
      const dur = 2 + Math.random() * 2
      p.set(Math.cos(a) * rr, z, Math.sin(a) * rr, t)
      b.set(0.07 + Math.random() * 0.22, dur)
      this.pulseNext[i] = t + dur + 2 + Math.random() * 7
    }
  }

  /** World point just inside the shell along a direction (for "fly to Classical"). */
  entryPoint(dir: THREE.Vector3): THREE.Vector3 {
    return dir.clone().normalize().multiplyScalar(CLASSICAL_SHELL_RADIUS - CLASSICAL_SHELL_HALF * 1.6)
  }

  /** Nearest period region (+ nearest subgenre name) when the camera is near the shell. */
  nearestRegion(cam: THREE.Vector3): { period: ClassicalPeriod; sub: string; center: THREE.Vector3; distance: number } | null {
    if (this.proximity < 0.15) return null
    let bi = 0, bd = Infinity
    this.periodCenters.forEach((c, i) => { const d = cam.distanceTo(c); if (d < bd) { bd = d; bi = i } })
    let si = 0, sd = Infinity
    this.subCenters.forEach((c, i) => { const d = cam.distanceTo(c); if (d < sd) { sd = d; si = i } })
    const sub = CLASSICAL_SUBS[si]
    return {
      period: CLASSICAL_PERIODS[bi],
      sub: sd < 260 ? sub.name : '',
      center: sd < 260 ? this.subCenters[si] : this.periodCenters[bi],
      distance: bd,
    }
  }
}
