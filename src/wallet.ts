/** Demo Bitcoin wallet — localStorage only, no real chain. */

const STORAGE_KEY = 'sivyis-demo-wallet-v1'
const USER_ID = 'user'
const DEFAULT_USER_BTC = 0.042
const DEFAULT_ARTIST_BTC = 0.008

export type TxKind = 'fund' | 'send' | 'tip' | 'merch'

export type WalletTx = {
  id: string
  at: number
  kind: TxKind
  fromId: string
  toId: string
  amount: number
  note: string
}

export type WalletState = {
  balances: Record<string, number>
  txs: WalletTx[]
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WalletState
      if (parsed?.balances && typeof parsed.balances[USER_ID] === 'number') return parsed
    }
  } catch {
    /* ignore corrupt */
  }
  return { balances: { [USER_ID]: DEFAULT_USER_BTC }, txs: [] }
}

function save(state: WalletState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function ensureArtist(state: WalletState, artistId: string): void {
  if (typeof state.balances[artistId] !== 'number') {
    // Deterministic-ish demo starting balance from id hash
    let h = 0
    for (let i = 0; i < artistId.length; i++) h = (h * 31 + artistId.charCodeAt(i)) >>> 0
    state.balances[artistId] = DEFAULT_ARTIST_BTC + (h % 900) / 100_000
  }
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

  get userBalance(): number {
    return this.state.balances[USER_ID] ?? 0
  }

  artistBalance(artistId: string): number {
    ensureArtist(this.state, artistId)
    return this.state.balances[artistId] ?? 0
  }

  recentTxs(limit = 12): WalletTx[] {
    return this.state.txs.slice(0, limit)
  }

  fund(amount: number): { ok: true } | { ok: false; error: string } {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a positive amount' }
    if (amount > 10) return { ok: false, error: 'Demo fund max is 10 BTC' }
    this.state.balances[USER_ID] = (this.state.balances[USER_ID] ?? 0) + amount
    this.pushTx({
      kind: 'fund',
      fromId: 'faucet',
      toId: USER_ID,
      amount,
      note: 'Demo faucet fund',
    })
    this.emit()
    return { ok: true }
  }

  sendToArtist(
    artistId: string,
    artistName: string,
    amount: number,
    kind: 'tip' | 'merch' | 'send' = 'tip',
  ): { ok: true } | { ok: false; error: string } {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a positive amount' }
    const bal = this.userBalance
    if (amount > bal) return { ok: false, error: 'Insufficient demo balance' }
    ensureArtist(this.state, artistId)
    this.state.balances[USER_ID] = bal - amount
    this.state.balances[artistId] = (this.state.balances[artistId] ?? 0) + amount
    this.pushTx({
      kind,
      fromId: USER_ID,
      toId: artistId,
      amount,
      note: `${kind === 'merch' ? 'Merch' : kind === 'tip' ? 'Tip' : 'Payment'} → ${artistName}`,
    })
    this.emit()
    return { ok: true }
  }

  private pushTx( partial: Omit<WalletTx, 'id' | 'at'>): void {
    this.state.txs.unshift({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      ...partial,
    })
    if (this.state.txs.length > 80) this.state.txs.length = 80
  }
}

export const wallet = new DemoWallet()

export function formatBtc(n: number): string {
  return `${n.toFixed(6)} BTC`
}
