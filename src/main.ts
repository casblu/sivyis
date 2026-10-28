import { playScreenZap, ZAP_HOLD_MS, ZAP_FADE_MS } from './screenZap'
import { ARTISTS } from "./artists.ts"
import './style.css'
import * as THREE from 'three'
import {
  GENRES,
  GENRE_LABEL_RADIUS,
  HEARING_RADIUS,
  getArtistProfile,
} from './artists.ts'
import { ProximityAudio } from './audio.ts'
import { FlyControls } from './controls.ts'
import { GalaxyScene } from './scene.ts'
import { UI } from './ui.ts'
import { MusicPlayer } from './player.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

document.documentElement.style.touchAction = 'none'
document.body.style.touchAction = 'none'
document.body.style.overscrollBehavior = 'none'
window.addEventListener(
  'touchmove',
  (e) => {
    const t = e.target as Node
    const panel = app.querySelector('#panel')
    const search = app.querySelector('#search-box')
    const phil = app.querySelector('#philosophy-view')
    const hist = app.querySelector('#history-view')
    const profile = app.querySelector('#profile-view')
    const wallet = app.querySelector('#wallet-drawer')
    const nav = app.querySelector('#bottom-nav')
    const playerBar = app.querySelector('#player-bar')
    const playerLyrics = app.querySelector('#player-lyrics')
    if (panel?.classList.contains('open') && panel.contains(t)) return
    if (search?.contains(t)) return
    if (phil && !phil.classList.contains('hidden') && phil.contains(t)) return
    if (hist && !hist.classList.contains('hidden') && hist.contains(t)) return
    if (profile && !profile.classList.contains('hidden') && profile.contains(t)) return
    if (wallet?.classList.contains('open') && wallet.contains(t)) return
    if (nav?.contains(t)) return
    if (playerBar && !playerBar.classList.contains('hidden') && playerBar.contains(t)) return
    if (playerLyrics && !playerLyrics.classList.contains('hidden') && playerLyrics.contains(t)) return
    e.preventDefault()
  },
  { passive: false },
)

const ui = new UI(app)
const canvas = app.querySelector<HTMLCanvasElement>('#view')
if (!canvas) throw new Error('#view missing')
canvas.tabIndex = 0

const galaxy = new GalaxyScene(canvas)
const fly = new FlyControls(galaxy.camera, canvas)
const audio = new ProximityAudio()

const ndc = new THREE.Vector2()
const projected = new THREE.Vector3()
const labelPos = new THREE.Vector3()
const genrePos = new THREE.Vector3()
const zoomTarget = new THREE.Vector3()
const tmpArtistPos = new THREE.Vector3()
let running = false
let suppressClick = false

ui.onEnter = async () => {
  await audio.start()
  running = true
  fly.enabled = true
  // Skip locked overview — open already navigable.
  fly.enterFly({ lock: !fly.isTouch })
  ui.setNavMode('fly')
  ui.entered(fly.isTouch)
  canvas.focus()
}

ui.onMute = (muted) => {
  audio.setMuted(muted)
  player.audio.muted = muted
}
ui.onClosePanel = () => {
  galaxy.setSelected(null)
  galaxy.setViewShift(0, 0)
}
const playerHost = app.querySelector<HTMLElement>('#player-host') ?? app
const player = new MusicPlayer(playerHost, {
  onPlayCue: (artist, index) => {
    void audio.start()
    audio.playTrackCue(artist, index)
  },
  onRealAudioStart: () => {
    void audio.start()
    audio.stopAll()
  },
  onRealAudioEnd: () => {
    /* proximity ambience resumes via frame loop */
  },
})
ui.onSelectTrack = (artist, index) => {
  void audio.start()
  player.playTrack(artist, index)
}

ui.onToggleMode = () => {
  if (!running) return
  // Overview removed — always stay in navigable fly.
  if (fly.navMode !== 'fly') {
    fly.enterFly({ lock: !fly.isTouch })
    ui.setNavMode('fly')
  }
}

ui.onLookAt = (artist) => {
  if (!running) return
  tmpArtistPos.set(...artist.position)
  fly.lookAtArtist(tmpArtistPos)
  galaxy.setSelected(artist.id)
  ui.fadeGestureHint()
}

ui.onSendBtc = (artist) => {
  // Full-screen profile hides the star; on zap the profile turns translucent so the star shines through.
  const panel = document.getElementById('panel')
  galaxy.setViewShift(0, 0)
  tmpArtistPos.set(...artist.position)
  fly.lookAtArtist(tmpArtistPos.clone())
  panel?.classList.add('zapping')
  // Profile fades back in (CSS opacity, ease-out cubic) at the same time the lightning fades out.
  window.setTimeout(() => { panel?.classList.add('settling'); panel?.classList.remove('zapping') }, ZAP_HOLD_MS)
  window.setTimeout(() => { panel?.classList.remove('settling') }, ZAP_HOLD_MS + ZAP_FADE_MS + 100)
  galaxy.zapArtist(artist.id)
  playScreenZap({ color: artist.color, name: artist.name })
}
;(window as unknown as { __sivyis?: unknown }).__sivyis = { galaxy, fly, zap: (id: string) => galaxy.zapArtist(id), open: (id: string) => { const a = ARTISTS.find((x) => x.id === id); if (a) openArtist(a) } }

ui.onFlyTo = (artist) => {
  if (!running) return
  tmpArtistPos.set(...artist.position)
  fly.flyToArtist(tmpArtistPos, () => {
    openArtist(artist)
  })
  galaxy.setSelected(artist.id)
  ui.fadeGestureHint()
}

ui.onTabChange = (tab) => {
  if (tab !== 'galaxy') {
    if (fly.pointerLocked) fly.unlock()
    ui.showRecapture(false)
  }
}

fly.onModeChange = (mode) => {
  ui.setNavMode(mode)
  if (mode === 'overview') {
    ui.hidePanel()
    galaxy.setSelected(null)
  }
}

fly.onGesture = () => ui.fadeGestureHint()

let pendingTap: ReturnType<typeof setTimeout> | null = null

fly.onTap = (result) => {
  if (!running) return
  // Mouse clicks are handled by the canvas 'click' listener.
  if (!fly.isTouch && result.pointerType === 'mouse') return
  const artist = pickAt(result.x, result.y, true)

  if (result.kind === 'doubletap') {
    if (pendingTap) {
      clearTimeout(pendingTap)
      pendingTap = null
    }
    if (artist) {
      // Double-tap on a star: keep the profile, just zoom in.
      zoomTarget.set(...artist.position)
      fly.zoomToward(zoomTarget)
      return
    }
    ui.hidePanel()
    galaxy.setSelected(null)
    const near = galaxy.nearest(galaxy.camera.position)
    if (near) {
      zoomTarget.set(...near.artist.position)
      fly.zoomToward(zoomTarget)
    }
    return
  }

  // Single tap on a star opens its profile immediately.
  if (artist) openArtist(artist)
}

function pickAt(x: number, y: number, touch: boolean) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
  return galaxy.pick(ndc) ?? galaxy.pickScreen(x, y, touch ? 46 : 26)
}

let downXY: [number, number, number] = [0, 0, 0]
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY, performance.now()] })
canvas.addEventListener('click', (e) => {
  if (!running) return
  if (fly.isTouch) return
  // Ignore the click that ends a drag (orbit/look) — only real clicks open a star.
  if (!fly.pointerLocked && Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 8) return
  if (suppressClick) {
    suppressClick = false
    return
  }
  const artist = artistFromEvent(e)
  if (artist) {
    openArtist(artist)
    return
  }
  if (fly.navMode === 'fly' && !fly.pointerLocked) fly.lock()
})

document.addEventListener('pointerlockchange', () => {
  if (!running || fly.isTouch) return
  ui.showRecapture(fly.navMode === 'fly' && !fly.pointerLocked)
})

window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key === 'Escape') {
    galaxy.setSelected(null)
    ui.hidePanel()
    ui.closeWallet()
  }
  if (e.key === 'm' || e.key === 'M') {
    const next = !audio.muted
    audio.setMuted(next)
    ui.muted = next
    const btn = app.querySelector('#mute')
    if (btn) {
      btn.textContent = next ? 'Sound off' : 'Sound on'
      btn.setAttribute('aria-pressed', String(!next))
    }
  }
  if ((e.key === 'o' || e.key === 'O') && running) {
    if (fly.navMode === 'fly') fly.returnToOverview()
    else fly.enterFly({ lock: !fly.isTouch })
  }
})

function artistFromEvent(e: MouseEvent) {
  if (fly.pointerLocked) return pickAt(window.innerWidth / 2, window.innerHeight / 2, false)
  return pickAt(e.clientX, e.clientY, false)
}

function openArtist(artist: NonNullable<ReturnType<GalaxyScene['pick']>>): void {
  const profile = getArtistProfile(artist.id)
  galaxy.setSelected(profile.baseId)
  ui.openPanel(profile)
  frameSelected(artist)
  if (fly.pointerLocked) {
    fly.unlock()
    suppressClick = true
  }
}

function frame(): void {
  requestAnimationFrame(frame)
  const dt = galaxy.dt
  fly.update(dt)
  if (!document.getElementById('panel')?.classList.contains('open')) galaxy.setViewShift(0, 0)
  galaxy.tickQuality(dt)

  const origin = galaxy.camera.position
  const near = galaxy.nearby(origin, HEARING_RADIUS)
  audio.update(near, galaxy.camera, fly.boost)
  galaxy.setPlaying(audio.playingId, audio.amplitude)

  const closest = galaxy.nearest(origin)
  if (closest) ui.setNearest(closest.artist, closest.distance)
  else ui.setNearest(null, null)

  const nearGenre = galaxy.nearestGenre(origin)
  if (nearGenre) {
    const depth = 1 - Math.min(1, nearGenre.distance / (nearGenre.genre.radius * 1.4))
    audio.setGenreAmbient(nearGenre.genre, depth)
  } else {
    audio.setGenreAmbient(null, 0)
  }

  // Sticky now-playing / nearest label
  const stickyArtist =
    (audio.playingId ? galaxy.getArtist(audio.playingId) : null) ?? closest?.artist ?? null
  if (stickyArtist && (fly.navMode === 'fly' || (closest && closest.distance < 28))) {
    labelPos.set(...stickyArtist.position)
    galaxy.worldToScreen(labelPos, projected)
    const behind = projected.z > 1 || projected.z < -1
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight
    const onscreen =
      !behind && projected.x > -1.05 && projected.x < 1.05 && projected.y > -1.05 && projected.y < 1.05
    ui.setNowPlaying(stickyArtist, x, y - 28, onscreen, behind)
  } else {
    ui.setNowPlaying(null, 0, 0, false, false)
  }

  if (closest && closest.distance < 14 && fly.navMode === 'fly') {
    labelPos.set(...closest.artist.position)
    galaxy.worldToScreen(labelPos, projected)
    const onscreen = projected.z > -1 && projected.z < 1
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight - 28
    ui.setFloatLabel(closest.artist, x, y, onscreen)
  } else {
    ui.setFloatLabel(null, 0, 0, false)
  }

  // Genre labels: overview shows all; fly shows nearest nebula label
  if (fly.navMode === 'overview') {
    ui.setGenreLabel(null, 0, 0, false)
    for (const g of GENRES) {
      genrePos.set(...g.center)
      galaxy.worldToScreen(genrePos, projected)
      const onscreen = projected.z > -1 && projected.z < 1
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight
      ui.updateOverviewGenreLabel(g.id, x, y, onscreen)
    }
  } else {
    for (const g of GENRES) ui.updateOverviewGenreLabel(g.id, 0, 0, false)
    if (nearGenre && nearGenre.distance < GENRE_LABEL_RADIUS) {
      genrePos.set(...nearGenre.genre.center)
      galaxy.worldToScreen(genrePos, projected)
      const onscreen = projected.z > -1 && projected.z < 1
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight - 48
      const hideForArtist = closest !== null && closest.distance < 10
      ui.setGenreLabel(nearGenre.genre, x, y, onscreen && !hideForArtist)
    } else {
      ui.setGenreLabel(null, 0, 0, false)
    }
  }

  // Full-screen opaque profile covers the galaxy: skip WebGL work unless a zap is showing it.
  galaxy.render(performance.now() * 0.001)
}

frame()

// Opt-in test hook (?debug) for headless visual checks; inert otherwise.
if (new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__cosmoly = { galaxy, fly }
}

// Debug hook for automated screenshots: add ?debug to the URL.
if (location.search.includes('debug')) Object.assign(window, { __galaxy: galaxy, __fly: fly })

/** Keep the selected star visible in the part of the screen not covered by the profile panel. */
function panelShift(): [number, number] {
  const panel = document.getElementById('panel')
  if (!panel || !panel.classList.contains('open')) return [0, 0]
  const r = panel.getBoundingClientRect()
  const w = window.innerWidth
  const h = window.innerHeight
  void r; void w; void h
  return [0, 0] // full-screen profile
  if (r.width < w * 0.9) return [Math.round(Math.min(r.width, w - r.left) / 2), 0] // side panel: centre in left area
  const covered = Math.max(0, h - Math.max(0, r.top))
  return [0, Math.round(covered / 2)] // bottom sheet: centre in top area
}

function frameSelected(artist: { position: [number, number, number] }): void {
  // Panel transitions in; measure on next frame using final geometry.
  requestAnimationFrame(() => {
    const panel = document.getElementById('panel')
    const w = window.innerWidth
    let sx = 0
    let sy = 0
    if (panel) {
      const cs = getComputedStyle(panel)
      const pw = panel.offsetWidth
      const ph = panel.offsetHeight
      void cs; void pw; void ph; void w // profile is full-screen now: star sits centred behind it
    }
    galaxy.setViewShift(sx, sy)
    tmpArtistPos.set(...artist.position)
    const d = galaxy.camera.position.distanceTo(tmpArtistPos)
    if (d > 22 || d < 3) fly.flyToArtist(tmpArtistPos.clone())
    else fly.lookAtArtist(tmpArtistPos.clone())
  })
}
void panelShift
window.addEventListener('resize', () => {
  if (document.getElementById('panel')?.classList.contains('open')) {
    const [x, y] = panelShift()
    galaxy.setViewShift(x, y)
  }
})
