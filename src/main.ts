import { playScreenZap } from './screenZap'
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
    if (panel?.classList.contains('open') && panel.contains(t)) return
    if (search?.contains(t)) return
    if (phil && !phil.classList.contains('hidden') && phil.contains(t)) return
    if (hist && !hist.classList.contains('hidden') && hist.contains(t)) return
    if (profile && !profile.classList.contains('hidden') && profile.contains(t)) return
    if (wallet?.classList.contains('open') && wallet.contains(t)) return
    if (nav?.contains(t)) return
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

ui.onMute = (muted) => audio.setMuted(muted)
ui.onClosePanel = () => {
  galaxy.setSelected(null)
}
const realAudio = new Audio()
realAudio.preload = 'none'
ui.onSelectTrack = (artist, index) => {
  void audio.start()
  const t = artist.tracks[index]
  if (t?.audioUrl) {
    audio.stopAll()
    realAudio.src = t.audioUrl
    void realAudio.play().catch(() => {})
    return
  }
  realAudio.pause()
  audio.playTrackCue(artist, index)
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
  ndc.set((result.x / window.innerWidth) * 2 - 1, -(result.y / window.innerHeight) * 2 + 1)
  let artist = galaxy.pick(ndc)

  if (result.kind === 'doubletap') {
    if (pendingTap) {
      clearTimeout(pendingTap)
      pendingTap = null
    }
    ui.hidePanel()
    galaxy.setSelected(null)
    if (!artist) {
      const near = galaxy.nearest(galaxy.camera.position)
      artist = near?.artist ?? null
    }
    if (artist) {
      zoomTarget.set(...artist.position)
      fly.zoomToward(zoomTarget)
    }
    return
  }

  if (pendingTap) clearTimeout(pendingTap)
  const picked = artist
  pendingTap = setTimeout(() => {
    pendingTap = null
    if (picked) openArtist(picked)
  }, 340)
}

canvas.addEventListener('click', (e) => {
  if (!running) return
  if (fly.isTouch) return
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
  if (fly.pointerLocked) ndc.set(0, 0)
  else ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  return galaxy.pick(ndc)
}

function openArtist(artist: NonNullable<ReturnType<GalaxyScene['pick']>>): void {
  const profile = getArtistProfile(artist.id)
  galaxy.setSelected(profile.baseId)
  ui.openPanel(profile)
  if (fly.pointerLocked) {
    fly.unlock()
    suppressClick = true
  }
}

function frame(): void {
  requestAnimationFrame(frame)
  const dt = galaxy.dt
  fly.update(dt)
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

  galaxy.render(performance.now() * 0.001)
}

frame()

// Opt-in test hook (?debug) for headless visual checks; inert otherwise.
if (new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__cosmoly = { galaxy, fly }
}

// Debug hook for automated screenshots: add ?debug to the URL.
if (location.search.includes('debug')) Object.assign(window, { __galaxy: galaxy, __fly: fly })
