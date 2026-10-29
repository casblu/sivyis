/** Full-screen lightning overlay + glowing artist star ring. */
type Pt = [number, number]
interface Bolt { pts: Pt[]; branches: Pt[][]; born: number; life: number; w: number }

function jag(a: Pt, b: Pt, depth: number, disp: number, out: Pt[]): void {
  if (depth === 0) { out.push(b); return }
  const m: Pt = [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * disp, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * disp]
  jag(a, m, depth - 1, disp / 2, out); jag(m, b, depth - 1, disp / 2, out)
}
function makeBolt(W: number, H: number, cx: number, cy: number, R: number, now: number): Bolt {
  const side = Math.floor(Math.random() * 4)
  const t = Math.random()
  const a: Pt = side === 0 ? [t * W, -10] : side === 1 ? [W + 10, t * H] : side === 2 ? [t * W, H + 10] : [-10, t * H]
  const ang = Math.atan2(a[1] - cy, a[0] - cx) + (Math.random() - 0.5) * 0.6
  const b: Pt = [cx + Math.cos(ang) * R * (0.95 + Math.random() * 0.2), cy + Math.sin(ang) * R * (0.95 + Math.random() * 0.2)]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const pts: Pt[] = [a]; jag(a, b, 6, len * 0.28, pts)
  const branches: Pt[][] = []
  const nb = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < nb; i++) {
    const s = pts[4 + Math.floor(Math.random() * (pts.length - 8))]
    const ba = ang + Math.PI + (Math.random() - 0.5) * 1.6
    const bl = len * (0.12 + Math.random() * 0.2)
    const e: Pt = [s[0] + Math.cos(ba) * bl, s[1] + Math.sin(ba) * bl]
    const bp: Pt[] = [s]; jag(s, e, 4, bl * 0.35, bp); branches.push(bp)
  }
  return { pts, branches, born: now, life: 140 + Math.random() * 220, w: 1.5 + Math.random() * 2 }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/** Total zap length incl. the eased fade-out (ms). Profile fade-in is timed against this. */
export const ZAP_HOLD_MS = 1100
export const ZAP_FADE_MS = 800

export function playScreenZap(opts: { color?: number; name?: string } = {}): void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const HOLD = reduced ? 900 : ZAP_HOLD_MS
  const DUR = HOLD + ZAP_FADE_MS
  const col = opts.color ?? 0x9fd8ff
  const rgb = `${(col >> 16) & 255},${(col >> 8) & 255},${col & 255}`
  const cv = document.createElement('canvas')
  cv.className = 'screen-zap'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d', { alpha: true, desynchronized: true } as CanvasRenderingContext2DSettings)!
  // Sized ONCE (DPR capped at 1.5); fade-out is pure CSS opacity on the compositor.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const W = window.innerWidth, H = window.innerHeight
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.28
  const mobile = Math.min(W, H) < 600
  const MAXB = reduced ? 0 : mobile ? 8 : 16

  // Pre-render static layers once: vignette, and halo+ring sprite (no per-frame gradients / shadowBlur).
  const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, g] as const }
  const [vig, vg] = mk(W, H)
  const grad = vg.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H))
  grad.addColorStop(0, 'rgba(4,8,24,0.35)'); grad.addColorStop(1, 'rgba(0,0,10,0.75)')
  vg.fillStyle = grad; vg.fillRect(0, 0, W, H)
  const S = R * 3.2
  const [ring, rg] = mk(S, S)
  const rc = S / 2
  const halo = rg.createRadialGradient(rc, rc, R * 0.6, rc, rc, R * 1.5)
  halo.addColorStop(0, `rgba(${rgb},0)`); halo.addColorStop(0.4, `rgba(${rgb},0.35)`); halo.addColorStop(1, `rgba(${rgb},0)`)
  rg.fillStyle = halo; rg.fillRect(0, 0, S, S)
  for (const [lw, a] of [[18, 0.12], [10, 0.22], [4, 0.9]] as const) { rg.strokeStyle = `rgba(${rgb},${a})`; rg.lineWidth = lw; rg.beginPath(); rg.arc(rc, rc, R, 0, Math.PI * 2); rg.stroke() }
  rg.strokeStyle = 'rgba(255,255,255,0.75)'; rg.lineWidth = 1.5; rg.beginPath(); rg.arc(rc, rc, R, 0, Math.PI * 2); rg.stroke()
  if (opts.name) {
    rg.textAlign = 'center'; rg.textBaseline = 'middle'
    rg.fillStyle = 'rgba(255,255,255,0.92)'; rg.font = `600 ${Math.round(Math.max(16, R * 0.16))}px "Exo 2", sans-serif`; rg.fillText(opts.name, rc, rc)
    rg.fillStyle = `rgba(${rgb},0.9)`; rg.font = `500 ${Math.round(Math.max(11, R * 0.07))}px "Exo 2", sans-serif`; rg.fillText('ENERGY SENT', rc, rc + R * 0.18)
  }

  const t0 = performance.now()
  let bolts: Bolt[] = [], lastSpawn = 0
  const path = (p: Pt[]) => { ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]) }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const frame = (now: number) => {
    const el = now - t0
    if (el > DUR) { cv.remove(); return }
    // Compositor-only crossfade out (ease-out cubic) — runs alongside the profile fading back in.
    cv.style.opacity = el < HOLD ? '1' : String(1 - easeOutCubic((el - HOLD) / ZAP_FADE_MS))
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(vig, 0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    const grow = easeOutCubic(el / 260)
    const pulse = 0.8 + 0.2 * Math.sin(el / 70) * (reduced ? 0.3 : 1)
    const sc = 0.85 + 0.15 * grow
    ctx.globalAlpha = pulse * grow
    ctx.drawImage(ring, cx - (S * sc) / 2, cy - (S * sc) / 2, S * sc, S * sc)
    if (MAXB && el < HOLD && now - lastSpawn > (mobile ? 50 : 32)) {
      lastSpawn = now
      const n = el < 200 ? 3 : 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n && bolts.length < MAXB; i++) bolts.push(makeBolt(W, H, cx, cy, R * sc, now))
    }
    bolts = bolts.filter((b) => now - b.born < b.life)
    for (const b of bolts) {
      const a = 1 - (now - b.born) / b.life
      ctx.globalAlpha = a
      // fake glow with wide translucent strokes instead of shadowBlur
      ctx.strokeStyle = 'rgba(110,170,255,0.18)'; ctx.lineWidth = b.w * 7; ctx.beginPath(); path(b.pts); ctx.stroke()
      ctx.strokeStyle = 'rgba(140,195,255,0.45)'; ctx.lineWidth = b.w * 3; ctx.beginPath(); path(b.pts); ctx.stroke()
      ctx.strokeStyle = 'rgba(240,248,255,1)'; ctx.lineWidth = b.w; ctx.beginPath(); path(b.pts); ctx.stroke()
      ctx.lineWidth = b.w * 0.6; ctx.beginPath(); for (const br of b.branches) path(br); ctx.stroke()
    }
    ctx.globalAlpha = 1
    const flash = reduced ? Math.max(0, 0.18 - el / 1500) : Math.max(0, 0.5 - el / 320)
    if (flash > 0) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(200,225,255,${flash})`; ctx.fillRect(0, 0, W, H) }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
