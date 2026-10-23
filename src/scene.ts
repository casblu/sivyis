import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  ARTISTS,
  GENRES,
  SUBGENRES,
  START_INSIDE_POS,
  START_LOOK_AT,
  baseArtistId,
  type Artist,
  type Genre,
  type GenreId,
  type Subgenre,
} from './artists.ts'
import { GENRE_NEBULA_PHOTO } from './nebulaPhotos.ts'
import { LightningFX, playThunder } from './lightning.ts'

export type StarHandle = {
  artist: Artist
  group: THREE.Group
  core: THREE.Mesh
  shell: THREE.Mesh
  /** Outer additive sphere halo — always circular silhouette (no Sprite). */
  glow: THREE.Mesh
  /** Invisible sphere kept at readable pick size when visuals shrink. */
  pickProxy: THREE.Mesh
  pulse: number
  /** Cached base core scale (artist.size * 1.55). */
  baseScale: number
}

export type NebulaHandle = {
  genre: Genre
  group: THREE.Group
  planes: THREE.Mesh[]
  /** Soft additive glow spheres (volumetric depth). */
  glows: THREE.Mesh[]
  particles: THREE.Points
  /** Base particle opacity at current quality (before distance fade). */
  particleBaseOpacity: number
  /** Base particle size at current quality (before distance fade). */
  particleBaseSize: number
}

/** Simple quality tier: 2 = full, 1 = medium, 0 = low (phone FPS rescue). */
export type QualityTier = 0 | 1 | 2

const FILAMENT_MAX_PER_ARTIST = 5
const FILAMENT_MAX_EDGE_FACTOR = 1.15

/** Camera distance where close-up mist is at full strength. */
const MIST_NEAR = 6
/** Camera distance where mist begins to fade in. */
const MIST_FAR = 38
const MIST_MAX_PARTICLES = 900

/** Distance LOD for artist orbs — shrink to a tiny spark when very close. */
const STAR_LOD_FAR = 36
/** Below this distance the star is at minimum spark scale. */
const STAR_LOD_NEAR = 4.5
/** Core visual scale multiplier at full close-up (tiny bright spark). */
const STAR_CLOSE_CORE_MUL = 0.09
/** Shell / halo shrink faster than the core so close-up is not a solid planet. */
const STAR_CLOSE_SHELL_MUL = 0.04
const STAR_CLOSE_HALO_MUL = 0.02
/** Invisible pick proxy stays at least this multiple of base core scale. */
const STAR_PICK_RADIUS_MUL = 2.8

/** Smoothstep 0→1 as distance goes FAR→NEAR. */
function starCloseFactor(dist: number): number {
  if (dist >= STAR_LOD_FAR) return 0
  if (dist <= STAR_LOD_NEAR) return 1
  const t = 1 - (dist - STAR_LOD_NEAR) / (STAR_LOD_FAR - STAR_LOD_NEAR)
  return t * t * (3 - 2 * t)
}

/**
 * Genre nebula / cluster smoke fade by camera distance to genre center.
 * Far / outside → 1 (full current opacity). Inside / very close → NEBULA_SMOKE_MIN_MUL.
 */
const NEBULA_SMOKE_NEAR_MUL = 0.35 // * genre.radius — nearly clear when this close
const NEBULA_SMOKE_FAR_MUL = 1.9 // * genre.radius — full smoke at/beyond this
/** Opacity multiplier when fully inside the cluster (nearly clear). */
const NEBULA_SMOKE_MIN_MUL = 0.08

/** Smoothstep 1→MIN as distance goes FAR→NEAR. */
function nebulaSmokeOpacityMul(dist: number, radius: number): number {
  const near = radius * NEBULA_SMOKE_NEAR_MUL
  const far = radius * NEBULA_SMOKE_FAR_MUL
  if (dist >= far) return 1
  if (dist <= near) return NEBULA_SMOKE_MIN_MUL
  const t = (dist - near) / (far - near)
  const s = t * t * (3 - 2 * t)
  return NEBULA_SMOKE_MIN_MUL + (1 - NEBULA_SMOKE_MIN_MUL) * s
}

function nebulaTexture(c1: string, c2: string, seed: number): THREE.CanvasTexture {
  // High-res procedural fallback when photo textures are still loading.
  const size = 1536
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, size, size)
  for (let i = 0; i < 9; i++) {
    const x = size * (0.25 + hash(i, seed) * 0.5)
    const y = size * (0.25 + hash(i, seed + 1) * 0.5)
    const r = size * (0.16 + hash(i, seed + 2) * 0.3)
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, i % 2 ? c1 : c2)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.globalCompositeOperation = i === 0 ? 'source-over' : 'lighter'
    g.fillRect(0, 0, size, size)
  }
  // Hard circular alpha mask — corners fully transparent so PlaneGeometry never shows square edges.
  g.globalCompositeOperation = 'destination-in'
  const cx = size / 2
  const cy = size / 2
  const mask = g.createRadialGradient(cx, cy, size * 0.22, cx, cy, size * 0.48)
  mask.addColorStop(0, 'rgba(255,255,255,1)')
  mask.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  mask.addColorStop(0.82, 'rgba(255,255,255,0.2)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = mask
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.premultiplyAlpha = false
  tex.needsUpdate = true
  return tex
}

function hash(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Soft circular particle map so Points read as luminous dots, not squares. */
function softParticleTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.28, 'rgba(255,255,255,0.7)')
  grd.addColorStop(0.55, 'rgba(200,220,255,0.25)')
  grd.addColorStop(0.82, 'rgba(180,200,255,0.06)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.beginPath()
  g.arc(cx, cy, size / 2, 0, Math.PI * 2)
  g.closePath()
  g.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.premultiplyAlpha = false
  tex.needsUpdate = true
  return tex
}


/**
 * Soft-masked NASA nebula billboard (one shared texture per genre — GPU-friendly).
 * Cover-crops photo into a circular alpha disk so PlaneGeometry never shows square edges.
 */
function photoNebulaTexture(img: HTMLImageElement, tintHex: number, seed = 1): THREE.CanvasTexture {
  const size = 1536
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d', { alpha: true })!
  g.clearRect(0, 0, size, size)

  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const zoom = 1.12 + hash(0, seed) * 0.2
  const scale = Math.max(size / iw, size / ih) * zoom
  const dw = iw * scale
  const dh = ih * scale
  const ox = (size - dw) / 2 + (hash(1, seed) - 0.5) * size * 0.08
  const oy = (size - dh) / 2 + (hash(2, seed) - 0.5) * size * 0.08
  g.drawImage(img, ox, oy, dw, dh)

  // Soft genre hue wash — keeps photo structure, ties to cluster color
  const tint = new THREE.Color(tintHex)
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = `rgba(${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)},0.22)`
  g.fillRect(0, 0, size, size)

  // Very light grain (sparse samples — fine detail without CPU blowup)
  g.globalCompositeOperation = 'soft-light'
  g.fillStyle = 'rgba(255,255,255,0.04)'
  for (let i = 0; i < 900; i++) {
    const x = hash(i, seed + 3) * size
    const y = hash(i, seed + 4) * size
    g.fillRect(x, y, 1.5, 1.5)
  }

  g.globalCompositeOperation = 'destination-in'
  const cx = size / 2
  const cy = size / 2
  const mask = g.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.49)
  mask.addColorStop(0, 'rgba(255,255,255,1)')
  mask.addColorStop(0.38, 'rgba(255,255,255,0.95)')
  mask.addColorStop(0.68, 'rgba(255,255,255,0.5)')
  mask.addColorStop(0.86, 'rgba(255,255,255,0.14)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = mask
  g.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.premultiplyAlpha = false
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

function loadNebulaImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`nebula load failed: ${src}`))
    img.src = src
  })
}

export class GalaxyScene {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  composer: EffectComposer
  stars: StarHandle[] = []
  subNebulaHandles: {
    sub: Subgenre
    group: THREE.Group
    planes: THREE.Mesh[]
    glows: THREE.Mesh[]
    particles: THREE.Points
    particleBaseOpacity: number
    particleBaseSize: number
  }[] = []
  nebulaHandles: NebulaHandle[] = []
  private starById = new Map<string, StarHandle>()
  private raycaster = new THREE.Raycaster()
  private pickables: THREE.Object3D[] = []
  private clock = new THREE.Clock()
  private lastDt = 1 / 60
  private selectedId: string | null = null
  private playingId: string | null = null
  private playingAmp = 0
  private field: THREE.Points
  private coreDust: THREE.Points
  private filaments: THREE.LineSegments | null = null
  private filamentMat: THREE.LineBasicMaterial | null = null
  private bloomPass: UnrealBloomPass
  private quality: QualityTier = 2
  private fpsEma = 60
  private lastQualityCheck = 0
  private baseBloomStrength = 0.28
  private allFilamentPositions: Float32Array | null = null
  private allFilamentColors: Float32Array | null = null
  private filamentEdgeCount = 0
  private mist: THREE.Points | null = null
  private mistMat: THREE.PointsMaterial | null = null
  private mistPositions: Float32Array | null = null
  private mistColors: Float32Array | null = null
  private mistVel: Float32Array | null = null
  private mistLife: Float32Array | null = null
  private mistParticleTex: THREE.CanvasTexture
  private mistCount = MIST_MAX_PARTICLES
  private mistIntensity = 0
  private mistStarId: string | null = null
  private sharedCoreGeo: THREE.SphereGeometry | null = null
  private sharedShellGeo: THREE.SphereGeometry | null = null
  private sharedHaloGeo: THREE.SphereGeometry | null = null
  private lightning: LightningFX | null = null
  private shakes = new Map<StarHandle, { age: number; base: THREE.Vector3; fired: boolean }>()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.78
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // Pixel ratio applied after composer exists via syncResolution()

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x010008)
    this.scene.fog = new THREE.FogExp2(0x03010a, 0.0032)

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900)
    // Start INSIDE the hollow genre ball, looking outward at surrounding clusters
    this.camera.position.set(...START_INSIDE_POS)
    this.camera.lookAt(...START_LOOK_AT)

    this.mistParticleTex = softParticleTexture()

    this.addLights()
    this.field = this.makeStarfield(5500, 480, 0.5)
    this.scene.add(this.field)
    this.scene.add(this.makeStarfield(1400, 260, 1.05))
    this.coreDust = this.makeCoreDust()
    this.scene.add(this.coreDust)
    this.addCoreGlow()
    this.spawnGenreNebulae()
    this.spawnSubgenreNebulae()
    this.spawnArtists()
    this.spawnFilaments()
    this.spawnStarMist()

    const renderPass = new RenderPass(this.scene, this.camera)
    // Bloom at full CSS resolution; EffectComposer multiplies by pixelRatio for HD buffers.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.baseBloomStrength,
      0.26,
      0.62,
    )
    const output = new OutputPass()
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(output)

    this.syncResolution()
    window.addEventListener('resize', this.onResize)
  }

  /** Max device pixel ratio by quality tier — never leave retina phones at 1x on HD. */
  private pixelRatioForQuality(q: QualityTier): number {
    const dpr = window.devicePixelRatio || 1
    // Was capped at 2 (looked soft on retina). HD tier now allows up to 3.
    if (q >= 2) return Math.min(dpr, 3)
    if (q === 1) return Math.min(dpr, 1.75)
    return Math.min(dpr, 1.25)
  }

  /** Keep drawing buffer, composer, and bloom at matching full-resolution sizes. */
  private syncResolution(): void {
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)
    const pr = this.pixelRatioForQuality(this.quality)
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(w, h, true)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.composer.setPixelRatio(pr)
    this.composer.setSize(w, h)
  }

  get dt(): number {
    this.lastDt = Math.min(0.05, this.clock.getDelta())
    return this.lastDt
  }

  getArtist(id: string): Artist | null {
    const direct = this.starById.get(id)?.artist
    if (direct) return direct
    const base = baseArtistId(id)
    for (const star of this.stars) {
      if (star.artist.baseId === base) return star.artist
    }
    return null
  }

  getStarPosition(id: string, out: THREE.Vector3): THREE.Vector3 | null {
    const h = this.starById.get(id)
    if (!h) return null
    return out.copy(h.group.position)
  }

  /** BTC send: violent star shake, then lightning burst + thunder. */
  zapArtist(id: string): void {
    const base = baseArtistId(id)
    const handles = this.stars.filter((s) => s.artist.id === id || s.artist.baseId === base)
    if (!handles.length) return
    this.lightning ??= new LightningFX(this.scene, () => this.quality === 0)
    for (const h of handles) {
      const prev = this.shakes.get(h)
      this.shakes.set(h, { age: 0, base: prev ? prev.base : h.group.position.clone(), fired: false })
    }
    playThunder()
  }

  private updateZaps(dt: number): void {
    for (const [h, s] of this.shakes) {
      s.age += dt
      const k = Math.max(0, 1 - s.age / 0.6)
      const amp = h.baseScale * 0.9 * k * k
      h.group.position.set(
        s.base.x + (Math.random() - 0.5) * amp,
        s.base.y + (Math.random() - 0.5) * amp,
        s.base.z + (Math.random() - 0.5) * amp,
      )
      if (!s.fired && s.age > 0.12) {
        s.fired = true
        this.lightning?.strike(s.base, h.baseScale)
      }
      if (s.age >= 0.6) {
        h.group.position.copy(s.base)
        this.shakes.delete(h)
      }
    }
    this.lightning?.update(dt)
  }

  setSelected(id: string | null): void {
    this.selectedId = id ? baseArtistId(id) : null
  }

  setPlaying(id: string | null, amplitude = 0): void {
    this.playingId = id ? baseArtistId(id) : null
    this.playingAmp = amplitude
  }

  pick(ndc: THREE.Vector2): Artist | null {
    this.raycaster.setFromCamera(ndc, this.camera)
    this.raycaster.params.Points = { threshold: 1.4 }
    const hits = this.raycaster.intersectObjects(this.pickables, true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        const id = obj.userData.artistId as string | undefined
        if (id) {
          const handle = this.starById.get(id)
          return handle?.artist ?? null
        }
        obj = obj.parent
      }
    }
    return null
  }

  nearest(origin: THREE.Vector3): { artist: Artist; distance: number } | null {
    let best: { artist: Artist; distance: number } | null = null
    for (const star of this.stars) {
      const d = origin.distanceTo(star.group.position)
      if (!best || d < best.distance) best = { artist: star.artist, distance: d }
    }
    return best
  }

  nearby(origin: THREE.Vector3, radius: number): { artist: Artist; distance: number }[] {
    const out: { artist: Artist; distance: number }[] = []
    for (const star of this.stars) {
      const d = origin.distanceTo(star.group.position)
      if (d <= radius) out.push({ artist: star.artist, distance: d })
    }
    out.sort((a, b) => a.distance - b.distance)
    return out
  }

  nearestGenre(origin: THREE.Vector3): { genre: Genre; distance: number } | null {
    let best: { genre: Genre; distance: number } | null = null
    for (const g of GENRES) {
      const d = origin.distanceTo(new THREE.Vector3(...g.center))
      if (!best || d < best.distance) best = { genre: g, distance: d }
    }
    return best
  }

  nearestSubgenre(origin: THREE.Vector3): { subgenre: Subgenre; distance: number } | null {
    let best: { subgenre: Subgenre; distance: number } | null = null
    for (const s of SUBGENRES) {
      const d = origin.distanceTo(new THREE.Vector3(...s.center))
      if (!best || d < best.distance) best = { subgenre: s, distance: d }
    }
    return best
  }

  worldToScreen(pos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(pos).project(this.camera)
    return out
  }

  render(elapsed: number): void {
    const t = elapsed
    this.field.rotation.y = t * 0.0025
    this.coreDust.rotation.y = t * 0.008

    const camPos = this.camera.position
    for (const neb of this.nebulaHandles) {
      const genreCenter = neb.group.position
      const distToGenre = camPos.distanceTo(genreCenter)
      const smokeMul = nebulaSmokeOpacityMul(distToGenre, neb.genre.radius)

      for (const plane of neb.planes) {
        plane.lookAt(this.camera.position)
        plane.rotation.z = (plane.userData.spin as number) + t * (plane.userData.spinSpeed as number)
        // Subtle breathing scale for living smoke
        const breath = 1 + Math.sin(t * 0.35 + (plane.userData.spin as number)) * 0.03
        plane.scale.setScalar(breath)
        const pMat = plane.material as THREE.MeshBasicMaterial
        const baseOp = (plane.userData.baseOpacity as number) ?? pMat.opacity
        pMat.opacity = baseOp * smokeMul
      }
      for (const glow of neb.glows) {
        const gMat = glow.material as THREE.MeshBasicMaterial
        const baseOp = (glow.userData.baseOpacity as number) ?? gMat.opacity
        gMat.opacity = baseOp * smokeMul
      }
      const pm = neb.particles.material as THREE.PointsMaterial
      pm.opacity = neb.particleBaseOpacity * smokeMul
      pm.size = neb.particleBaseSize * (0.45 + 0.55 * smokeMul)
      neb.particles.rotation.y = t * 0.015 * (neb.genre.id.length % 3 === 0 ? 1 : -1)
    }

    for (const neb of this.subNebulaHandles) {
      const distToSub = camPos.distanceTo(neb.group.position)
      const smokeMul = nebulaSmokeOpacityMul(distToSub, neb.sub.radius)
      for (const plane of neb.planes) {
        plane.lookAt(this.camera.position)
        plane.rotation.z = (plane.userData.spin as number) + t * (plane.userData.spinSpeed as number)
        const breath = 1 + Math.sin(t * 0.42 + (plane.userData.spin as number)) * 0.04
        plane.scale.setScalar(breath)
        const pMat = plane.material as THREE.MeshBasicMaterial
        const baseOp = (plane.userData.baseOpacity as number) ?? pMat.opacity
        pMat.opacity = baseOp * smokeMul
      }
      for (const glow of neb.glows) {
        const gMat = glow.material as THREE.MeshBasicMaterial
        const baseOp = (glow.userData.baseOpacity as number) ?? gMat.opacity
        gMat.opacity = baseOp * smokeMul
      }
      const pm = neb.particles.material as THREE.PointsMaterial
      pm.opacity = neb.particleBaseOpacity * smokeMul
      pm.size = neb.particleBaseSize * (0.45 + 0.55 * smokeMul)
      neb.particles.rotation.y = t * 0.02
    }

    const cam = this.camera.position
    for (const star of this.stars) {
      const selected =
        star.artist.baseId === this.selectedId || star.artist.id === this.selectedId
      const playing =
        star.artist.baseId === this.playingId || star.artist.id === this.playingId
      const ampPulse = playing ? 1 + this.playingAmp * 0.55 : 1
      const pulse = 0.92 + Math.sin(t * 2.1 + star.pulse) * 0.08
      const dist = cam.distanceTo(star.group.position)
      const close = starCloseFactor(dist)
      // Far: readable orb. Very close: tiny sharp emissive spark (not a solid planet).
      const selMul = selected ? 1.4 : 1
      const base = star.baseScale * selMul * pulse * ampPulse
      const coreMul = 1 + (STAR_CLOSE_CORE_MUL - 1) * close
      const shellMul = 1 + (STAR_CLOSE_SHELL_MUL - 1) * close
      const haloMul = 1 + (STAR_CLOSE_HALO_MUL - 1) * close
      star.core.scale.setScalar(base * coreMul)
      star.shell.scale.setScalar(base * 1.85 * shellMul)
      star.glow.scale.setScalar(base * 3.1 * haloMul)
      // Keep pick proxy large enough at all zoom levels
      star.pickProxy.scale.setScalar(star.baseScale * STAR_PICK_RADIUS_MUL * (selected ? 1.15 : 1))
      const shellMat = star.shell.material as THREE.MeshBasicMaterial
      const glowMat = star.glow.material as THREE.MeshBasicMaterial
      const amp = playing ? 0.85 + this.playingAmp * 0.35 : 1
      // Outer shells/halos fade faster than core so mist + spark dominate close-up
      const shellFade = 1 - close * 0.92
      const haloFade = 1 - close * 0.97
      shellMat.opacity = (selected ? 0.22 : 0.14) * pulse * amp * shellFade
      glowMat.opacity = (selected ? 0.1 : 0.055) * pulse * amp * haloFade
      // Slightly punchier emissive core when shrunk to a spark (still cinematic, not bloom-wash)
      const coreMat = star.core.material as THREE.MeshStandardMaterial
      coreMat.emissiveIntensity = 1.15 + close * 0.55
    }

    this.updateStarMist(t, this.lastDt)
    this.updateZaps(Math.min(this.lastDt, 0.05))
    const lf = this.lightning
    if (lf?.active) lf.applyCamera(this.camera)
    this.composer.render()
    if (lf?.active) lf.restoreCamera(this.camera)
  }

  /** Call once per frame with real dt to adapt quality on phones. */
  tickQuality(dt: number): void {
    if (dt <= 0 || dt > 0.2) return
    const fps = 1 / dt
    this.fpsEma = this.fpsEma * 0.92 + fps * 0.08
    const now = performance.now()
    if (now - this.lastQualityCheck < 2200) return
    this.lastQualityCheck = now

    let next: QualityTier = this.quality
    if (this.fpsEma < 28 && this.quality > 0) next = (this.quality - 1) as QualityTier
    else if (this.fpsEma > 50 && this.quality < 2) next = (this.quality + 1) as QualityTier
    if (next !== this.quality) this.applyQuality(next)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    if (this.mist) {
      this.scene.remove(this.mist)
      this.mist.geometry.dispose()
      this.mistMat?.dispose()
      this.mist = null
    }
    this.mistParticleTex.dispose()
    this.sharedCoreGeo?.dispose()
    this.sharedShellGeo?.dispose()
    this.sharedHaloGeo?.dispose()
    this.renderer.dispose()
    this.composer.dispose()
  }

  private applyQuality(q: QualityTier): void {
    this.quality = q
    if (this.bloomPass) {
      this.bloomPass.strength = q === 2 ? this.baseBloomStrength : q === 1 ? 0.2 : 0.12
    }
    if (this.filamentMat && this.allFilamentPositions && this.allFilamentColors) {
      const keep = q === 2 ? 1 : q === 1 ? 0.55 : 0.28
      this.rebuildFilamentBuffer(keep)
      this.filamentMat.opacity = q === 2 ? 0.035 : q === 1 ? 0.025 : 0.015
    }
    // Soften additive shells on low tier (no Sprite glow)
    for (const star of this.stars) {
      ;(star.shell.material as THREE.MeshBasicMaterial).opacity = q === 0 ? 0.08 : 0.14
      ;(star.glow.material as THREE.MeshBasicMaterial).opacity = q === 0 ? 0.03 : 0.055
    }
    this.applyMistQuality(q)
    this.syncResolution()
    // Hide outer smoke layers on low tiers for phone FPS.
    for (const neb of this.nebulaHandles) {
      neb.planes.forEach((plane, i) => {
        plane.visible = q === 2 ? true : q === 1 ? i < 4 : i < 2
      })
      neb.particleBaseOpacity = q === 2 ? 0.38 : q === 1 ? 0.28 : 0.18
      neb.particleBaseSize = q === 2 ? 0.7 : q === 1 ? 0.55 : 0.42
      const pm = neb.particles.material as THREE.PointsMaterial
      pm.opacity = neb.particleBaseOpacity
      pm.size = neb.particleBaseSize
    }
    for (const neb of this.subNebulaHandles) {
      neb.planes.forEach((plane, i) => {
        plane.visible = q === 2 ? true : q === 1 ? i < 2 : i < 1
      })
      neb.particleBaseOpacity = q === 2 ? 0.28 : q === 1 ? 0.2 : 0.12
      neb.particleBaseSize = q === 2 ? 0.5 : q === 1 ? 0.4 : 0.3
      const pm = neb.particles.material as THREE.PointsMaterial
      pm.opacity = neb.particleBaseOpacity
      pm.size = neb.particleBaseSize
    }
  }

  private rebuildFilamentBuffer(keepFraction: number): void {
    if (!this.filaments || !this.allFilamentPositions || !this.allFilamentColors) return
    const totalEdges = this.filamentEdgeCount
    const keep = Math.max(1, Math.floor(totalEdges * keepFraction))
    const pos = new Float32Array(keep * 6)
    const col = new Float32Array(keep * 6)
    // Take evenly spaced edges so structure remains
    for (let i = 0; i < keep; i++) {
      const src = Math.floor((i / keep) * totalEdges)
      pos.set(this.allFilamentPositions.subarray(src * 6, src * 6 + 6), i * 6)
      col.set(this.allFilamentColors.subarray(src * 6, src * 6 + 6), i * 6)
    }
    const geo = this.filaments.geometry
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.computeBoundingSphere()
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0x4a3a88, 0.2))
    const key = new THREE.PointLight(0x8899ff, 4.5, 260, 2)
    key.position.set(0, 10, 0)
    this.scene.add(key)
    const rim = new THREE.PointLight(0xff66cc, 2.5, 200, 2)
    rim.position.set(50, -12, -30)
    this.scene.add(rim)
  }

  private makeStarfield(count: number, radius: number, size: number): THREE.Points {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(hash(i, 1))
      const theta = hash(i, 2) * Math.PI * 2
      const phi = Math.acos(2 * hash(i, 3) - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.55
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const temp = hash(i, 4)
      if (temp < 0.15) color.setHSL(0.05, 0.45, 0.85)
      else if (temp < 0.3) color.setHSL(0.6, 0.35, 0.9)
      else color.setHSL(0.62, 0.08, 0.7 + temp * 0.25)
      col[i * 3] = color.r
      col[i * 3 + 1] = color.g
      col[i * 3 + 2] = color.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.PointsMaterial({
      map: this.mistParticleTex,
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      alphaTest: 0.02,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    return new THREE.Points(geo, mat)
  }

  private makeCoreDust(): THREE.Points {
    const count = 1800
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const r = 4 + hash(i, 20) * 28
      const theta = hash(i, 21) * Math.PI * 2
      const y = (hash(i, 22) - 0.5) * 10
      pos[i * 3] = Math.cos(theta) * r
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = Math.sin(theta) * r
      color.setHSL(0.08 + hash(i, 23) * 0.08, 0.55, 0.55 + hash(i, 24) * 0.2)
      col[i * 3] = color.r
      col[i * 3 + 1] = color.g
      col[i * 3 + 2] = color.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: this.mistParticleTex,
        size: 0.42,
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
        alphaTest: 0.02,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
  }

  private addCoreGlow(): void {
    // Galaxy-center glow as nested spheres only — circular from every angle (no Sprite).
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffe0c0,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.scene.add(inner)

    const mid = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb070,
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.scene.add(mid)

    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff8060,
        transparent: true,
        opacity: 0.02,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.scene.add(outer)
  }

  private spawnGenreNebulae(): void {
    GENRES.forEach((genre, gi) => {
      const group = new THREE.Group()
      group.position.set(...genre.center)
      group.userData.genreId = genre.id

      const planes: THREE.Mesh[] = []
      // Smoky volumetric layers — more translucent billboards with parallax offsets
      const layerDefs = [
        { w: 3.6, h: 2.7, op: 0.32, spin: 0.01 },
        { w: 3.1, h: 2.4, op: 0.26, spin: -0.014 },
        { w: 2.6, h: 2.1, op: 0.2, spin: 0.018 },
        { w: 2.2, h: 1.8, op: 0.16, spin: -0.011 },
        { w: 1.85, h: 1.55, op: 0.12, spin: 0.022 },
        { w: 1.5, h: 1.35, op: 0.09, spin: -0.016 },
      ]

      // Procedural fallback until NASA photo loads
      layerDefs.forEach((layer, i) => {
        const mat = new THREE.MeshBasicMaterial({
          map: nebulaTexture(genre.nebulaA, genre.nebulaB, gi * 17 + i * 3),
          color: new THREE.Color(genre.color),
          transparent: true,
          alphaTest: 0.015,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          opacity: layer.op,
        })
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(genre.radius * layer.w, genre.radius * layer.h),
          mat,
        )
        mesh.position.set(
          (hash(gi, i + 1) - 0.5) * genre.radius * 0.55,
          (hash(gi, i + 2) - 0.5) * genre.radius * 0.4,
          (hash(gi, i + 3) - 0.5) * genre.radius * 0.55,
        )
        mesh.userData.spin = hash(gi, i + 4) * Math.PI * 2
        mesh.userData.spinSpeed = layer.spin + hash(gi, i + 5) * 0.008
        mesh.userData.parallax = 0.35 + hash(gi, i + 6) * 0.55
        mesh.userData.baseOpacity = layer.op
        planes.push(mesh)
        group.add(mesh)
      })

      const color = new THREE.Color(genre.color)
      const glows: THREE.Mesh[] = []
      // Soft volumetric glow spheres for depth (not just flat billboards)
      for (let s = 0; s < 2; s++) {
        const glowOp = 0.03 - s * 0.01
        const glowSphere = new THREE.Mesh(
          new THREE.SphereGeometry(genre.radius * (0.85 - s * 0.2), 28, 28),
          new THREE.MeshBasicMaterial({
            color: color.clone().offsetHSL(0, -0.05, s === 0 ? 0 : 0.08),
            transparent: true,
            opacity: glowOp,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        glowSphere.position.set(
          (hash(gi, 40 + s) - 0.5) * genre.radius * 0.15,
          (hash(gi, 41 + s) - 0.5) * genre.radius * 0.1,
          (hash(gi, 42 + s) - 0.5) * genre.radius * 0.15,
        )
        glowSphere.userData.baseOpacity = glowOp
        glows.push(glowSphere)
        group.add(glowSphere)
      }

      const particles = this.makeClusterParticles(genre, gi)
      group.add(particles)

      this.scene.add(group)
      this.nebulaHandles.push({
        genre,
        group,
        planes,
        glows,
        particles,
        particleBaseOpacity: 0.38,
        particleBaseSize: 0.7,
      })

      // Swap in real NASA photography (public domain) when loaded
      const photo = GENRE_NEBULA_PHOTO[genre.id]
      void loadNebulaImage(photo.src)
        .then((img) => {
          const photoTex = photoNebulaTexture(img, genre.color, gi * 13)
          for (const plane of planes) {
            const mat = plane.material as THREE.MeshBasicMaterial
            const old = mat.map
            mat.map = photoTex
            mat.color.set(genre.color).lerp(new THREE.Color(0xffffff), 0.12)
            const nextOp = Math.min(0.38, ((plane.userData.baseOpacity as number) ?? mat.opacity) + 0.02)
            plane.userData.baseOpacity = nextOp
            mat.opacity = nextOp
            mat.needsUpdate = true
            old?.dispose()
          }
        })
        .catch(() => {
          /* keep procedural fallback */
        })
    })
  }

  private spawnSubgenreNebulae(): void {
    SUBGENRES.forEach((sub, si) => {
      const group = new THREE.Group()
      group.position.set(...sub.center)
      group.userData.subgenreId = sub.id

      const planes: THREE.Mesh[] = []
      const layerDefs = [
        { w: 2.4, h: 1.9, op: 0.2, spin: 0.016 },
        { w: 1.9, h: 1.55, op: 0.14, spin: -0.02 },
        { w: 1.45, h: 1.2, op: 0.1, spin: 0.024 },
      ]
      layerDefs.forEach((layer, i) => {
        const mat = new THREE.MeshBasicMaterial({
          map: nebulaTexture(sub.nebulaA, sub.nebulaB, si * 19 + i * 5),
          color: new THREE.Color(sub.color),
          transparent: true,
          alphaTest: 0.015,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          opacity: layer.op,
        })
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(sub.radius * layer.w, sub.radius * layer.h),
          mat,
        )
        mesh.position.set(
          (hash(si, i + 1) - 0.5) * sub.radius * 0.4,
          (hash(si, i + 2) - 0.5) * sub.radius * 0.3,
          (hash(si, i + 3) - 0.5) * sub.radius * 0.4,
        )
        mesh.userData.spin = hash(si, i + 4) * Math.PI * 2
        mesh.userData.spinSpeed = layer.spin + hash(si, i + 5) * 0.01
        mesh.userData.baseOpacity = layer.op
        planes.push(mesh)
        group.add(mesh)
      })

      const color = new THREE.Color(sub.color)
      const glows: THREE.Mesh[] = []
      const glowOp = 0.025
      const glowSphere = new THREE.Mesh(
        new THREE.SphereGeometry(sub.radius * 0.9, 20, 20),
        new THREE.MeshBasicMaterial({
          color: color.clone().offsetHSL(0, -0.04, 0.05),
          transparent: true,
          opacity: glowOp,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      glowSphere.userData.baseOpacity = glowOp
      glows.push(glowSphere)
      group.add(glowSphere)

      // Lightweight dust for local web
      const count = 280
      const pos = new Float32Array(count * 3)
      const col = new Float32Array(count * 3)
      const base = color.clone()
      for (let i = 0; i < count; i++) {
        const u = hash(i, si + 90)
        const v = hash(i, si + 91)
        const w = hash(i, si + 92)
        const theta = u * Math.PI * 2
        const phi = Math.acos(2 * v - 1)
        const rr = sub.radius * Math.pow(w, 0.42) * (0.3 + hash(i, si + 93) * 0.7)
        pos[i * 3] = rr * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = rr * Math.cos(phi) * 0.55
        pos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta)
        const shade = 0.45 + hash(i, si + 94) * 0.55
        col[i * 3] = base.r * shade
        col[i * 3 + 1] = base.g * shade
        col[i * 3 + 2] = base.b * shade
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const particles = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          map: this.mistParticleTex,
          size: 0.5,
          vertexColors: true,
          transparent: true,
          opacity: 0.28,
          alphaTest: 0.02,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        }),
      )
      group.add(particles)

      this.scene.add(group)
      this.subNebulaHandles.push({
        sub,
        group,
        planes,
        glows,
        particles,
        particleBaseOpacity: 0.28,
        particleBaseSize: 0.5,
      })
    })
  }

  private makeClusterParticles(genre: Genre, seed: number): THREE.Points {
    // Dense dusty core so artists feel embedded in smoke
    const count = 1400
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const base = new THREE.Color(genre.color)
    const alt = base.clone().offsetHSL(0.04, -0.1, 0.15)
    for (let i = 0; i < count; i++) {
      const u = hash(i, seed + 30)
      const v = hash(i, seed + 31)
      const w = hash(i, seed + 32)
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      // Tighter radial falloff (pow 0.38) — clustered smoky volume
      const rr = genre.radius * Math.pow(w, 0.38) * (0.28 + hash(i, seed + 33) * 0.72)
      pos[i * 3] = rr * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = rr * Math.cos(phi) * 0.5
      pos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta)
      const c = hash(i, seed + 34) > 0.55 ? alt : base
      const shade = 0.5 + hash(i, seed + 35) * 0.5
      col[i * 3] = c.r * shade
      col[i * 3 + 1] = c.g * shade
      col[i * 3 + 2] = c.b * shade
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: this.mistParticleTex,
        size: 0.7,
        vertexColors: true,
        transparent: true,
        opacity: 0.38,
        alphaTest: 0.02,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
  }

  private spawnArtists(): void {
    // Shared HD sphere geometries — circular silhouette from every camera angle.
    // NO Sprites: mobile alpha failure turns Sprites into hard squares.
    this.sharedCoreGeo = new THREE.SphereGeometry(1, 48, 32)
    this.sharedShellGeo = new THREE.SphereGeometry(1, 32, 24)
    this.sharedHaloGeo = new THREE.SphereGeometry(1, 24, 16)

    for (const artist of ARTISTS) {
      const group = new THREE.Group()
      group.position.set(...artist.position)
      group.userData.artistId = artist.id

      const color = new THREE.Color(artist.color)
      // Bright solid orb core — larger so it reads as a ball, not a pixel.
      const coreScale = artist.size * 1.55
      const core = new THREE.Mesh(
        this.sharedCoreGeo,
        new THREE.MeshStandardMaterial({
          color: color.clone().multiplyScalar(0.55),
          emissive: color,
          emissiveIntensity: 1.15,
          roughness: 0.16,
          metalness: 0.06,
        }),
      )
      core.scale.setScalar(coreScale)
      core.userData.artistId = artist.id

      // Soft volumetric mid shell — additive sphere, always round.
      const shell = new THREE.Mesh(
        this.sharedShellGeo,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      shell.scale.setScalar(coreScale * 1.75)
      shell.userData.artistId = artist.id

      // Outer halo shell — soft bloom rim without Sprite squares.
      const glow = new THREE.Mesh(
        this.sharedHaloGeo,
        new THREE.MeshBasicMaterial({
          color: color.clone().lerp(new THREE.Color(0xffffff), 0.35),
          transparent: true,
          opacity: 0.055,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      glow.scale.setScalar(coreScale * 3.1)
      glow.userData.artistId = artist.id

      // Invisible pick proxy — stays large when visuals LOD-shrink so selection still works.
      const pickProxy = new THREE.Mesh(
        this.sharedCoreGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          colorWrite: false,
        }),
      )
      pickProxy.scale.setScalar(coreScale * STAR_PICK_RADIUS_MUL)
      pickProxy.userData.artistId = artist.id

      group.add(glow)
      group.add(shell)
      group.add(core)
      group.add(pickProxy)
      this.scene.add(group)

      const handle: StarHandle = {
        artist,
        group,
        core,
        shell,
        glow,
        pickProxy,
        pulse: hash(artist.name.length, 4.2) * Math.PI * 2,
        baseScale: coreScale,
      }
      this.stars.push(handle)
      this.starById.set(artist.id, handle)
      this.pickables.push(pickProxy)
    }
  }

  /** Pooled luminous mist particles — intensify when camera nears a star. */
  private spawnStarMist(): void {
    const count = MIST_MAX_PARTICLES
    this.mistCount = count
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const life = new Float32Array(count)
    // Park off-screen until first activation
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] = -9999
      life[i] = 0
    }
    this.mistPositions = pos
    this.mistColors = col
    this.mistVel = vel
    this.mistLife = life

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))

    this.mistMat = new THREE.PointsMaterial({
      map: this.mistParticleTex,
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      alphaTest: 0.015,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.mist = new THREE.Points(geo, this.mistMat)
    this.mist.frustumCulled = false
    this.mist.visible = false
    this.scene.add(this.mist)
    this.applyMistQuality(this.quality)
  }

  private applyMistQuality(q: QualityTier): void {
    if (!this.mist || !this.mistMat) return
    // High tier: full HD fine mist; medium/low cut count for FPS.
    const count = q === 2 ? MIST_MAX_PARTICLES : q === 1 ? 360 : 120
    this.mistCount = count
    this.mist.geometry.setDrawRange(0, count)
    // Base size; updateStarMist further refines for close-up HD sparkles.
    this.mistMat.size = q === 2 ? 0.16 : q === 1 ? 0.2 : 0.24
  }

  private respawnMistParticle(
    i: number,
    origin: THREE.Vector3,
    color: THREE.Color,
    starSize: number,
    closeFactor: number,
  ): void {
    const pos = this.mistPositions!
    const vel = this.mistVel!
    const col = this.mistColors!
    const life = this.mistLife!
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    // Peel off the tiny spark surface when close; wider shell when far/mid.
    const visualR = starSize * (0.12 + (1 - closeFactor) * 0.95)
    const r = visualR * (0.7 + Math.random() * (0.9 + closeFactor * 1.4))
    const ox = Math.sin(phi) * Math.cos(theta)
    const oy = Math.cos(phi)
    const oz = Math.sin(phi) * Math.sin(theta)
    pos[i * 3] = origin.x + ox * r
    pos[i * 3 + 1] = origin.y + oy * r
    pos[i * 3 + 2] = origin.z + oz * r
    // Close-up: faster peel + soft upward luminous smoke; mid: gentler drift
    const speed = (0.25 + Math.random() * 0.7) * (0.7 + closeFactor * 1.1)
    vel[i * 3] = ox * speed + (Math.random() - 0.5) * (0.2 + closeFactor * 0.35)
    vel[i * 3 + 1] = oy * speed * 0.45 + 0.15 + Math.random() * (0.35 + closeFactor * 0.55)
    vel[i * 3 + 2] = oz * speed + (Math.random() - 0.5) * (0.2 + closeFactor * 0.35)
    // Keep mist luminous but not bloom-wash — slightly cooler highlight
    const bright = 0.55 + Math.random() * 0.35
    col[i * 3] = Math.min(1, color.r * bright + 0.18)
    col[i * 3 + 1] = Math.min(1, color.g * bright + 0.16)
    col[i * 3 + 2] = Math.min(1, color.b * bright + 0.28)
    life[i] = 0.4 + Math.random() * (0.55 + closeFactor * 0.35)
  }

  /**
   * Mist triggers by camera distance to the nearest (or selected) artist star.
   * Full strength inside MIST_NEAR; fades out by MIST_FAR. Hero of the close-up look.
   */
  private updateStarMist(t: number, dt: number): void {
    if (!this.mist || !this.mistMat || !this.mistPositions || !this.mistVel || !this.mistLife || !this.mistColors) {
      return
    }

    let target: StarHandle | null = null
    let bestDist = Infinity
    const cam = this.camera.position

    if (this.selectedId) {
      const sel = this.starById.get(this.selectedId)
      if (sel) {
        const d = cam.distanceTo(sel.group.position)
        if (d < MIST_FAR) {
          target = sel
          bestDist = d
        }
      }
    }
    if (!target) {
      let bestD2 = Infinity
      for (const star of this.stars) {
        const d2 = cam.distanceToSquared(star.group.position)
        if (d2 < bestD2) {
          bestD2 = d2
          target = star
        }
      }
      bestDist = target ? Math.sqrt(bestD2) : Infinity
    }

    let desired = 0
    if (target && bestDist < MIST_FAR) {
      desired = 1 - (bestDist - MIST_NEAR) / (MIST_FAR - MIST_NEAR)
      desired = Math.max(0, Math.min(1, desired))
      // Soften on low FPS tiers
      desired *= this.quality === 2 ? 1 : this.quality === 1 ? 0.72 : 0.42
    }
    this.mistIntensity += (desired - this.mistIntensity) * Math.min(1, dt * 4.5)

    if (this.mistIntensity < 0.02 || !target) {
      this.mist.visible = false
      this.mistMat.opacity = 0
      this.mistStarId = null
      return
    }

    const origin = target.group.position
    const starColor = (target.core.material as THREE.MeshStandardMaterial).emissive
    const starSize = target.artist.size
    const close = starCloseFactor(bestDist)
    const switched = this.mistStarId !== target.artist.id
    this.mistStarId = target.artist.id

    this.mist.visible = true
    // Dense soft mist when close — capped so bloom stays cinematic
    this.mistMat.opacity = (0.22 + close * 0.2) * this.mistIntensity
    // HD fine particles up close; slightly larger soft dots at mid range
    const qSize = this.quality === 2 ? 0.12 : this.quality === 1 ? 0.16 : 0.2
    this.mistMat.size = qSize * (1.15 - close * 0.45)
    const count = this.mistCount
    const pos = this.mistPositions
    const vel = this.mistVel
    const life = this.mistLife
    const wobble = Math.sin(t * 1.7) * (0.06 + close * 0.1)

    for (let i = 0; i < count; i++) {
      if (switched) life[i] = 0
      // Faster turnover when close → denser peeling smoke feel
      life[i] -= dt * (0.32 + close * 0.45 + (1 - this.mistIntensity) * 0.4)
      if (life[i] <= 0) {
        this.respawnMistParticle(i, origin, starColor, starSize, close)
        continue
      }
      const ix = i * 3
      pos[ix] += vel[ix] * dt
      pos[ix + 1] += (vel[ix + 1] + wobble) * dt
      pos[ix + 2] += vel[ix + 2] * dt
      // Gentle curl — stronger near spark for living smoke ribbons
      const curl = 0.12 + close * 0.22
      vel[ix] += Math.sin(t * 2 + i) * dt * curl
      vel[ix + 2] += Math.cos(t * 1.6 + i * 0.7) * dt * curl
    }

    ;(this.mist.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.mist.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  /**
   * Ultra-transparent genre-neighbor filaments (same-cluster k-NN).
   * Long edges culled; ~3–5 connections per artist; bloom reads them as structure.
   */
  private spawnFilaments(): void {
    const byGenre = new Map<GenreId, Artist[]>()
    for (const a of ARTISTS) {
      const list = byGenre.get(a.genreId) ?? []
      list.push(a)
      byGenre.set(a.genreId, list)
    }

    const edges: { a: Artist; b: Artist }[] = []
    const seen = new Set<string>()

    for (const genre of GENRES) {
      const members = byGenre.get(genre.id) ?? []
      const maxDist = genre.radius * FILAMENT_MAX_EDGE_FACTOR
      const degree = new Map<string, number>()

      for (const a of members) {
        const neighbors = members
          .filter((b) => b.id !== a.id)
          .map((b) => {
            const dx = a.position[0] - b.position[0]
            const dy = a.position[1] - b.position[1]
            const dz = a.position[2] - b.position[2]
            return { b, d: Math.hypot(dx, dy, dz) }
          })
          .filter((n) => n.d <= maxDist)
          .sort((x, y) => x.d - y.d)
          .slice(0, FILAMENT_MAX_PER_ARTIST)

        for (const { b } of neighbors) {
          const da = degree.get(a.id) ?? 0
          const db = degree.get(b.id) ?? 0
          if (da >= FILAMENT_MAX_PER_ARTIST || db >= FILAMENT_MAX_PER_ARTIST) continue
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
          if (seen.has(key)) continue
          seen.add(key)
          edges.push({ a, b })
          degree.set(a.id, da + 1)
          degree.set(b.id, db + 1)
        }
      }
    }

    const pos = new Float32Array(edges.length * 6)
    const col = new Float32Array(edges.length * 6)
    const ca = new THREE.Color()
    const cb = new THREE.Color()

    edges.forEach((e, i) => {
      const o = i * 6
      pos[o] = e.a.position[0]
      pos[o + 1] = e.a.position[1]
      pos[o + 2] = e.a.position[2]
      pos[o + 3] = e.b.position[0]
      pos[o + 4] = e.b.position[1]
      pos[o + 5] = e.b.position[2]
      ca.set(e.a.color)
      cb.set(e.b.color)
      // Soft blend toward cyan-ish structure without copying external palettes
      ca.lerp(new THREE.Color(0x6ec8ff), 0.35)
      cb.lerp(new THREE.Color(0x6ec8ff), 0.35)
      col[o] = ca.r
      col[o + 1] = ca.g
      col[o + 2] = ca.b
      col[o + 3] = cb.r
      col[o + 4] = cb.g
      col[o + 5] = cb.b
    })

    this.allFilamentPositions = pos
    this.allFilamentColors = col
    this.filamentEdgeCount = edges.length

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col.slice(), 3))

    this.filamentMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })

    this.filaments = new THREE.LineSegments(geo, this.filamentMat)
    this.filaments.frustumCulled = false
    // Disabled: LineSegments read as HUD arrows/lined clutter in the galaxy view.
    this.filaments.visible = false
    this.scene.add(this.filaments)
  }

  private onResize = (): void => {
    this.syncResolution()
  }
}

export type { GenreId }
