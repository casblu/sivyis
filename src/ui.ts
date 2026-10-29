import { mountSlideConfirm } from './slideConfirm'
import {
  ARTIST_PROFILES,
  ARTISTS,
  GENRES,
  GENRE_BY_ID,
  SUBGENRE_BY_ID,
  getArtistProfile,
  type Artist,
  type Genre,
} from './artists.ts'
import type { NavMode } from './controls.ts'
import { philosophyPageHtml } from './philosophy.ts'
import { mountPhilosophyWeb, type PhilosophyWebHandle } from './philosophyWeb.ts'
import { mountMusicHistory, type MusicHistoryHandle } from './musicHistory.ts'
import { formatBtc, formatSats, timeAgo, wallet, type WalletTx } from './wallet.ts'
import { memorialYears } from './memorials.ts'
import artistPhotos from './artistPhotos.json'

type Photo = { file: string; artist: string; license: string; source: string }
const PHOTOS = artistPhotos as Record<string, Photo[]>
const BASE = import.meta.env.BASE_URL

function heroHtml(artist: Artist): string {
  const base = artist.id.includes('__') ? artist.id.slice(0, artist.id.indexOf('__')) : artist.id
  const hex = '#' + artist.color.toString(16).padStart(6, '0')
  const photos: { url: string; credit: string; href: string }[] = (PHOTOS[base] ?? []).map((p) => ({
    url: BASE + 'artists/' + p.file,
    credit: `Photo: ${p.artist} · ${p.license} · Wikimedia Commons`,
    href: p.source,
  }))
  if (!photos.length && artist.open?.image) photos.push({ url: artist.open.image, credit: 'Image: artist feed', href: artist.open.image })
  const initials = artist.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const main = photos[0]
  const gallery = photos.length > 1
    ? `<div class="hero-gallery">${photos.map((p, i) => `<button type="button" class="hero-thumb${i === 0 ? ' active' : ''}" data-i="${i}"><img loading="lazy" src="${escapeHtml(p.url)}" alt=""></button>`).join('')}</div>`
    : ''
  return `<div class="artist-hero" style="--c:${hex}" data-photos='${escapeHtml(JSON.stringify(photos))}'>
      <div class="hero-fallback"><span>${escapeHtml(initials)}</span></div>
      ${main ? `<img class="hero-img" src="${escapeHtml(main.url)}" alt="${escapeHtml(artist.name)}" onerror="this.remove()">` : ''}
      <div class="hero-fade"></div>
      <div class="hero-text">
        <p class="kicker">${escapeHtml(artist.genre)} · ${escapeHtml(artist.subgenre)}</p>
        <h2>${escapeHtml(artist.name)}</h2>
      </div>
    </div>
    ${main ? `<a class="hero-credit" href="${escapeHtml(main.href)}" target="_blank" rel="noopener">${escapeHtml(main.credit)}</a>` : ''}
    ${gallery}`
}

export type AppTab = 'galaxy' | 'philosophy' | 'history' | 'profile'

export class UI {
  root: HTMLElement
  onSelectTrack: ((artist: Artist, index: number) => void) | null = null
  onEnter: (() => void) | null = null
  onMute: ((muted: boolean) => void) | null = null
  onClosePanel: (() => void) | null = null
  onToggleMode: (() => void) | null = null
  onLookAt: ((artist: Artist) => void) | null = null
  onFlyTo: ((artist: Artist) => void) | null = null
  onSendBtc: ((artist: Artist, amount: number) => void) | null = null
  /** Called when switching tabs; galaxy should pause pointer lock etc. */
  onTabChange: ((tab: AppTab) => void) | null = null

  private overlay: HTMLElement
  private recapture: HTMLElement
  private nearestEl: HTMLElement
  private panel: HTMLElement
  private muteBtn: HTMLButtonElement
  private modeBtn: HTMLButtonElement
  private walletBtn: HTMLButtonElement
  private label: HTMLElement
  private nowPlaying: HTMLElement
  private genreLabel: HTMLElement
  private genreOverview: HTMLElement
  private gestureHint: HTMLElement
  private sheetHandle: HTMLElement
  private searchInput: HTMLInputElement
  private searchResults: HTMLElement
  private searchActions: HTMLElement
  private lookAtBtn: HTMLButtonElement
  private flyToBtn: HTMLButtonElement
  private bottomNav: HTMLElement
  private philosophyView: HTMLElement
  private historyView: HTMLElement
  private profileView: HTMLElement
  private walletDrawer: HTMLElement
  private galaxyChrome: HTMLElement[]
  muted = false
  tab: AppTab = 'galaxy'
  private sheetDragging = false
  private sheetStartY = 0
  private sheetOffset = 0
  private searchHit: Artist | null = null
  private activeArtist: Artist | null = null
  private unsubWallet: (() => void) | null = null
  private philWeb: PhilosophyWebHandle | null = null
  private hist: MusicHistoryHandle | null = null

  constructor(root: HTMLElement) {
    this.root = root
    root.innerHTML = layout()
    this.overlay = must(root, '#gate')
    this.recapture = must(root, '#recapture')
    this.nearestEl = must(root, '#nearest')
    this.panel = must(root, '#panel')
    this.muteBtn = must(root, '#mute') as HTMLButtonElement
    this.modeBtn = must(root, '#mode-toggle') as HTMLButtonElement
    this.walletBtn = must(root, '#wallet-btn') as HTMLButtonElement
    this.label = must(root, '#float-label')
    this.nowPlaying = must(root, '#now-playing')
    this.genreLabel = must(root, '#genre-label')
    this.genreOverview = must(root, '#genre-overview')
    this.gestureHint = must(root, '#gesture-hint')
    this.sheetHandle = must(root, '#sheet-handle')
    this.searchInput = must(root, '#search-input') as HTMLInputElement
    this.searchResults = must(root, '#search-results')
    this.searchActions = must(root, '#search-actions')
    this.lookAtBtn = must(root, '#look-at') as HTMLButtonElement
    this.flyToBtn = must(root, '#fly-to') as HTMLButtonElement
    this.bottomNav = must(root, '#bottom-nav')
    this.philosophyView = must(root, '#philosophy-view')
    this.historyView = must(root, '#history-view')
    this.profileView = must(root, '#profile-view')
    this.walletDrawer = must(root, '#wallet-drawer')

    this.galaxyChrome = [
      must(root, '#brand'),
      this.nearestEl,
      must(root, '#hud-tools'),
      must(root, '#search-box'),
      this.gestureHint,
      must(root, '#hints'),
      this.recapture,
      this.label,
      this.nowPlaying,
      this.genreLabel,
      this.genreOverview,
      must(root, '#crosshair'),
      must(root, '#vignette'),
    ]

    must(root, '#enter').addEventListener('click', () => this.onEnter?.())
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted
      this.muteBtn.textContent = this.muted ? 'Sound off' : 'Sound on'
      this.muteBtn.setAttribute('aria-pressed', String(!this.muted))
      this.onMute?.(this.muted)
    })
    this.modeBtn.addEventListener('click', () => this.onToggleMode?.())
    this.walletBtn.addEventListener('click', () => this.openWallet())
    must(root, '#wallet-close').addEventListener('click', () => this.closeWallet())
    must(root, '#wallet-backdrop').addEventListener('click', () => this.closeWallet())
    must(root, '#panel-close').addEventListener('click', () => {
      this.hidePanel()
      this.onClosePanel?.()
    })

    this.lookAtBtn.addEventListener('click', () => {
      if (this.searchHit) this.onLookAt?.(this.searchHit)
    })
    this.flyToBtn.addEventListener('click', () => {
      if (this.searchHit) this.onFlyTo?.(this.searchHit)
    })

    this.searchInput.addEventListener('input', () => this.refreshSearch())
    this.searchInput.addEventListener('focus', () => this.refreshSearch())
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.searchHit) {
        e.preventDefault()
        this.onFlyTo?.(this.searchHit)
      }
      if (e.key === 'Escape') {
        this.searchInput.blur()
        this.clearSearchSelection()
      }
    })

    must(root, '#hud-tools').addEventListener('pointerdown', (e) => e.stopPropagation())
    must(root, '#search-box').addEventListener('pointerdown', (e) => e.stopPropagation())
    this.bottomNav.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.walletDrawer.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.philosophyView.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.historyView.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.profileView.addEventListener('pointerdown', (e) => e.stopPropagation())

    this.bottomNav.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as AppTab
        this.setTab(tab)
      })
    })

    this.bindSheetDismiss()
    this.buildOverviewGenreLabels()
    this.philosophyView.innerHTML = philosophyPageHtml()
    this.philWeb = mountPhilosophyWeb(this.philosophyView)
    this.hist = mountMusicHistory(this.historyView, {
      onOpenArtist: (artistId) => {
        const artist = ARTIST_PROFILES.find((a) => a.id === artistId || a.baseId === artistId)
        if (!artist) return
        this.setTab('galaxy')
        this.openPanel(artist)
        this.onFlyTo?.(artist)
      },
      onOpenPhilosophyNode: () => {
        this.setTab('philosophy')
      },
    })
    this.renderWallet()
    this.renderProfile()
    this.unsubWallet = wallet.subscribe(() => {
      this.renderWallet()
      this.renderProfile()
      if (this.activeArtist && this.panel.classList.contains('open')) {
        this.refreshArtistWalletBits(this.activeArtist)
      }
    })

    const dismissed = sessionStorage.getItem('sivyis-gesture-hint') === '1'
    if (dismissed) this.gestureHint.classList.add('hidden')
  }

  dispose(): void {
    this.philWeb?.dispose()
    this.philWeb = null
    this.hist?.dispose()
    this.hist = null
    this.unsubWallet?.()
  }

  entered(isTouch: boolean): void {
    this.overlay.classList.add('hidden')
    document.body.classList.toggle('is-touch', isTouch)
    document.body.classList.toggle('is-desktop', !isTouch)
    document.body.classList.add('mode-fly')
    document.body.classList.remove('mode-overview')
    this.genreOverview.classList.add('hidden')
    this.modeBtn.classList.add('hidden')
    if (sessionStorage.getItem('sivyis-gesture-hint') !== '1') {
      this.gestureHint.classList.remove('hidden')
      window.setTimeout(() => this.fadeGestureHint(), 11000)
    }
  }

  setTab(tab: AppTab): void {
    this.tab = tab
    document.body.dataset.tab = tab
    this.bottomNav.querySelectorAll('[data-tab]').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab)
    })

    const onGalaxy = tab === 'galaxy'
    this.philosophyView.classList.toggle('hidden', tab !== 'philosophy')
    this.historyView.classList.toggle('hidden', tab !== 'history')
    this.profileView.classList.toggle('hidden', tab !== 'profile')
    for (const el of this.galaxyChrome) {
      if (el.id === 'gesture-hint' && el.classList.contains('hidden')) continue
      el.classList.toggle('tab-hidden', !onGalaxy)
    }
    must(this.root, '#view').classList.toggle('tab-dim', !onGalaxy)
    if (!onGalaxy) {
      this.hidePanel()
      this.closeWallet()
      this.onClosePanel?.()
    }
    if (tab === 'philosophy') this.philWeb?.activate()
    else this.philWeb?.deactivate()
    if (tab === 'history') this.hist?.activate()
    else this.hist?.deactivate()
    this.onTabChange?.(tab)
  }

  setNavMode(mode: NavMode): void {
    // Force fly UX — overview orbit UI retired.
    const m: NavMode = 'fly'
    document.body.classList.toggle('mode-overview', false)
    document.body.classList.toggle('mode-fly', true)
    this.modeBtn.classList.add('hidden')
    this.genreOverview.classList.add('hidden')
    this.modeBtn.textContent = 'Fly'
    this.modeBtn.setAttribute('aria-label', 'Fly mode')
    void mode
    void m
  }

  fadeGestureHint(): void {
    if (this.gestureHint.classList.contains('hidden')) return
    this.gestureHint.classList.add('fade')
    sessionStorage.setItem('sivyis-gesture-hint', '1')
    window.setTimeout(() => this.gestureHint.classList.add('hidden'), 600)
  }

  showRecapture(show: boolean): void {
    this.recapture.classList.toggle('hidden', !show)
  }

  setNearest(artist: Artist | null, distance: number | null): void {
    if (!artist || distance === null) {
      this.nearestEl.innerHTML = `<span class="kicker">Nearby</span><strong>Open space</strong><em>Search or fly into a nebula</em>`
      return
    }
    this.nearestEl.innerHTML = `<span class="kicker">Nearby</span><strong>${escapeHtml(artist.name)}</strong><em>${escapeHtml(artist.genre)} · ${escapeHtml(artist.subgenre)} · ${distance.toFixed(1)} ly</em>`
  }

  setFloatLabel(artist: Artist | null, x: number, y: number, visible: boolean): void {
    if (!artist || !visible) {
      this.label.classList.add('hidden')
      return
    }
    this.label.classList.remove('hidden')
    this.label.textContent = artist.name
    this.label.style.left = `${x}px`
    this.label.style.top = `${y}px`
  }

  setNowPlaying(
    artist: Artist | null,
    x: number,
    y: number,
    onscreen: boolean,
    behind: boolean,
  ): void {
    if (!artist) {
      this.nowPlaying.classList.add('hidden')
      return
    }
    this.nowPlaying.classList.remove('hidden')
    this.nowPlaying.innerHTML = `<span class="np-kicker">Now near</span><strong>${escapeHtml(artist.name)}</strong>`
    const pad = 16
    const w = window.innerWidth
    const h = window.innerHeight
    let cx = x
    let cy = y
    if (!onscreen || behind) {
      const dx = x - w / 2
      const dy = y - h / 2
      const len = Math.hypot(dx, dy) || 1
      const nx = dx / len
      const ny = dy / len
      const edge = Math.min(w, h) * 0.42
      cx = w / 2 + nx * edge
      cy = h / 2 + ny * edge
      this.nowPlaying.classList.add('edge')
    } else {
      this.nowPlaying.classList.remove('edge')
    }
    cx = Math.max(pad, Math.min(w - pad, cx))
    cy = Math.max(pad + 40, Math.min(h - pad - 80, cy))
    this.nowPlaying.style.left = `${cx}px`
    this.nowPlaying.style.top = `${cy}px`
  }

  setGenreLabel(genre: Genre | null, x: number, y: number, visible: boolean): void {
    if (!genre || !visible) {
      this.genreLabel.classList.add('hidden')
      return
    }
    this.genreLabel.classList.remove('hidden')
    this.genreLabel.textContent = genre.name
    this.genreLabel.style.left = `${x}px`
    this.genreLabel.style.top = `${y}px`
    this.genreLabel.style.setProperty('--gc', `#${genre.color.toString(16).padStart(6, '0')}`)
  }

  updateOverviewGenreLabel(id: string, x: number, y: number, visible: boolean): void {
    const el = this.genreOverview.querySelector<HTMLElement>(`[data-genre="${id}"]`)
    if (!el) return
    if (!visible) {
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }

  openPanel(artist: Artist): void {
    if (this.tab !== 'galaxy') this.setTab('galaxy')
    artist = getArtistProfile(artist.id)
    this.activeArtist = artist
    const songs = artist.tracks
      .map(
        (t, i) => `
      <button class="track" type="button" data-i="${i}">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <span class="meta">
          <b>${escapeHtml(t.title)}</b>
          <i>${t.audioUrl ? `${t.source === 'nostr' ? 'Nostr' : 'V4V RSS'} · real recording${t.album ? ' · ' + escapeHtml(t.album) : ''}` : 'Demo cue · not the recording'}</i>
        </span>
        <span class="dur">${escapeHtml(t.duration)}</span>
      </button>`,
      )
      .join('')

    const storeLinks = artist.open
      ? artist.open.links
          .map((l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></li>`)
          .join('')
      : mockStoreLinks(artist)
    const related = relatedArtists(artist)

    must(this.panel, '#panel-body').innerHTML = `
      ${heroHtml(artist)}
      ${alsoInLine(artist)}
      ${artist.isNew ? `<p class="memorial-line">✦ New star · just joined Cosmoly (demo)</p>` : ''}
      ${artist.memorial ? `<p class="memorial-line">✦ In memoriam · ${memorialYears(artist.memorial)}${artist.memorial.place ? ' · ' + escapeHtml(artist.memorial.place) : ''}</p>` : ''}
      ${openBadges(artist)}
      <p class="bio">${escapeHtml(artist.bio)}</p>
      ${artist.open ? openPayHtml(artist) : '<p class="demo-note">Audio is a royalty-safe procedural demo generated in your browser — not a copyrighted recording. Song titles are listed for reference only.</p>'}

      <div class="artist-wallet-card" id="artist-wallet-card">
        <div>
          <span class="kicker">Support ${escapeHtml(artist.name)}</span>
          ${artist.showBalance ? `<strong id="artist-btc-bal">${formatBtc(wallet.artistBalance(artist.id))}</strong>` : '<strong class="bal-private">⚡ Zap with demo BTC</strong>'}
        </div>
        <button type="button" class="btc-send-btn" id="open-send-btc">Send BTC</button>
      </div>

      <div class="send-btc-form hidden" id="send-btc-form"></div>

      <h3>Store &amp; merch</h3>
      <ul class="link-list">${storeLinks}</ul>

      <h3>Related</h3>
      <ul class="link-list related-list">${related}</ul>

      <h3>Notable tracks</h3>
      <div class="tracks">${songs}</div>
    `
    this.panel.style.transform = ''
    this.sheetOffset = 0
    this.panel.classList.add('open')
    this.panel.setAttribute('aria-hidden', 'false')

    const pb = must(this.panel, '#panel-body')
    pb.scrollTop = 0
    this.panel.scrollTop = 0
    const hero = pb.querySelector<HTMLElement>('.artist-hero')
    pb.querySelectorAll<HTMLButtonElement>('.hero-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        const list = JSON.parse(hero?.dataset.photos ?? '[]') as { url: string; credit: string; href: string }[]
        const p = list[Number(btn.dataset.i)]
        if (!p || !hero) return
        let img = hero.querySelector<HTMLImageElement>('.hero-img')
        if (!img) { img = document.createElement('img'); img.className = 'hero-img'; hero.insertBefore(img, hero.querySelector('.hero-fade')) }
        img.src = p.url
        const cr = pb.querySelector<HTMLAnchorElement>('.hero-credit')
        if (cr) { cr.textContent = p.credit; cr.href = p.href }
        pb.querySelectorAll('.hero-thumb').forEach((b) => b.classList.toggle('active', b === btn))
      })
    })
    must(this.panel, '#panel-body').querySelectorAll<HTMLButtonElement>('.track').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i)
        this.onSelectTrack?.(artist, i)
        must(this.panel, '#panel-body').querySelectorAll('.track').forEach((el) => el.classList.remove('active'))
        btn.classList.add('active')
      })
    })

    const form = must(this.panel, '#send-btc-form')
    must(this.panel, '#open-send-btc').addEventListener('click', () => {
      // Always a fresh slider when (re)opening the send section.
      this.renderSendSection(artist, form)
      form.classList.remove('hidden')
      form.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })

    must(this.panel, '#panel-body').querySelectorAll<HTMLButtonElement>('[data-related]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = ARTISTS.find((x) => x.id === btn.dataset.related)
        if (a) this.onFlyTo?.(a)
      })
    })
  }

  hidePanel(): void {
    this.panel.classList.remove('open')
    this.panel.setAttribute('aria-hidden', 'true')
    this.panel.style.transform = ''
    this.sheetOffset = 0
    this.activeArtist = null
  }

  openWallet(): void {
    this.renderWallet()
    this.walletDrawer.classList.add('open')
    this.walletDrawer.setAttribute('aria-hidden', 'false')
    must(this.root, '#wallet-backdrop').classList.add('open')
  }

  closeWallet(): void {
    this.walletDrawer.classList.remove('open')
    this.walletDrawer.setAttribute('aria-hidden', 'true')
    must(this.root, '#wallet-backdrop').classList.remove('open')
  }

  private txRows(txs: WalletTx[], withArtist: boolean): string {
    if (!txs.length) return '<p class="muted-line">No zaps yet.</p>'
    return `<ul class="tx-list">${txs.map((t) => `<li><span>⚡ ${withArtist ? escapeHtml(t.note) + ' · ' : ''}${timeAgo(t.at)}</span><b>${t.kind === 'fund' ? '+' : '−'}${formatSats(t.amount)}</b></li>`).join('')}</ul>`
  }

  private renderSendSection(artist: Artist, form: HTMLElement): void {
    let sending = false
    form.innerHTML = `
      <div class="send-head">
        <p class="kicker">Send Bitcoin · demo only</p>
        <button type="button" class="send-close" id="send-close" aria-label="Close send">×</button>
      </div>
      <div id="send-live">
        <p class="send-hint">Your balance: <span id="send-user-bal">${formatBtc(wallet.userBalance)}</span> · ${formatSats(wallet.userBalance)}</p>
        <div class="send-row">
          <input id="send-amount" type="number" inputmode="decimal" min="0.0001" step="0.001" value="0.001" aria-label="BTC amount" />
          <select id="send-kind" aria-label="Payment type">
            <option value="tip">Tip</option>
            <option value="merch">Merch</option>
            <option value="send">Payment</option>
          </select>
        </div>
        <div id="confirm-send-btc"></div>
      </div>
      <p class="send-status" id="send-status" role="status"></p>
      <div class="send-recent">
        <p class="kicker">Your recent zaps to ${escapeHtml(artist.name)}</p>
        <div id="send-recent-list">${this.txRows(wallet.txsToArtist(artist.id), false)}</div>
        <button type="button" class="link-btn" id="view-all-tx">View all history →</button>
      </div>`
    must(form, '#send-close').addEventListener('click', () => { form.classList.add('hidden'); form.innerHTML = '' })
    must(form, '#view-all-tx').addEventListener('click', () => this.openTxHistory())
    mountSlideConfirm(must(form, '#confirm-send-btc'), () => {
      if (sending) return
      sending = true
      const amount = Number((must(form, '#send-amount') as HTMLInputElement).value)
      const kind = (must(form, '#send-kind') as HTMLSelectElement).value as 'tip' | 'merch' | 'send'
      const result = wallet.sendToArtist(artist.id, artist.name, amount, kind)
      const status = must(form, '#send-status')
      if (result.ok) {
        status.textContent = ''
        // Replace the slider with a receipt; user must close & reopen to send again.
        must(form, '#send-live').outerHTML = `
          <div class="send-receipt" role="status">
            <span class="receipt-bolt">⚡</span>
            <div><strong>${formatBtc(amount)}</strong><small>${formatSats(amount)} sent to ${escapeHtml(artist.name)} (demo)</small></div>
          </div>`
        must(form, '#send-recent-list').innerHTML = this.txRows(wallet.txsToArtist(artist.id), false)
        this.refreshArtistWalletBits(artist)
        this.onSendBtc?.(artist, amount)
      } else {
        // fresh slider so the user can fix the amount and retry
        this.renderSendSection(artist, form)
        must(form, '#send-status').textContent = result.error
        must(form, '#send-status').classList.add('err')
      }
    }, 'Slide to send', true)
  }

  openTxHistory(): void {
    document.getElementById('tx-history')?.remove()
    const el = document.createElement('div')
    el.id = 'tx-history'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', 'Transaction history')
    el.innerHTML = `
      <div class="txh-head"><h2>Transaction history</h2><button type="button" class="send-close" aria-label="Close history">×</button></div>
      <p class="demo-badge">Demo wallet · newest first · saved on this device</p>
      ${this.txRows(wallet.allTxs(), true)}`
    el.querySelector('.send-close')!.addEventListener('click', () => el.remove())
    document.body.appendChild(el)
  }

  private refreshArtistWalletBits(artist: Artist): void {
    const bal = this.panel.querySelector('#artist-btc-bal')
    if (bal && artist.showBalance) bal.textContent = formatBtc(wallet.artistBalance(artist.id))
    const userBal = this.panel.querySelector('#send-user-bal')
    if (userBal) userBal.textContent = formatBtc(wallet.userBalance)
  }

  private renderWallet(): void {
    const body = must(this.walletDrawer, '#wallet-body')
    const txs = wallet.recentTxs(10)
    const txHtml =
      txs.length === 0
        ? `<p class="muted-line">No demo transactions yet. Fund your wallet or tip an artist.</p>`
        : `<ul class="tx-list">${txs
            .map(
              (t) =>
                `<li><span>${escapeHtml(t.note)}</span><b>${t.kind === 'fund' ? '+' : '−'}${formatSats(t.amount)}</b></li>`,
            )
            .join('')}</ul>`

    body.innerHTML = `
      <p class="demo-badge">Demo wallet · no real Bitcoin · localStorage only</p>
      <p class="kicker">Your balance</p>
      <p class="wallet-balance" id="user-btc-display">${formatBtc(wallet.userBalance)}</p><p class="wallet-sats">${formatSats(wallet.userBalance)}</p>
      <div class="fund-row">
        <input id="fund-amount" type="number" inputmode="decimal" min="0.001" step="0.01" value="0.01" aria-label="Fund amount" />
        <button type="button" id="fund-btc" class="btc-confirm">Fund (mock)</button>
      </div>
      <p class="send-status" id="fund-status" role="status"></p>
      <h3>Recent activity</h3>
      ${txHtml}
      <p class="muted-line">Tip artists from their profile · Send BTC updates both wallets.</p>
    `

    must(body, '#fund-btc').addEventListener('click', () => {
      const amount = Number((must(body, '#fund-amount') as HTMLInputElement).value)
      const result = wallet.fund(amount)
      const status = must(body, '#fund-status')
      if (result.ok) {
        status.textContent = `Funded ${formatBtc(amount)} (demo).`
        status.classList.add('ok')
        status.classList.remove('err')
      } else {
        status.textContent = result.error
        status.classList.add('err')
        status.classList.remove('ok')
      }
    })
  }

  private renderProfile(): void {
    this.profileView.innerHTML = `
      <div class="profile-card">
        <p class="kicker">SIVYIS Corp</p>
        <h1>Your profile</h1>
        <p class="bio">Explorer account for the Cosmoly music galaxy. Fly stars, study philosophy, and support artists with demo Bitcoin.</p>
        <div class="artist-wallet-card">
          <div>
            <span class="kicker">Demo BTC balance</span>
            <strong>${formatBtc(wallet.userBalance)}</strong>
          </div>
          <button type="button" class="btc-send-btn" id="profile-open-wallet">Wallet</button>
        </div>
        <h3>Quick links</h3>
        <ul class="link-list">
          <li><button type="button" data-goto="galaxy">Open Galaxy</button></li>
          <li><button type="button" data-goto="philosophy">Music Philosophy &amp; Theory</button></li>
          <li><button type="button" data-goto="history">Music History timeline</button></li>
        </ul>
        <p class="demo-note">Official spelling: Cosmoly (C-o-s-m-o-l-y), a SIVYIS Corp product. All payments are simulated.</p>
      </div>
    `
    must(this.profileView, '#profile-open-wallet').addEventListener('click', () => this.openWallet())
    this.profileView.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => this.setTab(btn.dataset.goto as AppTab))
    })
  }

  private buildOverviewGenreLabels(): void {
    this.genreOverview.innerHTML = GENRES.map(
      (g) =>
        `<div class="ov-genre" data-genre="${g.id}" style="--gc:#${g.color.toString(16).padStart(6, '0')}">${escapeHtml(g.name)}</div>`,
    ).join('')
  }

  private refreshSearch(): void {
    const q = this.searchInput.value.trim().toLowerCase()
    if (!q) {
      this.searchResults.innerHTML = ''
      this.searchResults.classList.add('hidden')
      this.clearSearchSelection()
      return
    }
    const hits = ARTIST_PROFILES.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.genre.toLowerCase().includes(q) ||
        a.subgenre.toLowerCase().includes(q),
    ).slice(0, 8)
    if (hits.length === 0) {
      this.searchResults.innerHTML = `<div class="search-empty">No artists match</div>`
      this.searchResults.classList.remove('hidden')
      this.clearSearchSelection()
      return
    }
    this.searchResults.innerHTML = hits
      .map(
        (a) =>
          `<button type="button" class="search-hit" data-id="${a.id}"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.genre)}</span></button>`,
      )
      .join('')
    this.searchResults.classList.remove('hidden')
    this.searchResults.querySelectorAll<HTMLButtonElement>('.search-hit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const artist = ARTIST_PROFILES.find((a) => a.id === btn.dataset.id) ?? null
        this.selectSearchHit(artist)
      })
    })
    this.selectSearchHit(hits[0])
  }

  private selectSearchHit(artist: Artist | null): void {
    this.searchHit = artist
    this.searchResults.querySelectorAll('.search-hit').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.id === artist?.id)
    })
    this.searchActions.classList.toggle('hidden', !artist)
  }

  private clearSearchSelection(): void {
    this.searchHit = null
    this.searchActions.classList.add('hidden')
  }

  private bindSheetDismiss(): void {
    const onStart = (e: PointerEvent) => {
      if (!this.panel.classList.contains('open')) return
      if (!isSheetMode()) return
      this.sheetDragging = true
      this.sheetStartY = e.clientY
      this.sheetOffset = 0
      this.sheetHandle.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!this.sheetDragging) return
      const dy = Math.max(0, e.clientY - this.sheetStartY)
      this.sheetOffset = dy
      this.panel.style.transform = `translateY(${dy}px)`
    }
    const onEnd = () => {
      if (!this.sheetDragging) return
      this.sheetDragging = false
      if (this.sheetOffset > 110) {
        this.hidePanel()
        this.onClosePanel?.()
      } else {
        this.panel.style.transform = ''
        this.sheetOffset = 0
      }
    }
    this.sheetHandle.addEventListener('pointerdown', onStart)
    this.sheetHandle.addEventListener('pointermove', onMove)
    this.sheetHandle.addEventListener('pointerup', onEnd)
    this.sheetHandle.addEventListener('pointercancel', onEnd)

    this.panel.addEventListener(
      'touchmove',
      (e) => {
        if (!isSheetMode() || !this.panel.classList.contains('open')) return
        if (this.panel.scrollTop <= 0 && this.sheetDragging) e.preventDefault()
      },
      { passive: false },
    )
  }
}

function mockStoreLinks(artist: Artist): string {
  const slug = artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const items = [
    { label: 'Official store', href: `#store/${slug}` },
    { label: 'Merch drops', href: `#merch/${slug}` },
    { label: 'Tour & tickets', href: `#tour/${slug}` },
    { label: 'Press kit', href: `#press/${slug}` },
  ]
  return items
    .map(
      (i) =>
        `<li><a href="${i.href}" onclick="return false">${escapeHtml(i.label)} <span>demo link</span></a></li>`,
    )
    .join('')
}

function alsoInLine(artist: Artist): string {
  if (!artist.alsoIn.length) return ''
  const labels = artist.alsoIn.map((a) => {
    const g = GENRE_BY_ID[a.genreId]?.name ?? a.genreId
    const s = SUBGENRE_BY_ID[a.subgenreId]?.name ?? ''
    return s ? `${g} / ${s}` : g
  })
  return `<p class="also-in">Also in: ${escapeHtml(labels.join(' · '))}</p>`
}

function relatedArtists(artist: Artist): string {
  const seen = new Set<string>([artist.baseId])
  const same = ARTIST_PROFILES.filter((a) => {
    if (seen.has(a.baseId)) return false
    if (a.genreId !== artist.genreId && a.subgenreId !== artist.subgenreId) return false
    seen.add(a.baseId)
    return true
  }).slice(0, 4)
  return same
    .map(
      (a) =>
        `<li><button type="button" data-related="${a.id}">${escapeHtml(a.name)} <span>${escapeHtml(a.genre)}</span></button></li>`,
    )
    .join('')
}

function isSheetMode(): boolean {
  return window.matchMedia('(max-width: 720px), (pointer: coarse)').matches
}

function must(root: ParentNode, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel)
  if (!el) throw new Error(`Missing ${sel}`)
  return el
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function layout(): string {
  return `
  <canvas id="view"></canvas>
  <div id="vignette"></div>
  <div id="crosshair" aria-hidden="true"></div>
  <div id="float-label" class="hidden"></div>
  <div id="now-playing" class="hidden"></div>
  <div id="genre-label" class="hidden"></div>
  <div id="genre-overview"></div>

  <header id="brand">
    <p class="kicker">A SIVYIS Corp product</p>
    <h1>Cosmoly</h1>
  </header>

  <aside id="nearest">
    <span class="kicker">Nearby</span>
    <strong>Open space</strong>
    <em>Search or fly into a nebula</em>
  </aside>

  <div id="hud-tools">
    <button id="wallet-btn" type="button" aria-label="Open Bitcoin wallet">Wallet</button>
    <button id="mode-toggle" type="button" aria-label="Enter fly exploration">Enter Fly</button>
    <button id="mute" type="button" aria-pressed="true">Sound on</button>
  </div>

  <div id="search-box">
    <label class="sr-only" for="search-input">Search artists</label>
    <input id="search-input" type="search" placeholder="Search artists…" autocomplete="off" spellcheck="false" enterkeyhint="go" />
    <div id="search-results" class="hidden"></div>
    <div id="search-actions" class="hidden">
      <button id="look-at" type="button">Look At</button>
      <button id="fly-to" type="button">Fly To</button>
    </div>
  </div>

  <div id="gesture-hint" role="status">
    <p><strong>Fly</strong> the galaxy — drag to look · pinch to zoom · tap a star</p>
    <p class="sub">Search → Look At / Fly To · WASD · click the view to mouse-look (up, down, turn) · Esc releases</p>
  </div>

  <footer id="hints" class="desktop-only">
    <div><kbd>WASD</kbd> fly</div>
    <div><kbd>QE</kbd> up / down</div>
    <div><kbd>Shift</kbd> boost</div>
    <div><kbd>Mouse</kbd> look up/down &amp; turn (click to capture)</div>
    <div><kbd>Click</kbd> star profile</div>
    <div><kbd>Esc</kbd> free cursor</div>
  </footer>

  <div id="recapture" class="hidden">Click to recapture mouse look</div>

  <aside id="panel" aria-hidden="true">
    <div id="sheet-handle" aria-hidden="true"><span></span></div>
    <button id="panel-close" type="button" aria-label="Close profile">×</button>
    <div id="panel-body"></div>
  </aside>

  <div id="wallet-backdrop"></div>
  <aside id="wallet-drawer" aria-hidden="true" aria-label="Bitcoin wallet">
    <div class="wallet-head">
      <div>
        <p class="kicker">Bitcoin</p>
        <h2>Wallet</h2>
      </div>
      <button id="wallet-close" type="button" aria-label="Close wallet">×</button>
    </div>
    <div id="wallet-body"></div>
  </aside>

  <section id="philosophy-view" class="app-view hidden" aria-label="Music Philosophy and Theory"></section>
  <section id="history-view" class="app-view hidden" aria-label="Music History"></section>
  <section id="profile-view" class="app-view hidden" aria-label="Profile"></section>

  <div id="player-host"></div>

  <nav id="bottom-nav" aria-label="Main">
    <button type="button" data-tab="galaxy" class="active">
      <span class="nav-ico" aria-hidden="true">✦</span>
      <span>Galaxy</span>
    </button>
    <button type="button" data-tab="philosophy">
      <span class="nav-ico" aria-hidden="true">◎</span>
      <span>Philosophy</span>
    </button>
    <button type="button" data-tab="history">
      <span class="nav-ico" aria-hidden="true">▦</span>
      <span>History</span>
    </button>
    <button type="button" data-tab="profile">
      <span class="nav-ico" aria-hidden="true">◐</span>
      <span>Profile</span>
    </button>
  </nav>

  <div id="gate">
    <div class="gate-card">
      <p class="kicker">A SIVYIS Corp product · Music galaxy</p>
      <h1>Cosmoly</h1>
      <p>Fly through the stars to discover artists. Each star is selectable — open profiles for store, merch, related links, and demo Bitcoin tips. Study music philosophy in the tab below, and keep your demo wallet ready.</p>
      <p class="demo-note">Sample stars play generated demo cues. Stars badged <b>RSS · V4V</b> or <b>Nostr</b> are real independent artists from the open Bitcoin music web, streamed from their own feeds and relays.</p>
      <button id="enter" type="button">Enter the galaxy</button>
      <ul class="gate-keys">
        <li><strong>Galaxy:</strong> fly freely · tap stars for profiles</li>
        <li><strong>Philosophy:</strong> perception, theory, idea web</li>
        <li><strong>History:</strong> scrub eras · narrative · media receipts</li>
        <li><strong>Wallet:</strong> demo BTC fund &amp; tip artists</li>
        <li><strong>Phone:</strong> drag look · pinch zoom · bottom nav</li>
      </ul>
    </div>
  </div>
  `
}

function openBadges(artist: Artist): string {
  if (!artist.open) return ''
  const b = artist.open.sources
    .map((s) => `<span class="src-badge src-${s}">${s === 'rss' ? 'RSS · V4V' : 'Nostr'}</span>`)
    .join('')
  const img = artist.open.image
    ? `<img class="open-avatar" src="${escapeHtml(artist.open.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
    : ''
  return `<div class="open-head">${img}<div class="src-badges">${b}</div></div>`
}

function openPayHtml(artist: Artist): string {
  const pay = artist.open!.pay
  const rows: string[] = []
  if (pay.valueSplits) {
    const r = pay.valueSplits.recipients
      .map((x) => `<li><b>${x.split}%</b> ${escapeHtml(x.name || x.type)} <code>${escapeHtml(x.address.slice(0, 18))}…</code></li>`)
      .join('')
    rows.push(`<p class="kicker">Streaming sats / boosts (${escapeHtml(pay.valueSplits.method)} splits)</p><ul class="pay-list">${r}</ul>`)
  }
  if (pay.lud16) rows.push(`<p class="kicker">Zap (NIP-57) Lightning address</p><p class="pay-target"><code>${escapeHtml(pay.lud16)}</code></p>`)
  else if (pay.nostrPubkey) rows.push(`<p class="kicker">Zap</p><p class="pay-target">No Lightning address on this Nostr profile yet.</p>`)
  if (pay.zapSplits.length) rows.push(`<p class="pay-target">Track zap split: ${pay.zapSplits.length} recipient(s)</p>`)
  return `<div class="open-pay" data-zap-hook="cosmoly-zaps" data-lud16="${escapeHtml(pay.lud16 || '')}" data-pubkey="${escapeHtml(pay.nostrPubkey || '')}">
    <h3>Pay the artist</h3>${rows.join('') || '<p class="pay-target">No payment info published.</p>'}
    <p class="demo-note">Pay targets shown for reference — payments are not live yet. Real recordings stream from the artist's own feed/relay.</p></div>`
}
