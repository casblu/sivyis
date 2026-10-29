/** Demo Energy wallet — localStorage only, no real chain and no real funds. */

const STORAGE_KEY = 'sivyis-demo-wallet-v1'
const PLAY_KEY = 'sivyis-energy-per-play-v1'
const USER_ID = 'user'
/** Demo (pretend) starting balance: 1.5 BTC = 150,000,000 sats of Energy */
const DEFAULT_USER_SATS = 150_000_000
const DEFAULT_USER_BTC = DEFAULT_USER_SATS / 1e8
/** One-time top-up of existing saved wallets to DEFAULT_USER_BTC */
const TOPUP_KEY = 'sivyis-demo-wallet-topup-v2'
/** ~0.008 BTC, plus a small per-artist spread */
const DEFAULT_ARTIST_SATS = 800_000
/** Demo faucet cap: 10 BTC worth of Energy */
export const MAX_FUND_SATS = 1_000_000_000
/** Per-play amount the listener can set */
export const MAX_PLAY_SATS = 100_000

function baseArtistId(id: string): string {
  const i = id.indexOf('__')
  return i === -1 ? id : id.slice(0, i)
}

export const ZAP_PRESETS = [21, 100, 1_000, 5_000] as const

export type TxKind = 'fund' | 'send' | 'tip' | 'merch' | 'play' | 'zap'

export type WalletTx = {
  id: string
  at: number
  kind: TxKind
  fromId: string
  toId: string
  /** BTC-denominated amount (sats / 1e8) so older history still loads */
  amount: number
  note: string
}

export type PlayEnergySettings = {
  enabled: boolean
  satsPerPlay: number
}

export type WalletState = {
  balances: Record<string, number>
  satsBalances: Record<string, number>
  /** Sats of Energy received from plays + zaps (and older tips), keyed by artist base id */
  energySats: Record<string, number>
  txs: WalletTx[]
}

export type SendResult = { ok: true } | { ok: false; error: string }

function loadPlaySettings(): PlayEnergySettings {
  try {
    const raw = localStorage.getItem(PLAY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayEnergySettings>
      const sats = Math.round(Number(parsed.satsPerPlay))
      if (typeof parsed.enabled === 'boolean' && sats >= 1 && sats <= MAX_PLAY_SATS) {
        return { enabled: parsed.enabled, satsPerPlay: sats }
      }
    }
  } catch {
    /* ignore corrupt */
  }
  return { enabled: true, satsPerPlay: 1 }
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WalletState
      if (parsed?.balances && typeof parsed.balances[USER_ID] === 'number') {
        if (!localStorage.getItem(TOPUP_KEY)) {
          parsed.balances[USER_ID] = Math.max(parsed.balances[USER_ID], DEFAULT_USER_BTC)
          localStorage.setItem(TOPUP_KEY, '1')
        }
        return normalize(parsed)
      }
    }
  } catch {
    /* ignore corrupt */
  }
  try { localStorage.setItem(TOPUP_KEY, '1') } catch { /* private mode */ }
  return normalize({
    balances: { [USER_ID]: DEFAULT_USER_BTC },
    satsBalances: { [USER_ID]: DEFAULT_USER_SATS },
    energySats: {},
    txs: [],
  })
}

function normalize(state: WalletState): WalletState {
  if (!state.satsBalances) {
    state.satsBalances = {}
    for (const [id, btc] of Object.entries(state.balances ?? {})) {
      state.satsBalances[id] = Math.max(0, Math.round(Number(btc) * 1e8))
    }
  }
  if (!state.energySats) {
    state.energySats = {}
    for (const tx of state.txs ?? []) {
      if (tx.kind === 'fund' || tx.toId === USER_ID) continue
      const id = baseArtistId(tx.toId)
      const sats = Math.max(0, Math.round(tx.amount * 1e8))
      state.energySats[id] = (state.energySats[id] ?? 0) + sats
    }
  }
  if (!state.txs) state.txs = []
  if (typeof state.satsBalances[USER_ID] !== 'number') {
    state.satsBalances[USER_ID] = Math.max(0, Math.round((state.balances?.[USER_ID] ?? DEFAULT_USER_BTC) * 1e8))
  }
  mirrorBtc(state)
  return state
}

function mirrorBtc(state: WalletState): void {
  for (const [id, sats] of Object.entries(state.satsBalances)) {
    state.balances[id] = sats / 1e8
  }
}

function save(state: WalletState): void {
  mirrorBtc(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function ensureArtist(state: WalletState, artistId: string): string {
  const id = baseArtistId(artistId)
  if (typeof state.satsBalances[id] !== 'number') {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    const sats = DEFAULT_ARTIST_SATS + (h % 900) * 1000
    state.satsBalances[id] = sats
  }
  return id
}

function kindNote(kind: TxKind, artistName: string): string {
  if (kind === 'play') return `Play → ${artistName}`
  if (kind === 'zap') return `Zap → ${artistName}`
  if (kind === 'merch') return `Merch → ${artistName}`
  if (kind === 'tip') return `Zap → ${artistName}`
  return `Energy → ${artistName}`
}

export class DemoWallet {
  private state: WalletState
  private listeners = new Set<() => void>()
  private play: PlayEnergySettings

  constructor() {
    this.state = load()
    this.play = loadPlaySettings()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    save(this.state)
    for (const fn of this.listeners) fn()
  }

  get playSettings(): PlayEnergySettings {
    return { ...this.play }
  }

  setPlaySettings(next: Partial<PlayEnergySettings>): PlayEnergySettings {
    if (typeof next.enabled === 'boolean') this.play.enabled = next.enabled
    if (next.satsPerPlay != null) {
      const sats = Math.round(Number(next.satsPerPlay))
      if (Number.isFinite(sats) && sats >= 1 && sats <= MAX_PLAY_SATS) this.play.satsPerPlay = sats
    }
    try { localStorage.setItem(PLAY_KEY, JSON.stringify(this.play)) } catch { /* private mode */ }
    for (const fn of this.listeners) fn()
    return this.playSettings
  }

  get userSats(): number {
    return this.state.satsBalances[USER_ID] ?? 0
  }

  get userBalance(): number {
    return this.userSats / 1e8
  }

  artistSats(artistId: string): number {
    const id = ensureArtist(this.state, artistId)
    return this.state.satsBalances[id] ?? 0
  }

  artistBalance(artistId: string): number {
    return this.artistSats(artistId) / 1e8
  }

  /** Sats of Energy this star has received from plays and zaps. */
  energySats(artistId: string): number {
    return this.state.energySats[baseArtistId(artistId)] ?? 0
  }

  recentTxs(limit = 12): WalletTx[] {
    return this.state.txs.slice(0, limit)
  }

  fundSats(sats: number): SendResult {
    const n = Math.round(sats)
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    if (n > MAX_FUND_SATS) return { ok: false, error: 'Demo fund max is 1,000,000,000 sats of Energy' }
    this.state.satsBalances[USER_ID] = (this.state.satsBalances[USER_ID] ?? 0) + n
    this.pushTx({
      kind: 'fund',
      fromId: 'faucet',
      toId: USER_ID,
      amount: n / 1e8,
      note: 'Demo Energy fund',
    })
    this.emit()
    return { ok: true }
  }

  fund(amountBtc: number): SendResult {
    if (!Number.isFinite(amountBtc) || amountBtc <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    return this.fundSats(Math.round(amountBtc * 1e8))
  }

  /**
   * Move simulated Energy from the listener's demo wallet to an artist.
   * Nothing touches a real chain. Callers must confirm in the UI first
   * (per-play uses the saved setting; zaps use an explicit send control).
   */
  sendSats(artistId: string, artistName: string, sats: number, kind: 'play' | 'zap' | 'tip' | 'merch' | 'send' = 'zap'): SendResult {
    const n = Math.round(sats)
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    if (n > this.userSats) return { ok: false, error: 'Not enough Energy in your demo wallet' }
    const id = ensureArtist(this.state, artistId)
    this.state.satsBalances[USER_ID] = this.userSats - n
    this.state.satsBalances[id] = (this.state.satsBalances[id] ?? 0) + n
    if (kind === 'play' || kind === 'zap' || kind === 'tip' || kind === 'send' || kind === 'merch') {
      this.state.energySats[id] = (this.state.energySats[id] ?? 0) + n
    }
    this.pushTx({
      kind,
      fromId: USER_ID,
      toId: id,
      amount: n / 1e8,
      note: kindNote(kind, artistName),
    })
    this.emit()
    return { ok: true }
  }

  sendToArtist(
    artistId: string,
    artistName: string,
    amountBtc: number,
    kind: 'tip' | 'merch' | 'send' = 'tip',
  ): SendResult {
    if (!Number.isFinite(amountBtc) || amountBtc <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    return this.sendSats(artistId, artistName, Math.round(amountBtc * 1e8), kind)
  }

  /** User's sends to one artist, newest first. */
  txsToArtist(artistId: string, limit = 5): WalletTx[] {
    const id = baseArtistId(artistId)
    return this.state.txs.filter((t) => t.kind !== 'fund' && baseArtistId(t.toId) === id).slice(0, limit)
  }

  /** Full demo history, newest first. */
  allTxs(): WalletTx[] {
    return [...this.state.txs].sort((a, b) => b.at - a.at)
  }

  private pushTx(partial: Omit<WalletTx, 'id' | 'at'>): void {
    this.state.txs.unshift({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      ...partial,
    })
    if (this.state.txs.length > 80) this.state.txs.length = 80
  }
}

export const wallet = new DemoWallet()

/** Spark icon for Energy amounts. Inline SVG, currentColor. */
export function energyIcon(): string {
  return '<svg class="energy-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9.35 1.15 3.15 9.05h3.55L6.05 14.85l6.85-8.55H9.15z"/></svg>'
}

/** HTML label such as "1 sat of Energy" or "1,000 sats of Energy". */
export function formatEnergy(sats: number): string {
  const n = Math.max(0, Math.round(sats))
  const words = n === 1 ? '1 sat of Energy' : `${n.toLocaleString('en-US')} sats of Energy`
  return `<span class="sats energy" role="text" aria-label="${words}">${energyIcon()}<span class="energy-amt">${words}</span></span>`
}

export function formatEnergyText(sats: number): string {
  const n = Math.max(0, Math.round(sats))
  return n === 1 ? '1 sat of Energy' : `${n.toLocaleString('en-US')} sats of Energy`
}

/** HTML from a BTC float (legacy tx amounts). */
export function formatSats(btc: number): string {
  return formatEnergy(Math.round(btc * 1e8))
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24); return `${d} d ago`
}
