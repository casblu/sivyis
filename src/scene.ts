import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import {
  ARTISTS,
  GENRE_BY_ID,
  GENRES,
  SUBGENRES,
  OVERVIEW_ORBIT_RADIUS,
  baseArtistId,
  shineFromEnergy,
  type Artist,
  type Genre,
  type GenreId,
  type Subgenre,
} from './artists.ts'
import { GENRE_NEBULA_PHOTO } from './nebulaPhotos.ts'
import { LightningFX } from './lightning.ts'
import { stageTexture } from './stellarStages.ts'
import { buildSkeleton, maskBank, puffTexture, dustTexture, rng, type SkelPoint } from './nebulaShape.ts'


/**
 * Soft volumetric glow for star spheres. Alpha falls off with view-facing (fresnel) so the
 * silhouette is always fully transparent — never a hard circle — and fades out as the camera
 * nears/enters the sphere so close-ups show only soft light.
 */
/** Star visibility vs camera distance to genre center, in genre radii */
const STAR_VIS_FAR = 1.6
const STAR_VIS_NEAR = 1.0
const MEMORIAL_GOLD = 0xffe7b0

class SoftGlowMaterial extends THREE.ShaderMaterial {
  constructor(color: THREE.Color, opacity: number, power: number, intensity = 1) {
    super({
      uniforms: {
        uColor: { value: color.clone() },
        uOpacity: { value: opacity },
        uPower: { value: power },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV; varying float vNear;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vec3 center = modelMatrix[3].xyz;
          float radius = length(modelMatrix[0].xyz);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          float camD = length(cameraPosition - center);
          vNear = smoothstep(radius * 0.5, radius * 1.8, camD);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; uniform float uPower; uniform float uIntensity;
        varying vec3 vN; varying vec3 vV; varying float vNear;
        void main(){
          float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
          float a = pow(f, uPower) * smoothstep(0.0, 0.35, f);
          a *= uOpacity * vNear;
          if (a < 0.0015) discard;
          // AdditiveBlending already multiplies by alpha — do not premultiply (that squared the falloff and killed bloom/mist).
          gl_FragColor = vec4(uColor * uIntensity, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    })
  }
  get opacity(): number { return (this as any).uniforms?.uOpacity.value ?? 1 }
  set opacity(v: number) { const u = (this as any).uniforms; if (u) u.uOpacity.value = v }
  get emissive(): THREE.Color { return this.uniforms.uColor.value }
  get emissiveIntensity(): number { return this.uniforms.uIntensity.value }
  set emissiveIntensity(v: number) { this.uniforms.uIntensity.value = v }
}

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
  /** Extra wide warm halo for memorial stars */
  memorialHalo?: THREE.Mesh
  /** Stage sprite: planetary nebula / supernova remnant / protostar cocoon+jets */
  stageFx?: THREE.Sprite
  stageFxScale?: number
  /** 0..1 nebula-proximity visibility (stars hidden from far away) */
  vis: number
  genreCenter: THREE.Vector3
  genreRadius: number
  /** Cached luminosity (catalog glow + received Energy). */
  baseBrightness: number
  /** 1 → 0 burst when Energy is sent, added on top of baseBrightness. */
  energyFlash: number
}

export type NebulaHandle = {
  genre: Genre
  group: THREE.Group
  /** Merged billboard puff meshes (one draw per texture). */
  puffMeshes: THREE.Mesh[]
  puffMats: THREE.ShaderMaterial[]
  /** World-space skeleton points + radii for the proximity metric. */
  skel: THREE.Vector3[]
  skelR: number[]
  /** Signed distance (world units) from camera to cloud surface, updated per frame. */
  surfDist: number
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

/**
 * Shared billboard vertex for genre puffs.
 * Motion is a slow ellipse (sin/cos) so mist drifts and loops in place —
 * the cloud never migrates off the genre shell, and there is no jitter.
 */
const NEBULA_PUFF_VERT = `
attribute vec2 corner;
attribute vec2 psize;
attribute vec2 prot;
attribute vec4 pcol;
attribute vec4 pdrift;
uniform float uTime;
uniform vec3 uWind;
uniform float uLayer;
varying vec2 vUv;
varying vec4 vCol;
varying float vPhase;
void main(){
  vec3 pos = position;
  float spd = 0.11 + 0.05 * fract(pdrift.w * 0.3183);
  float w = uTime * spd + pdrift.w;
  vec3 dir = pdrift.xyz;
  pos += dir * sin(w);
  pos += vec3(dir.z, dir.x * 0.35, -dir.y) * cos(w * 0.67) * 0.42;
  float wt = uTime * 0.085 + uLayer;
  pos += vec3(uWind.x, uWind.y * 0.65, uWind.z) * sin(wt);
  pos += vec3(-uWind.z * 0.75, uWind.y * 0.3, uWind.x * 0.75) * cos(wt * 0.81);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float ang = prot.x + uTime * prot.y;
  float c = cos(ang), s = sin(ang);
  vec2 q = corner * psize;
  q *= 1.0 + 0.04 * sin(uTime * 0.12 + pdrift.w);
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  float near = smoothstep(min(psize.x, psize.y) * 0.2, max(psize.x, psize.y) * 0.7, -mv.z);
  vUv = corner + 0.5;
  vCol = vec4(pcol.rgb, pcol.a * near);
  vPhase = pdrift.w;
  gl_Position = projectionMatrix * mv;
}
`

const NEBULA_SMOKE_GLSL = `
float smokeHash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float smokeNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = smokeHash(i);
  float b = smokeHash(i + vec2(1.0, 0.0));
  float c = smokeHash(i + vec2(0.0, 1.0));
  float d = smokeHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`

const NEBULA_PUFF_FRAG = `
uniform sampler2D map;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying float vPhase;
${NEBULA_SMOKE_GLSL}
void main(){
  float n1 = smokeNoise(vUv * 2.15 + vec2(uTime * 0.024, uTime * 0.015) + vPhase);
  float n2 = smokeNoise(vUv * 1.45 + vec2(-uTime * 0.016, uTime * 0.019) + vPhase * 1.37);
  vec2 uv = vUv + (vec2(n1, n2) - 0.5) * 0.075;
  vec4 t = texture2D(map, uv);
  float a = t.a;
  a = a * a * (3.0 - 2.0 * a);
  a *= (0.82 + 0.18 * n1) * (0.9 + 0.1 * n2);
  a *= vCol.a * uOpacity;
  if (a < 0.004) discard;
  vec3 col = t.rgb * mix(vec3(1.0), vCol.rgb * 1.35, 0.48);
  gl_FragColor = vec4(col * a, a);
}
`

const NEBULA_DUST_FRAG = `
uniform sampler2D map;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying float vPhase;
${NEBULA_SMOKE_GLSL}
void main(){
  float n1 = smokeNoise(vUv * 2.15 + vec2(uTime * 0.02, uTime * 0.013) + vPhase);
  float n2 = smokeNoise(vUv * 1.45 + vec2(-uTime * 0.014, uTime * 0.017) + vPhase * 1.2);
  vec2 uv = vUv + (vec2(n1, n2) - 0.5) * 0.07;
  float a = texture2D(map, uv).a;
  a = a * a * (3.0 - 2.0 * a);
  a *= (0.8 + 0.2 * n1) * vCol.a * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`

/** Slow GPU drift for cluster dust motes. Keeps PointsMaterial LOD (opacity / size). */
function bindNebulaPointDrift(mat: THREE.PointsMaterial): void {
  mat.customProgramCacheKey = () => 'cosmoly-nebula-smoke-points'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    mat.userData.uTime = shader.uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec3 aDrift;
         attribute float aPhase;
         uniform float uTime;
         varying float vSmokePhase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float w = uTime * 0.12 + aPhase;
         vec3 drift = aDrift * sin(w);
         drift.x += aDrift.z * cos(w * 0.71) * 0.4;
         drift.z -= aDrift.x * cos(w * 0.71) * 0.4;
         transformed += drift;
         vSmokePhase = aPhase;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vSmokePhase;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.a *= 0.82 + 0.18 * sin(uTime * 0.11 + vSmokePhase);`,
      )
  }
}

export function nebulaTexture(c1: string, c2: string, seed: number): THREE.CanvasTexture {
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
export function photoNebulaTexture(img: HTMLImageElement, tintHex: number, seed = 1): THREE.CanvasTexture {
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
  private nebulaByGenre = new Map<string, NebulaHandle>()
  private starById = new Map<string, StarHandle>()
  private raycaster = new THREE.Raycaster()
  private genreVis = new Map<string, number>()
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
  private lightning: LightningFX | null = null
  private shakes = new Map<StarHandle, { age: number; base: THREE.Vector3; fired: boolean }>()
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
    this.camera.position.set(0, 4 + OVERVIEW_ORBIT_RADIUS * 0.35, OVERVIEW_ORBIT_RADIUS)
    this.camera.lookAt(0, 4, 0)

    this.mistParticleTex = softParticleTexture()

    this.addLights()
    this.field = this.makeStarfield(5500, 480, 0.5)
    this.scene.add(this.field)
    this.scene.add(this.makeStarfield(1400, 260, 1.05))
    this.coreDust = this.makeCoreDust()
    // removed: orange galactic-core dust + glow spheres at origin (Txai 10/23)
    void this.addCoreGlow
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
    if (this.lite) return Math.min(dpr, 1)
    // Was capped at 2 (looked soft on retina). HD tier now allows up to 3.
    if (q >= 2) return Math.min(dpr, 2)
    if (q === 1) return Math.min(dpr, 1.5)
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

  private lite = false
  /** Cheap render (1x pixel ratio) while a zap overlay is on screen. */
  setLite(on: boolean): void {
    if (this.lite === on) return
    this.lite = on
    this.syncResolution()
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

  /**
   * Recompute luminosity from Energy received (plays + zaps).
   * Pass pulseId to briefly brighten that star.
   */
  syncEnergy(satsFor: (artist: Artist) => number, pulseId?: string | null): void {
    const pulseBase = pulseId ? baseArtistId(pulseId) : null
    for (const h of this.stars) {
      h.baseBrightness = shineFromEnergy(h.artist, satsFor(h.artist))
      if (pulseBase && h.artist.baseId === pulseBase) h.energyFlash = 1
    }
  }

  /** Energy zap: violent star shake, then lightning burst + thunder. */
  zapArtist(id: string): void {
    const base = baseArtistId(id)
    const handles = this.stars.filter((s) => s.artist.id === id || s.artist.baseId === base)
    if (!handles.length) return
    this.lightning ??= new LightningFX(this.scene, () => this.quality === 0)
    for (const h of handles) {
      const prev = this.shakes.get(h)
      this.shakes.set(h, { age: 0, base: prev ? prev.base : h.group.position.clone(), fired: false })
    }
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
    this.updateSelRing()
    this.updateViewShift(dt)
  }

  private selRing: THREE.Mesh | null = null
  private viewShift = { x: 0, y: 0, tx: 0, ty: 0 }

  /** Shift the projection so the scene centre sits in the area not covered by a panel (px). */
  setViewShift(x: number, y: number): void {
    this.viewShift.tx = x
    this.viewShift.ty = y
  }

  private updateViewShift(dt: number): void {
    const v = this.viewShift
    const k = 1 - Math.exp(-dt * 6)
    v.x += (v.tx - v.x) * k
    v.y += (v.ty - v.y) * k
    if (Math.abs(v.x - v.tx) < 0.3) v.x = v.tx
    if (Math.abs(v.y - v.ty) < 0.3) v.y = v.ty
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)
    if (v.x === 0 && v.y === 0) {
      if (this.camera.view?.enabled) this.camera.clearViewOffset()
    } else {
      this.camera.setViewOffset(w, h, v.x, v.y, w, h)
    }
  }

  private updateSelRing(): void {
    if (!this.selRing) {
      const geo = new THREE.RingGeometry(1, 1.08, 96)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      this.selRing = new THREE.Mesh(geo, mat)
      this.selRing.renderOrder = 10
      this.scene.add(this.selRing)
    }
    const ring = this.selRing
    const sel = this.selectedId ? this.starById.get(this.selectedId) : null
    if (!sel) {
      ring.visible = false
      return
    }
    ring.visible = true
    ring.position.copy(sel.group.position)
    ring.quaternion.copy(this.camera.quaternion)
    const d = this.camera.position.distanceTo(sel.group.position)
    const t = performance.now() / 1000
    ring.scale.setScalar(Math.max(1.6, d * 0.075) * (1 + Math.sin(t * 2.4) * 0.04))
    const mat = ring.material as THREE.MeshBasicMaterial
    mat.color.setHex(sel.artist.color)
    mat.opacity = 0.55 + Math.sin(t * 2.4) * 0.15
  }

  /** Screen-space pick: nearest visible star within radiusPx of (x,y). */
  pickScreen(x: number, y: number, radiusPx: number): Artist | null {
    const w = window.innerWidth
    const h = window.innerHeight
    const v = new THREE.Vector3()
    let best: Artist | null = null
    let bestScore = Infinity
    for (const star of this.stars) {
      if (!star.group.visible || star.vis < 0.35) continue
      v.copy(star.group.position).project(this.camera)
      if (v.z < -1 || v.z > 1) continue
      const sx = (v.x * 0.5 + 0.5) * w
      const sy = (-v.y * 0.5 + 0.5) * h
      const d = Math.hypot(sx - x, sy - y)
      if (d > radiusPx) continue
      const score = d + v.z * 4
      if (score < bestScore) {
        bestScore = score
        best = star.artist
      }
    }
    return best
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
          if (!handle || handle.vis < 0.35) break
          return handle.artist
        }
        obj = obj.parent
      }
    }
    return null
  }

  nearest(origin: THREE.Vector3): { artist: Artist; distance: number } | null {
    let best: { artist: Artist; distance: number } | null = null
    for (const star of this.stars) {
      if (star.vis < 0.35) continue
      const d = origin.distanceTo(star.group.position)
      if (!best || d < best.distance) best = { artist: star.artist, distance: d }
    }
    return best
  }

  nearby(origin: THREE.Vector3, radius: number): { artist: Artist; distance: number }[] {
    const out: { artist: Artist; distance: number }[] = []
    for (const star of this.stars) {
      // Hidden (not-yet-faded-in) stars stay silent.
      if (star.vis < 0.35) continue
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
      // Distance to the irregular cloud surface (nearest skeleton puff), not to a sphere.
      let sd = Infinity
      for (let i = 0; i < neb.skel.length; i++) {
        const d = camPos.distanceTo(neb.skel[i]) - neb.skelR[i]
        if (d < sd) sd = d
      }
      neb.surfDist = sd
      // Map to the legacy centre-distance scale (surface ~= 1.0R) for the smoke LOD.
      const smokeMul = nebulaSmokeOpacityMul(neb.genre.radius * (1 + sd / neb.genre.radius) , neb.genre.radius)
      for (const m of neb.puffMats) {
        m.uniforms.uTime.value = t
        m.uniforms.uOpacity.value = (m.userData.baseOpacity as number) * smokeMul
      }
      const pm = neb.particles.material as THREE.PointsMaterial
      pm.opacity = neb.particleBaseOpacity * smokeMul
      pm.size = neb.particleBaseSize * (0.45 + 0.55 * smokeMul)
      const pointTime = pm.userData.uTime as { value: number } | undefined
      if (pointTime) pointTime.value = t
    }

    const cam = this.camera.position
    // Per-genre visibility: stars only appear near/inside their nebula.
    this.genreVis.clear()
    for (const star of this.stars) {
      let v = this.genreVis.get(star.artist.genreId)
      if (v === undefined) {
        const neb = this.nebulaByGenre.get(star.artist.genreId)
        // surface distance: k = 1 at the cloud edge, fade out by 0.6R beyond it
        const k = neb ? 1 + neb.surfDist / star.genreRadius : cam.distanceTo(star.genreCenter) / star.genreRadius
        const x = Math.max(0, Math.min(1, (STAR_VIS_FAR - k) / (STAR_VIS_FAR - STAR_VIS_NEAR)))
        v = x * x * (3 - 2 * x)
        this.genreVis.set(star.artist.genreId, v)
      }
      if (this.selectedId && (star.artist.baseId === this.selectedId || star.artist.id === this.selectedId)) v = 1
      // Void / dormant field stars: also peek when the camera is near the star itself
      // (inter-nebula dark gaps), not only when inside the home nebula.
      if (star.artist.voidStar) {
        const starDist = cam.distanceTo(star.group.position)
        const nearStar = Math.max(0, Math.min(1, 1 - starDist / 52))
        const voidPeek = nearStar * nearStar * (0.55 + star.baseBrightness * 0.35)
        v = Math.max(v * 0.85, voidPeek)
        // Slightly wider nebula falloff so they read as fringe-into-dark
        v = Math.min(1, v * 1.05)
      }
      if (this.selectedId && (star.artist.baseId === this.selectedId || star.artist.id === this.selectedId)) v = 1
      star.vis = v
      star.group.visible = v > 0.005
    }
    for (const star of this.stars) {
      if (!star.group.visible) continue
      const vis = star.vis
      const selected =
        star.artist.baseId === this.selectedId || star.artist.id === this.selectedId
      const playing =
        star.artist.baseId === this.playingId || star.artist.id === this.playingId
      if (star.energyFlash > 0) star.energyFlash = Math.max(0, star.energyFlash - this.lastDt * 1.45)
      const ampPulse = (playing ? 1 + this.playingAmp * 0.55 : 1) * (1 + star.energyFlash * 0.28)
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
      const shellMat = star.shell.material as unknown as SoftGlowMaterial
      const glowMat = star.glow.material as unknown as SoftGlowMaterial
      const amp = playing ? 0.85 + this.playingAmp * 0.35 : 1
      // Outer shells/halos fade faster than core so mist + spark dominate close-up
      const shellFade = 1 - close * 0.92
      const haloFade = 1 - close * 0.97
      const bright = Math.min(1, star.baseBrightness + star.energyFlash * 0.45)
      shellMat.opacity = (selected ? 0.22 : 0.14) * pulse * amp * shellFade * (0.55 + bright * 0.45)
      glowMat.opacity = (selected ? 0.1 : 0.055) * pulse * amp * haloFade * (0.5 + bright * 0.5)
      // Slightly punchier emissive core when shrunk to a spark (still cinematic, not bloom-wash)
      const coreMat = star.core.material as unknown as SoftGlowMaterial
      // Void/dormant stay dim; popular new (high zapEnergy → brightness) glow more among protostars
      coreMat.emissiveIntensity = (0.55 + bright * 1.35) + close * 0.55 * bright
      coreMat.opacity = vis * (0.45 + bright * 0.55)
      if (star.memorialHalo) {
        // Gentle two-frequency shimmer; brighter and readable from far zoom.
        const shimmer = 0.85 + Math.sin(t * 1.3 + star.pulse) * 0.1 + Math.sin(t * 3.7 + star.pulse * 2) * 0.05
        coreMat.emissiveIntensity = (2.6 + close * 0.6) * shimmer
        shellMat.opacity = (selected ? 0.32 : 0.24) * shimmer * amp * (1 - close * 0.8)
        glowMat.opacity = (selected ? 0.16 : 0.11) * shimmer * amp * (1 - close * 0.85)
        const farBoost = 1 + Math.min(1, dist / 120) * 0.8
        star.memorialHalo.scale.setScalar(star.baseScale * 7 * farBoost * (0.96 + shimmer * 0.06))
        ;(star.memorialHalo.material as unknown as SoftGlowMaterial).opacity = 0.09 * shimmer * (1 - close * 0.9) * vis
      }
      shellMat.opacity *= vis
      glowMat.opacity *= vis
      if (star.stageFx) {
        const breathe = 0.94 + Math.sin(t * 0.9 + star.pulse) * 0.06
        star.stageFx.scale.setScalar(star.stageFxScale! * (selected ? 1.15 : 1) * breathe)
        star.stageFx.material.opacity =
          vis * (1 - close * 0.35) * (0.4 + bright * 0.6) * (playing ? 0.9 + this.playingAmp * 0.3 : 1)
        if (star.artist.stage === 'dead') coreMat.emissiveIntensity = 0.9 * bright
      }
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
    if (this.lite) return
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
      ;(star.shell.material as unknown as SoftGlowMaterial).opacity = q === 0 ? 0.08 : 0.14
      ;(star.glow.material as unknown as SoftGlowMaterial).opacity = q === 0 ? 0.03 : 0.055
    }
    this.applyMistQuality(q)
    this.syncResolution()
    // Hide outer smoke layers on low tiers for phone FPS.
    for (const neb of this.nebulaHandles) {
      for (const mesh of neb.puffMeshes) {
        const n = mesh.userData.puffCount as number
        const keep = q === 2 ? n : q === 1 ? Math.ceil(n * 0.7) : Math.ceil(n * 0.45)
        mesh.geometry.setDrawRange(0, keep * 6)
      }
      neb.particleBaseOpacity = q === 2 ? 0.3 : q === 1 ? 0.22 : 0.14
      neb.particleBaseSize = q === 2 ? 1.35 : q === 1 ? 1.05 : 0.75
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
    const masks = maskBank()
    GENRES.forEach((genre, gi) => {
      const group = new THREE.Group()
      group.position.set(...genre.center)
      group.userData.genreId = genre.id
      const R = genre.radius
      const center = group.position.clone()
      const subs = SUBGENRES.filter((s) => s.parentId === genre.id)
      const anchors = subs.map((s) => new THREE.Vector3(...s.center).sub(center))
      const skel = buildSkeleton(gi * 7919 + 31, R, anchors)
      const r = rng(gi * 131 + 7)
      const base = new THREE.Color(genre.color)

      // Puff layers: [maskKind, variant] → one merged mesh each.
      // `behind` is a large, faint veil so layers slip past each other like smoke.
      type Puff = {
        p: THREE.Vector3
        sx: number
        sy: number
        rot: number
        spin: number
        a: number
        c: THREE.Color
        drift: THREE.Vector3
        phase: number
      }
      const layers: {
        kind: 'wisp' | 'knot' | 'pillar' | 'dust'
        mask: HTMLCanvasElement
        puffs: Puff[]
        op: number
        behind?: boolean
      }[] = [
        { kind: 'wisp', mask: masks.wisp[gi % 4], puffs: [], op: 0.36 },
        { kind: 'wisp', mask: masks.wisp[(gi + 2) % 4], puffs: [], op: 0.32 },
        { kind: 'pillar', mask: masks.pillar[gi % 2], puffs: [], op: 0.34 },
        { kind: 'knot', mask: masks.knot[gi % 2], puffs: [], op: 0.4 },
        { kind: 'dust', mask: masks.dust[gi % 3], puffs: [], op: 0.55 },
        { kind: 'wisp', mask: masks.wisp[(gi + 1) % 4], puffs: [], op: 0.2, behind: true },
      ]
      const wind = new THREE.Vector3(r() - 0.5, (r() - 0.42) * 0.85, r() - 0.5)
      if (wind.lengthSq() < 1e-4) wind.set(0.2, 0.4, 0.1)
      wind.normalize().multiplyScalar(R * 0.36)
      const driftVec = (amp: number, yBias = 0.45) => {
        const v = new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2 + yBias, (r() - 0.5) * 2)
        if (v.lengthSq() < 1e-4) v.set(0, 1, 0)
        return v.normalize().multiplyScalar(amp)
      }
      const subColor = (p: THREE.Vector3): THREE.Color => {
        let best = base, bd = Infinity
        subs.forEach((s, i) => {
          const d = p.distanceTo(anchors[i])
          if (d < bd) { bd = d; best = new THREE.Color(s.color) }
        })
        return base.clone().lerp(best, 0.5)
      }
      const jitter = (k: number) => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(k)
      for (const sp of skel as SkelPoint[]) {
        const c = subColor(sp.p)
        const lum = 0.55 + r() * 0.75 // uneven bright/dim
        const phase = () => r() * Math.PI * 2
        if (sp.pillar) {
          layers[2].puffs.push({
            p: sp.p.clone().add(jitter(sp.r * 0.3)),
            sx: sp.r * 1.6,
            sy: sp.r * 3.4,
            rot: (r() - 0.5) * 0.5,
            spin: (r() - 0.5) * 0.02,
            a: lum,
            c,
            drift: driftVec(sp.r * 0.42, 0.9),
            phase: phase(),
          })
        } else {
          const L = layers[r() < 0.5 ? 0 : 1]
          const el = 1.1 + r() * 0.8
          L.puffs.push({
            p: sp.p.clone().add(jitter(sp.r * 0.5)),
            sx: sp.r * 3.0 * el,
            sy: sp.r * 3.0 / el,
            rot: r() * Math.PI * 2,
            spin: (r() - 0.5) * 0.045,
            a: lum,
            c,
            drift: driftVec(sp.r * 0.7, 0.5),
            phase: phase(),
          })
          layers[L === layers[0] ? 1 : 0].puffs.push({
            p: sp.p.clone().add(jitter(sp.r)),
            sx: sp.r * 2.4,
            sy: sp.r * 1.8,
            rot: r() * Math.PI * 2,
            spin: (r() - 0.5) * 0.035,
            a: lum * 0.8,
            c,
            drift: driftVec(sp.r * 0.55, 0.35),
            phase: phase(),
          })
        }
        if (r() < 0.22) {
          layers[3].puffs.push({
            p: sp.p.clone().add(jitter(sp.r * 0.8)),
            sx: sp.r * 0.8,
            sy: sp.r * 0.6,
            rot: r() * 6.28,
            spin: (r() - 0.5) * 0.03,
            a: 0.8 + r(),
            c: c.clone().lerp(new THREE.Color(0xffffff), 0.35),
            drift: driftVec(sp.r * 0.35, 0.2),
            phase: phase(),
          })
        }
        if (r() < 0.16 && sp.t > 0.15) {
          layers[4].puffs.push({
            p: sp.p.clone().add(jitter(sp.r * 0.6)),
            sx: sp.r * 2.4,
            sy: sp.r * 0.7,
            rot: r() * 6.28,
            spin: (r() - 0.5) * 0.04,
            a: 0.6 + r() * 0.4,
            c,
            drift: driftVec(sp.r * 0.6, 0.15),
            phase: phase(),
          })
        }
        // Outer veil: larger, fainter, slower — a second sheet of mist around the same skeleton.
        if (r() < 0.72) {
          layers[5].puffs.push({
            p: sp.p.clone().add(jitter(sp.r * 1.15)),
            sx: sp.r * (sp.pillar ? 3.1 : 6.4),
            sy: sp.r * (sp.pillar ? 6.8 : 5.3),
            rot: r() * Math.PI * 2,
            spin: (r() - 0.5) * 0.018,
            a: lum * 0.62,
            c,
            drift: driftVec(Math.max(3.5, sp.r * 0.95), 0.7),
            phase: phase(),
          })
        }
      }

      const puffMeshes: THREE.Mesh[] = []
      const puffMats: THREE.ShaderMaterial[] = []
      layers.forEach((L, li) => {
        if (!L.puffs.length) return
        // shuffle so quality-tier drawRange keeps an even subset
        for (let i = L.puffs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [L.puffs[i], L.puffs[j]] = [L.puffs[j], L.puffs[i]] }
        const n = L.puffs.length
        const cen = new Float32Array(n * 12), cor = new Float32Array(n * 8), siz = new Float32Array(n * 8)
        const rot = new Float32Array(n * 8), col = new Float32Array(n * 16), drift = new Float32Array(n * 16)
        const idx: number[] = []
        const corners = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]
        L.puffs.forEach((pf, i) => {
          for (let v = 0; v < 4; v++) {
            const k = i * 4 + v
            cen.set([pf.p.x, pf.p.y, pf.p.z], k * 3)
            cor.set([corners[v * 2], corners[v * 2 + 1]], k * 2)
            siz.set([pf.sx, pf.sy], k * 2)
            rot.set([pf.rot, pf.spin], k * 2)
            col.set([pf.c.r, pf.c.g, pf.c.b, pf.a], k * 4)
            drift.set([pf.drift.x, pf.drift.y, pf.drift.z, pf.phase], k * 4)
          }
          const o = i * 4
          idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
        })
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(cen, 3))
        geo.setAttribute('corner', new THREE.BufferAttribute(cor, 2))
        geo.setAttribute('psize', new THREE.BufferAttribute(siz, 2))
        geo.setAttribute('prot', new THREE.BufferAttribute(rot, 2))
        geo.setAttribute('pcol', new THREE.BufferAttribute(col, 4))
        geo.setAttribute('pdrift', new THREE.BufferAttribute(drift, 4))
        geo.setIndex(idx)
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 4)
        const dust = L.kind === 'dust'
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: dust ? dustTexture(L.mask) : puffTexture(L.mask, null, base, gi * 17 + li) },
            uOpacity: { value: L.op },
            uTime: { value: 0 },
            uWind: { value: wind },
            uLayer: { value: li * 1.35 },
          },
          vertexShader: NEBULA_PUFF_VERT,
          fragmentShader: dust ? NEBULA_DUST_FRAG : NEBULA_PUFF_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          // emissive puffs: additive (premultiplied rgb); dust lanes: darken what is behind
          blendSrc: dust ? THREE.ZeroFactor : THREE.OneFactor,
          blendDst: dust ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
        })
        mat.userData.baseOpacity = L.op
        const mesh = new THREE.Mesh(geo, mat)
        mesh.frustumCulled = false
        mesh.renderOrder = dust ? 2 : L.behind ? 0 : 1
        mesh.userData.puffCount = n
        mesh.userData.layer = L
        group.add(mesh)
        puffMeshes.push(mesh)
        puffMats.push(mat)
      })

      const particles = this.makeClusterParticles(genre, gi, skel)
      group.add(particles)
      this.scene.add(group)
      const handle: NebulaHandle = {
        genre,
        group,
        puffMeshes,
        puffMats,
        skel: skel.map((sp) => sp.p.clone().add(center)),
        skelR: skel.map((sp) => sp.r * 1.15),
        surfDist: Infinity,
        particles,
        particleBaseOpacity: 0.3,
        particleBaseSize: 1.35,
      }
      this.nebulaHandles.push(handle)
      this.nebulaByGenre.set(genre.id, handle)

      // Swap in real NASA photography (public domain) when loaded — cut by the same irregular masks.
      const photo = GENRE_NEBULA_PHOTO[genre.id]
      void loadNebulaImage(photo.src)
        .then((img) => {
          puffMeshes.forEach((mesh, li) => {
            const L = mesh.userData.layer as { kind: string; mask: HTMLCanvasElement }
            if (L.kind === 'dust') return
            const mat = mesh.material as THREE.ShaderMaterial
            const old = mat.uniforms.map.value as THREE.Texture
            mat.uniforms.map.value = puffTexture(L.mask, img, base, gi * 29 + li)
            old.dispose()
          })
        })
        .catch(() => {
          /* keep tinted fallback */
        })
    })
  }

  /** Subgenre smoke is now part of the parent's organic cloud (branches pass through each subgenre). */
  private spawnSubgenreNebulae(): void {}

  private makeClusterParticles(genre: Genre, seed: number, skel: SkelPoint[]): THREE.Points {
    // Dust sampled along the branches/pillars so it follows the cloud's shape.
    const count = 1400
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const drift = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const base = new THREE.Color(genre.color)
    const alt = base.clone().offsetHSL(0.04, -0.1, 0.15)
    for (let i = 0; i < count; i++) {
      const sp = skel[Math.floor(hash(i, seed + 30) * skel.length) % skel.length]
      const u = hash(i, seed + 31) * 2 - 1, v = hash(i, seed + 32) * 2 - 1, w = hash(i, seed + 33) * 2 - 1
      const k = sp.r * 0.9 * Math.pow(hash(i, seed + 36), 0.6)
      const len = Math.hypot(u, v, w) || 1
      pos[i * 3] = sp.p.x + (u / len) * k
      pos[i * 3 + 1] = sp.p.y + (v / len) * k * (sp.pillar ? 1.6 : 1)
      pos[i * 3 + 2] = sp.p.z + (w / len) * k
      const amp = sp.r * (0.28 + hash(i, seed + 37) * 0.55)
      drift[i * 3] = (hash(i, seed + 38) - 0.5) * 2 * amp
      drift[i * 3 + 1] = (hash(i, seed + 39) - 0.32) * amp
      drift[i * 3 + 2] = (hash(i, seed + 40) - 0.5) * 2 * amp
      phase[i] = hash(i, seed + 41) * Math.PI * 2
      const c = hash(i, seed + 34) > 0.55 ? alt : base
      const shade = 0.5 + hash(i, seed + 35) * 0.5
      col[i * 3] = c.r * shade
      col[i * 3 + 1] = c.g * shade
      col[i * 3 + 2] = c.b * shade
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    const mat = new THREE.PointsMaterial({
      map: this.mistParticleTex,
      size: 1.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      alphaTest: 0.02,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    bindNebulaPointDrift(mat)
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    return points
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

      const isMemorial = false // dead stars now render as nebula remnants (stage fx) instead of gold halos
      const stage = artist.stage
      const color = new THREE.Color(artist.color)
      if (stage === 'dead') color.set(0xdde8ff) // faint hot white dwarf
      if (stage === 'protostar') color.lerp(new THREE.Color(0xffd2a0), 0.7)
      const pickScale = artist.size * 1.55
      const bright = artist.brightness
      const coreScale =
        pickScale *
        (stage === 'dead' ? 0.22 : stage === 'protostar' ? 0.4 + bright * 0.2 : artist.voidStar ? 0.55 + bright * 0.35 : 1)
      const core = new THREE.Mesh(
        this.sharedCoreGeo,
        // Soft hot core: bright centre, fully transparent rim (no hard edge at any distance).
        new SoftGlowMaterial(
          color.clone().lerp(new THREE.Color(0xffffff), 0.15 + bright * 0.2),
          Math.max(0.25, bright),
          0.9,
          0.7 + bright * 1.1,
        ),
      )
      core.scale.setScalar(coreScale)
      core.userData.artistId = artist.id

      // Soft volumetric mid shell — additive sphere, always round.
      const shell = new THREE.Mesh(
        this.sharedShellGeo,
        new SoftGlowMaterial(color, 0.06 + bright * 0.1, 0.7),
      )
      shell.scale.setScalar(coreScale * 1.75)
      shell.userData.artistId = artist.id

      // Outer halo shell — soft bloom rim without Sprite squares.
      const glow = new THREE.Mesh(
        this.sharedHaloGeo,
        new SoftGlowMaterial(color.clone().lerp(new THREE.Color(0xffffff), 0.25 + bright * 0.2), 0.025 + bright * 0.045, 0.5),
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
      pickProxy.scale.setScalar(pickScale * STAR_PICK_RADIUS_MUL)
      pickProxy.userData.artistId = artist.id

      let memorialHalo: THREE.Mesh | undefined
      if (isMemorial) {
        memorialHalo = new THREE.Mesh(
          this.sharedHaloGeo,
          new SoftGlowMaterial(new THREE.Color(MEMORIAL_GOLD), 0.09, 0.35, 1.4),
        )
        memorialHalo.scale.setScalar(coreScale * 7)
        memorialHalo.userData.artistId = artist.id
        group.add(memorialHalo)
      }

      let stageFx: THREE.Sprite | undefined
      let stageFxScale = 0
      if (stage !== 'star') {
        const kind = stage === 'protostar' ? 'protostar' : artist.remnant === 'supernova' ? 'remnant' : 'nebula'
        stageFx = new THREE.Sprite(new THREE.SpriteMaterial({
          map: stageTexture(kind), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          rotation: hash(artist.name.length, 9.1) * Math.PI * 2,
        }))
        stageFxScale = pickScale * (kind === 'remnant' ? 4.2 : kind === 'nebula' ? 3.6 : 3.2)
        stageFx.scale.setScalar(stageFxScale)
        stageFx.userData.artistId = artist.id
        shell.visible = false
        glow.visible = stage === 'protostar'
        group.add(stageFx)
      }

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
        memorialHalo,
        stageFx,
        stageFxScale,
        vis: 0,
        genreCenter: new THREE.Vector3(...GENRE_BY_ID[artist.genreId].center),
        genreRadius: GENRE_BY_ID[artist.genreId].radius * (artist.voidStar ? 1.35 : 1),
        baseBrightness: bright,
        energyFlash: 0,
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
        if (d < MIST_FAR && sel.vis > 0.05) {
          target = sel
          bestDist = d
        }
      }
    }
    if (!target) {
      let bestD2 = Infinity
      for (const star of this.stars) {
        if (star.vis < 0.05) continue
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
      desired *= target.vis
    }
    this.mistIntensity += (desired - this.mistIntensity) * Math.min(1, dt * 4.5)

    if (this.mistIntensity < 0.02 || !target) {
      this.mist.visible = false
      this.mistMat.opacity = 0
      this.mistStarId = null
      return
    }

    const origin = target.group.position
    const starColor = (target.core.material as unknown as SoftGlowMaterial).emissive
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
