/**
 * Demo Energy wallet — integer satoshis in localStorage.
 * Plays, zaps, and album purchases are simulated. No real chain and no real funds.
 */

import {
  albumForTrack,
  albumsFor,
  baseId,
  energyPhrase,
} from './energy.ts'

const STORAGE_KEY = 'sivyis-demo-wallet-v1'
const USER_ID = 'user'
/** 1.5 BTC in sats, kept as the pretend listener balance. */
const DEFAULT_USER_SATS = 150_000_000
const TOPUP_KEY = 'sivyis-demo-wallet-topup-v2'
const DEFAULT_ARTIST_SATS = 800_000

export type TxKind = 'fund' | 'send' | 'tip' | 'merch' | 'play' | 'zap' | 'album'

export type WalletTx = {
  id: string
  at: number
  kind: TxKind
  fromId: string
  toId: string
  /** Integer satoshis. */
  amount: number
  note: string
}

export type PlayEnergySetting = {
  enabled: boolean
  sats: number
}

export type WalletState = {
  unit?: 'sats'
  balances: Record<string, number>
  txs: WalletTx[]
  owned?: Record<string, string[]>
  play?: PlayEnergySetting
}

const ENERGY_KINDS = new Set<TxKind>(['play', 'zap', 'album', 'tip', 'send', 'merch'])

function load(): WalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WalletState
      if (parsed?.balances && typeof parsed.balances[USER_ID] === 'number') {
        migrateToSats(parsed)
        if (!localStorage.getItem(TOPUP_KEY)) {
          parsed.balances[USER_ID] = Math.max(parsed.balances[USER_ID], DEFAULT_USER_SATS)
          localStorage.setItem(TOPUP_KEY, '1')
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        }
        parsed.owned ??= {}
        parsed.play ??= { enabled: true, sats: 1 }
        return parsed
      }
    }
  } catch {
    /* ignore corrupt */
  }
  try { localStorage.setItem(TOPUP_KEY, '1') } catch { /* private mode */ }
  return {
    unit: 'sats',
    balances: { [USER_ID]: DEFAULT_USER_SATS },
    txs: [],
    owned: {},
    play: { enabled: true, sats: 1 },
  }
}

/** Older saves stored BTC as a float. Convert once to integer sats. */
function migrateToSats(state: WalletState): void {
  if (state.unit === 'sats') return
  for (const k of Object.keys(state.balances)) {
    state.balances[k] = Math.round(state.balances[k] * 1e8)
  }
  for (const tx of state.txs) {
    tx.amount = Math.round(tx.amount * 1e8)
  }
  state.unit = 'sats'
  state.owned ??= {}
  state.play ??= { enabled: true, sats: 1 }
}

function save(state: WalletState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function ensureArtist(state: WalletState, artistId: string): void {
  const id = baseId(artistId)
  if (typeof state.balances[id] !== 'number') {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    state.balances[id] = DEFAULT_ARTIST_SATS + (h % 90_000)
  }
}

export type ChargePlayResult = {
  ok: true
  charged: boolean
  reason: 'sent' | 'owned' | 'off' | 'no-balance'
  sats: number
}

export class DemoWallet {
  private state: WalletState
  private listeners = new Set<() => void>()

  constructor() {
    this.state = load()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    save(this.state)
    for (const fn of this.listeners) fn()
  }

  get userSats(): number {
    return Math.round(this.state.balances[USER_ID] ?? 0)
  }

  artistSats(artistId: string): number {
    const id = baseId(artistId)
    ensureArtist(this.state, id)
    return Math.round(this.state.balances[id] ?? 0)
  }

  /** Fan Energy actually sent (plays, zaps, albums, older tips). Ignores the seeded demo balance. */
  receivedSats(artistId: string): number {
    const id = baseId(artistId)
    let n = 0
    for (const tx of this.state.txs) {
      if (!ENERGY_KINDS.has(tx.kind)) continue
      if (baseId(tx.toId) !== id) continue
      n += Math.round(tx.amount)
    }
    return n
  }

  receivedMap(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const tx of this.state.txs) {
      if (!ENERGY_KINDS.has(tx.kind)) continue
      const id = baseId(tx.toId)
      out[id] = (out[id] ?? 0) + Math.round(tx.amount)
    }
    return out
  }

  playSetting(): PlayEnergySetting {
    const p = this.state.play ?? { enabled: true, sats: 1 }
    const sats = Math.max(1, Math.min(1_000_000, Math.round(p.sats) || 1))
    return { enabled: p.enabled !== false, sats }
  }

  setPlaySetting(next: Partial<PlayEnergySetting>): void {
    const cur = this.playSetting()
    this.state.play = {
      enabled: next.enabled ?? cur.enabled,
      sats: Math.max(1, Math.min(1_000_000, Math.round(next.sats ?? cur.sats) || 1)),
    }
    this.emit()
  }

  ownsAlbum(artistId: string, albumKey: string): boolean {
    const list = this.state.owned?.[baseId(artistId)] ?? []
    return list.includes(albumKey)
  }

  recentTxs(limit = 12): WalletTx[] {
    return this.state.txs.slice(0, limit)
  }

  fundSats(sats: number): { ok: true } | { ok: false; error: string } {
    const n = Math.round(sats)
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    if (n > 1_000_000_000) return { ok: false, error: 'Simulated top-up max is 1,000,000,000 sats of Energy' }
    this.state.balances[USER_ID] = this.userSats + n
    this.pushTx({
      kind: 'fund',
      fromId: 'faucet',
      toId: USER_ID,
      amount: n,
      note: 'Simulated Energy top-up',
    })
    this.emit()
    return { ok: true }
  }

  /**
   * Per-play Energy. Owned albums are not charged.
   * Disabled in settings, or not enough Energy, does not debit.
   */
  chargePlay(artistId: string, artistName: string, albumKey: string): ChargePlayResult {
    if (this.ownsAlbum(artistId, albumKey)) {
      return { ok: true, charged: false, reason: 'owned', sats: 0 }
    }
    const setting = this.playSetting()
    if (!setting.enabled) {
      return { ok: true, charged: false, reason: 'off', sats: setting.sats }
    }
    if (this.userSats < setting.sats) {
      return { ok: true, charged: false, reason: 'no-balance', sats: setting.sats }
    }
    const sent = this.debit(artistId, artistName, setting.sats, 'play', `Play → ${artistName}`)
    if (!sent.ok) return { ok: true, charged: false, reason: 'no-balance', sats: setting.sats }
    return { ok: true, charged: true, reason: 'sent', sats: setting.sats }
  }

  /** Explicit zap. Caller must confirm in the UI before calling. */
  zap(artistId: string, artistName: string, sats: number): { ok: true; sats: number } | { ok: false; error: string } {
    const n = Math.round(sats)
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'Enter at least 1 sat of Energy' }
    return this.debit(artistId, artistName, n, 'zap', `Zap → ${artistName}`)
  }

  /**
   * Simulated album purchase. Caller must confirm in the UI first.
   * Price is recomputed so the client cannot name a different amount.
   */
  buyAlbum(
    artistId: string,
    artistName: string,
    albumKey: string,
    tracks: { album?: string }[],
  ): { ok: true; sats: number; name: string } | { ok: false; error: string } {
    const id = baseId(artistId)
    if (this.ownsAlbum(id, albumKey)) return { ok: false, error: 'You already own this album' }
    const offer = albumsFor(id, tracks).find((a) => a.key === albumKey)
    if (!offer) return { ok: false, error: 'Album not found' }
    const sent = this.debit(id, artistName, offer.priceSats, 'album', `Album “${offer.name}” → ${artistName}`, true)
    if (!sent.ok) return sent
    const owned = this.state.owned ?? {}
    const list = owned[id] ? [...owned[id]] : []
    list.push(offer.key)
    owned[id] = list
    this.state.owned = owned
    this.emit()
    return { ok: true, sats: offer.priceSats, name: offer.name }
  }

  trackAlbum(artistId: string, track: { album?: string }, tracks: { album?: string }[]) {
    return albumForTrack(artistId, track, tracks)
  }

  txsToArtist(artistId: string, limit = 5): WalletTx[] {
    const id = baseId(artistId)
    return this.state.txs.filter((t) => t.kind !== 'fund' && baseId(t.toId) === id).slice(0, limit)
  }

  allTxs(): WalletTx[] {
    return [...this.state.txs].sort((a, b) => b.at - a.at)
  }

  private debit(
    artistId: string,
    _artistName: string,
    sats: number,
    kind: 'play' | 'zap' | 'album',
    note: string,
    silent = false,
  ): { ok: true; sats: number } | { ok: false; error: string } {
    const n = Math.round(sats)
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Enter a positive amount of Energy' }
    const bal = this.userSats
    if (n > bal) return { ok: false, error: 'Not enough Energy' }
    const id = baseId(artistId)
    ensureArtist(this.state, id)
    this.state.balances[USER_ID] = bal - n
    this.state.balances[id] = (this.state.balances[id] ?? 0) + n
    this.pushTx({ kind, fromId: USER_ID, toId: id, amount: n, note })
    if (!silent) this.emit()
    return { ok: true, sats: n }
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

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24); return `${d} d ago`
}

export { energyPhrase }
