import type { Artist, Track } from './artists.ts'
import artistPhotos from './artistPhotos.json'
import { mountEnergyZap } from './zapForm.ts'
import { energyIcon, formatEnergyText, wallet, MAX_PLAY_SATS, type SendResult } from './wallet.ts'

type Photo = { file: string; artist: string; license: string; source: string }
const PHOTOS = artistPhotos as Record<string, Photo[]>
const BASE = import.meta.env.BASE_URL

export type LoopMode = 'off' | 'all' | 'one'

export type PlayerHandlers = {
  /** Procedural demo cue when the track has no audioUrl */
  onPlayCue: (artist: Artist, index: number) => void
  /** Duck / stop proximity voices while real media plays */
  onRealAudioStart: () => void
  /** Allow proximity ambience again when real media stops */
  onRealAudioEnd: () => void
  /** A track playback started (not a mid-track resume). */
  onPlayStart?: (artist: Artist, index: number) => void
  /** Confirmed zap from the player. Demo wallet only. */
  onZap?: (artist: Artist, sats: number) => SendResult
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function parseDuration(label: string): number {
  const parts = label.trim().split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function coverFor(artist: Artist): { url: string | null; initials: string } {
  const base = artist.baseId || (artist.id.includes('__') ? artist.id.slice(0, artist.id.indexOf('__')) : artist.id)
  const initials = artist.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  if (artist.open?.image) return { url: artist.open.image, initials }
  const photos = PHOTOS[base]
  if (photos?.[0]) return { url: BASE + 'artists/' + photos[0].file, initials }
  return { url: null, initials }
}

/** Optional lyrics field — catalog currently has none; empty state only. */
function lyricsFor(track: Track): string | null {
  const any = track as Track & { lyrics?: string }
  const text = any.lyrics?.trim()
  return text ? text : null
}

/**
 * Cosmoly bottom player — Spotify-style controls in dark galaxy glass.
 * Owns the HTMLAudioElement for real V4V/Nostr streams; demo tracks use cues.
 */
export class MusicPlayer {
  readonly el: HTMLElement
  readonly audio: HTMLAudioElement
  private handlers: PlayerHandlers
  private artist: Artist | null = null
  private index = 0
  private order: number[] = []
  private shuffle = false
  private loop: LoopMode = 'off'
  private playing = false
  private cueMode = false
  private scrubbing = false
  private raf = 0

  private artEl: HTMLElement
  private titleEl: HTMLElement
  private artistEl: HTMLElement
  private playBtn: HTMLButtonElement
  private shuffleBtn: HTMLButtonElement
  private loopBtn: HTMLButtonElement
  private seek: HTMLInputElement
  private curEl: HTMLElement
  private durEl: HTMLElement
  private lyricsSheet: HTMLElement
  private lyricsBody: HTMLElement
  private lyricsBtn: HTMLButtonElement
  private energyBtn: HTMLButtonElement
  private energyPop: HTMLElement
  private energyNote: HTMLElement
  private zapSheet: HTMLElement
  private playBilled = false
  private playGen = 0
  private unsubWallet: (() => void) | null = null

  constructor(host: HTMLElement, handlers: PlayerHandlers) {
    this.handlers = handlers
    this.audio = new Audio()
    this.audio.preload = 'metadata'

    host.insertAdjacentHTML(
      'beforeend',
      `
      <div id="player-bar" class="hidden" aria-label="Now playing" role="region">
        <button type="button" class="player-art" id="player-art" aria-label="Open lyrics">
          <span class="player-art-fallback" id="player-art-fallback">✦</span>
          <img id="player-art-img" alt="" hidden />
        </button>
        <div class="player-meta">
          <strong id="player-title">—</strong>
          <em id="player-artist">—</em>
          <button type="button" id="player-energy" class="energy-chip" aria-expanded="false" aria-controls="player-energy-pop">
            <span id="player-energy-label"></span>
          </button>
          <span id="player-energy-note" class="energy-note" role="status"></span>
        </div>
        <div class="player-controls">
          <button type="button" id="player-shuffle" aria-pressed="false" title="Shuffle" aria-label="Shuffle">⇄</button>
          <button type="button" id="player-prev" aria-label="Previous">⏮</button>
          <button type="button" id="player-play" class="player-play" aria-label="Play">▶</button>
          <button type="button" id="player-next" aria-label="Next">⏭</button>
          <button type="button" id="player-loop" aria-pressed="false" data-mode="off" title="Repeat" aria-label="Repeat">🔁</button>
        </div>
        <div class="player-seek">
          <span id="player-cur">0:00</span>
          <input id="player-range" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" />
          <span id="player-dur">0:00</span>
        </div>
        <div class="player-extra">
          <button type="button" id="player-zap" class="player-zap">Zap</button>
          <button type="button" id="player-lyrics-btn" aria-expanded="false" aria-controls="player-lyrics">Lyrics</button>
          <button type="button" id="player-close" aria-label="Close player">×</button>
        </div>
        <div id="player-energy-pop" class="energy-pop hidden" aria-hidden="true">
          <p class="kicker">Energy per play</p>
          <label class="energy-toggle"><input id="player-energy-on" type="checkbox" /> Send Energy on each play</label>
          <label class="zap-custom-label" for="player-energy-amt">Amount</label>
          <div class="energy-amt-row">
            <input id="player-energy-amt" type="number" inputmode="numeric" min="1" max="${MAX_PLAY_SATS}" step="1" value="1" aria-label="Sats of Energy per play" />
            <span>sats of Energy</span>
          </div>
          <p class="demo-note">Default is 1 sat of Energy. This demo wallet never moves real funds. Turn it off anytime.</p>
        </div>
      </div>
      <aside id="player-zap-sheet" class="hidden" aria-hidden="true" aria-label="Zap Energy">
        <div class="player-lyrics-head">
          <p class="kicker">Zap Energy</p>
          <button type="button" id="player-zap-close" aria-label="Close zap">×</button>
        </div>
        <div id="player-zap-body"></div>
      </aside>
      <aside id="player-lyrics" class="hidden" aria-hidden="true" aria-label="Lyrics">
        <div class="player-lyrics-head">
          <p class="kicker">Lyrics</p>
          <button type="button" id="player-lyrics-close" aria-label="Close lyrics">×</button>
        </div>
        <div id="player-lyrics-body" class="player-lyrics-body"></div>
      </aside>
    `,
    )

    this.el = must(host, '#player-bar')
    this.artEl = must(host, '#player-art')
    this.titleEl = must(host, '#player-title')
    this.artistEl = must(host, '#player-artist')
    this.playBtn = must(host, '#player-play') as HTMLButtonElement
    this.shuffleBtn = must(host, '#player-shuffle') as HTMLButtonElement
    this.loopBtn = must(host, '#player-loop') as HTMLButtonElement
    this.seek = must(host, '#player-range') as HTMLInputElement
    this.curEl = must(host, '#player-cur')
    this.durEl = must(host, '#player-dur')
    this.lyricsSheet = must(host, '#player-lyrics')
    this.lyricsBody = must(host, '#player-lyrics-body')
    this.lyricsBtn = must(host, '#player-lyrics-btn') as HTMLButtonElement
    this.energyBtn = must(host, '#player-energy') as HTMLButtonElement
    this.energyPop = must(host, '#player-energy-pop')
    this.energyNote = must(host, '#player-energy-note')
    this.zapSheet = must(host, '#player-zap-sheet')

    this.bind()
    this.paintEnergyChip()
    this.syncEnergyInputs()
    this.unsubWallet = wallet.subscribe(() => {
      this.paintEnergyChip()
      this.syncEnergyInputs()
    })
  }

  dispose(): void {
    this.unsubWallet?.()
    this.unsubWallet = null
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden')
  }

  get currentArtist(): Artist | null {
    return this.artist
  }

  get currentIndex(): number {
    return this.index
  }

  /** Start or switch to a track from an artist profile / selection. */
  playTrack(artist: Artist, index: number): void {
    this.artist = artist
    this.index = Math.max(0, Math.min(index, artist.tracks.length - 1))
    this.rebuildOrder(this.index)
    this.show()
    this.loadCurrent(true)
  }

  hide(): void {
    this.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.el.classList.add('hidden')
    this.closeLyrics()
    this.closeZap()
    this.energyPop.classList.add('hidden')
    this.energyBtn.setAttribute('aria-expanded', 'false')
    document.documentElement.classList.remove('player-open')
    this.handlers.onRealAudioEnd()
  }

  private show(): void {
    this.el.classList.remove('hidden')
    document.documentElement.classList.add('player-open')
  }

  private bind(): void {
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.lyricsSheet.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.zapSheet.addEventListener('pointerdown', (e) => e.stopPropagation())

    this.playBtn.addEventListener('click', () => this.togglePlay())
    must(this.el, '#player-prev').addEventListener('click', () => this.prev())
    must(this.el, '#player-next').addEventListener('click', () => this.next())
    this.shuffleBtn.addEventListener('click', () => this.toggleShuffle())
    this.loopBtn.addEventListener('click', () => this.cycleLoop())
    must(this.el, '#player-close').addEventListener('click', () => this.hide())
    must(this.el, '#player-zap').addEventListener('click', () => this.openZap())
    must(document, '#player-zap-close').addEventListener('click', () => this.closeZap())
    this.energyBtn.addEventListener('click', () => this.toggleEnergyPop())
    this.bindEnergySettings()
    this.lyricsBtn.addEventListener('click', () => this.toggleLyrics())
    this.artEl.addEventListener('click', () => this.toggleLyrics())
    must(document, '#player-lyrics-close').addEventListener('click', () => this.closeLyrics())

    this.seek.addEventListener('pointerdown', () => {
      this.scrubbing = true
    })
    this.seek.addEventListener('pointerup', () => {
      this.commitSeek()
      this.scrubbing = false
    })
    this.seek.addEventListener('change', () => this.commitSeek())
    this.seek.addEventListener('input', () => {
      if (!this.scrubbing) return
      const dur = this.effectiveDuration()
      const t = (Number(this.seek.value) / 1000) * dur
      this.curEl.textContent = fmtTime(t)
    })

    this.audio.addEventListener('timeupdate', () => this.paintProgress())
    this.audio.addEventListener('loadedmetadata', () => this.paintProgress())
    this.audio.addEventListener('ended', () => this.onEnded())
    this.audio.addEventListener('play', () => this.setPlaying(true))
    this.audio.addEventListener('pause', () => {
      if (!this.cueMode) this.setPlaying(false)
    })
    this.audio.addEventListener('error', () => {
      // Bad stream URL — fall back to demo cue so the player still responds.
      if (this.artist) {
        this.cueMode = true
        this.handlers.onPlayCue(this.artist, this.index)
        this.setPlaying(true)
        this.markPlayStarted()
      }
    })
  }

  private bindEnergySettings(): void {
    const on = must(this.energyPop, '#player-energy-on') as HTMLInputElement
    const amt = must(this.energyPop, '#player-energy-amt') as HTMLInputElement
    on.addEventListener('change', () => {
      wallet.setPlaySettings({ enabled: on.checked })
    })
    amt.addEventListener('change', () => {
      const n = Math.round(Number(amt.value))
      if (!Number.isFinite(n) || n < 1) {
        amt.value = String(wallet.playSettings.satsPerPlay)
        return
      }
      wallet.setPlaySettings({ satsPerPlay: Math.min(MAX_PLAY_SATS, n) })
      amt.value = String(wallet.playSettings.satsPerPlay)
    })
  }

  private syncEnergyInputs(): void {
    const on = this.energyPop.querySelector<HTMLInputElement>('#player-energy-on')
    const amt = this.energyPop.querySelector<HTMLInputElement>('#player-energy-amt')
    if (!on || !amt) return
    const s = wallet.playSettings
    on.checked = s.enabled
    if (document.activeElement !== amt) amt.value = String(s.satsPerPlay)
  }

  private paintEnergyChip(): void {
    const s = wallet.playSettings
    const label = s.enabled ? `${formatEnergyText(s.satsPerPlay)} / play` : 'Energy off'
    const slot = must(this.energyBtn, '#player-energy-label')
    slot.innerHTML = `${energyIcon()}<span>${label}</span>`
    this.energyBtn.setAttribute('aria-label', s.enabled ? `Each play sends ${formatEnergyText(s.satsPerPlay)}. Change amount.` : 'Energy per play is off. Change setting.')
  }

  notifyEnergy(message: string, ok: boolean): void {
    this.energyNote.textContent = message
    this.energyNote.classList.toggle('ok', ok)
    this.energyNote.classList.toggle('err', !ok)
    this.energyBtn.classList.toggle('sent', ok)
    window.setTimeout(() => {
      if (this.energyNote.textContent === message) this.energyNote.textContent = ''
      this.energyBtn.classList.remove('sent')
    }, 1700)
  }

  private toggleEnergyPop(): void {
    const shown = this.energyPop.classList.contains('hidden')
    this.energyPop.classList.toggle('hidden', !shown)
    this.energyPop.setAttribute('aria-hidden', String(!shown))
    this.energyBtn.setAttribute('aria-expanded', String(shown))
    if (shown) this.syncEnergyInputs()
  }

  private openZap(): void {
    if (!this.artist) return
    this.closeLyrics()
    this.energyPop.classList.add('hidden')
    this.energyBtn.setAttribute('aria-expanded', 'false')
    const artist = this.artist
    this.zapSheet.classList.remove('hidden')
    this.zapSheet.setAttribute('aria-hidden', 'false')
    mountEnergyZap(must(this.zapSheet, '#player-zap-body'), {
      artistName: artist.name,
      onConfirm: (sats) => this.handlers.onZap?.(artist, sats) ?? { ok: false, error: 'Zap unavailable' },
    })
  }

  private closeZap(): void {
    this.zapSheet.classList.add('hidden')
    this.zapSheet.setAttribute('aria-hidden', 'true')
  }

  private markPlayStarted(): void {
    if (this.playBilled || !this.artist) return
    this.playBilled = true
    this.handlers.onPlayStart?.(this.artist, this.index)
  }

  private armCueEnd(): void {
    const gen = this.playGen
    window.setTimeout(() => {
      if (this.playGen !== gen) return
      if (this.cueMode && this.playing) {
        this.setPlaying(false)
        this.playBilled = false
      }
    }, 2800)
  }

  private track(): Track | null {
    if (!this.artist) return null
    return this.artist.tracks[this.index] ?? null
  }

  private loadCurrent(autoplay: boolean): void {
    const artist = this.artist
    const track = this.track()
    if (!artist || !track) return

    this.playGen += 1
    this.playBilled = false
    this.titleEl.textContent = track.title
    this.artistEl.textContent = artist.name
    this.renderArt(artist)
    this.renderLyrics(track)

    const listed = parseDuration(track.duration)
    this.durEl.textContent = listed ? track.duration : '0:00'
    this.seek.value = '0'
    this.curEl.textContent = '0:00'

    cancelAnimationFrame(this.raf)

    if (track.audioUrl) {
      this.cueMode = false
      this.handlers.onRealAudioStart()
      if (this.audio.src !== track.audioUrl) {
        this.audio.src = track.audioUrl
      }
      if (autoplay) {
        void this.audio.play().then(() => this.markPlayStarted()).catch(() => {
          this.setPlaying(false)
        })
      } else {
        this.audio.pause()
        this.setPlaying(false)
      }
    } else {
      this.cueMode = true
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.handlers.onRealAudioEnd()
      if (autoplay) {
        this.handlers.onPlayCue(artist, this.index)
        this.setPlaying(true)
        this.markPlayStarted()
        this.armCueEnd()
      } else {
        this.setPlaying(false)
      }
      if (listed) {
        this.durEl.textContent = track.duration
      }
    }
  }

  private renderArt(artist: Artist): void {
    const cover = coverFor(artist)
    const img = must(this.el, '#player-art-img') as HTMLImageElement
    const fallback = must(this.el, '#player-art-fallback')
    fallback.textContent = cover.initials || '✦'
    if (cover.url) {
      img.hidden = false
      img.src = cover.url
      img.onerror = () => {
        img.hidden = true
      }
    } else {
      img.hidden = true
      img.removeAttribute('src')
    }
  }

  private renderLyrics(track: Track): void {
    const text = lyricsFor(track)
    if (text) {
      this.lyricsBody.innerHTML = `<pre class="lyrics-text">${escapeHtml(text)}</pre>`
    } else {
      this.lyricsBody.innerHTML = `<p class="lyrics-empty">No lyrics for this track.</p>`
    }
  }

  private togglePlay(): void {
    if (!this.artist) return
    if (this.cueMode) {
      if (this.playing) {
        this.setPlaying(false)
      } else {
        this.handlers.onPlayCue(this.artist, this.index)
        this.setPlaying(true)
        this.markPlayStarted()
        this.armCueEnd()
      }
      return
    }
    if (this.audio.paused) {
      void this.audio.play().then(() => this.markPlayStarted()).catch(() => {})
    } else {
      this.audio.pause()
    }
  }

  private pause(): void {
    this.audio.pause()
    this.setPlaying(false)
  }

  private setPlaying(on: boolean): void {
    this.playing = on
    this.playBtn.textContent = on ? '❚❚' : '▶'
    this.playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play')
    this.el.classList.toggle('is-playing', on)
  }

  private toggleShuffle(): void {
    this.shuffle = !this.shuffle
    this.shuffleBtn.setAttribute('aria-pressed', String(this.shuffle))
    this.shuffleBtn.classList.toggle('on', this.shuffle)
    this.rebuildOrder(this.index)
  }

  private cycleLoop(): void {
    const next: LoopMode = this.loop === 'off' ? 'all' : this.loop === 'all' ? 'one' : 'off'
    this.loop = next
    this.loopBtn.dataset.mode = next
    this.loopBtn.setAttribute('aria-pressed', String(next !== 'off'))
    this.loopBtn.classList.toggle('on', next !== 'off')
    this.loopBtn.title = next === 'off' ? 'Repeat' : next === 'all' ? 'Repeat all' : 'Repeat one'
    this.loopBtn.textContent = next === 'one' ? '🔂' : '🔁'
    this.audio.loop = next === 'one'
  }

  private rebuildOrder(keep: number): void {
    if (!this.artist) {
      this.order = []
      return
    }
    const n = this.artist.tracks.length
    const ids = Array.from({ length: n }, (_, i) => i)
    if (!this.shuffle) {
      this.order = ids
      return
    }
    // Fisher–Yates, then rotate so `keep` is first
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    const at = ids.indexOf(keep)
    if (at > 0) {
      const head = ids.splice(at)
      this.order = head.concat(ids)
    } else {
      this.order = ids
    }
  }

  private posInOrder(): number {
    const p = this.order.indexOf(this.index)
    return p < 0 ? 0 : p
  }

  private prev(): void {
    if (!this.artist) return
    if (!this.cueMode && this.audio.currentTime > 3) {
      this.audio.currentTime = 0
      return
    }
    const pos = this.posInOrder()
    if (pos <= 0) {
      if (this.loop === 'all' && this.order.length) {
        this.index = this.order[this.order.length - 1]
        this.loadCurrent(true)
      } else if (!this.cueMode) {
        this.audio.currentTime = 0
      }
      return
    }
    this.index = this.order[pos - 1]
    this.loadCurrent(true)
  }

  private next(): void {
    if (!this.artist) return
    const pos = this.posInOrder()
    if (pos >= this.order.length - 1) {
      if (this.loop === 'all' && this.order.length) {
        this.index = this.order[0]
        this.loadCurrent(true)
      } else if (this.loop === 'one') {
        this.loadCurrent(true)
      } else {
        this.pause()
        if (!this.cueMode) this.audio.currentTime = 0
        this.paintProgress()
      }
      return
    }
    this.index = this.order[pos + 1]
    this.loadCurrent(true)
  }

  private onEnded(): void {
    this.playBilled = false
    if (this.loop === 'one') {
      this.audio.currentTime = 0
      void this.audio.play().then(() => this.markPlayStarted()).catch(() => {})
      return
    }
    this.next()
  }

  private effectiveDuration(): number {
    if (!this.cueMode && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      return this.audio.duration
    }
    const track = this.track()
    return track ? parseDuration(track.duration) : 0
  }

  private paintProgress(): void {
    if (this.scrubbing) return
    const dur = this.effectiveDuration()
    const cur = this.cueMode ? 0 : this.audio.currentTime || 0
    this.curEl.textContent = fmtTime(cur)
    if (dur > 0) {
      this.durEl.textContent = fmtTime(dur)
      this.seek.value = String(Math.round((cur / dur) * 1000))
    }
  }

  private commitSeek(): void {
    if (this.cueMode) return
    const dur = this.effectiveDuration()
    if (!(dur > 0)) return
    this.audio.currentTime = (Number(this.seek.value) / 1000) * dur
    this.paintProgress()
  }

  private toggleLyrics(): void {
    if (this.lyricsSheet.classList.contains('hidden')) {
      this.lyricsSheet.classList.remove('hidden')
      this.lyricsSheet.setAttribute('aria-hidden', 'false')
      this.lyricsBtn.setAttribute('aria-expanded', 'true')
    } else {
      this.closeLyrics()
    }
  }

  private closeLyrics(): void {
    this.lyricsSheet.classList.add('hidden')
    this.lyricsSheet.setAttribute('aria-hidden', 'true')
    this.lyricsBtn.setAttribute('aria-expanded', 'false')
  }
}

function must(root: ParentNode | Document, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel)
  if (!el) throw new Error(`Missing ${sel}`)
  return el
}
