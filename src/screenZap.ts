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

export function playScreenZap(opts: { color?: number; name?: string } = {}): void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const DUR = reduced ? 1400 : 1800
  const col = opts.color ?? 0x9fd8ff
  const rgb = `${(col >> 16) & 255},${(col >> 8) & 255},${col & 255}`
  const cv = document.createElement('canvas')
  cv.className = 'screen-zap'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')!
  let W = 0, H = 0
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth; H = window.innerHeight
    cv.width = W * dpr; cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize(); window.addEventListener('resize', resize)
  const mobile = Math.min(W, H) < 600
  const MAXB = reduced ? 0 : mobile ? 10 : 18
  const t0 = performance.now()
  let bolts: Bolt[] = [], lastSpawn = 0
  const strokePath = (p: Pt[]) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.stroke() }
  const frame = (now: number) => {
    const el = now - t0
    if (el > DUR) { window.removeEventListener('resize', resize); cv.remove(); return }
    const cx = W / 2, cy = H * 0.45, R = Math.min(W, H) * 0.28
    const fade = el < DUR - 450 ? 1 : Math.max(0, (DUR - el) / 450)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, W, H)
    // dark vignette backdrop
    const vg = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H))
    vg.addColorStop(0, `rgba(4,8,24,${0.35 * fade})`); vg.addColorStop(1, `rgba(0,0,10,${0.75 * fade})`)
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    // star ring
    const pulse = 0.75 + 0.25 * Math.sin(el / 70) * (reduced ? 0.3 : 1)
    const grow = Math.min(1, el / 260)
    const r = R * (0.85 + 0.15 * grow)
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.5)
    halo.addColorStop(0, `rgba(${rgb},0)`); halo.addColorStop(0.4, `rgba(${rgb},${0.35 * pulse * fade})`); halo.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = halo; ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2)
    ctx.shadowColor = `rgb(${rgb})`; ctx.shadowBlur = 30
    ctx.strokeStyle = `rgba(${rgb},${0.9 * pulse * fade * grow})`; ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * pulse * fade * grow})`; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    if (opts.name) {
      ctx.shadowBlur = 16; ctx.fillStyle = `rgba(255,255,255,${0.9 * fade * grow})`
      ctx.font = `600 ${Math.round(Math.max(16, R * 0.16))}px "Exo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(opts.name, cx, cy)
      ctx.font = `500 ${Math.round(Math.max(11, R * 0.07))}px "Exo 2", sans-serif`; ctx.fillStyle = `rgba(${rgb},${0.9 * fade * grow})`
      ctx.fillText('⚡ BTC SENT', cx, cy + R * 0.18)
    }
    // bolts
    if (MAXB && el < DUR - 350 && now - lastSpawn > (mobile ? 45 : 30)) {
      lastSpawn = now
      const n = el < 200 ? 4 : 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n && bolts.length < MAXB; i++) bolts.push(makeBolt(W, H, cx, cy, r, now))
    }
    bolts = bolts.filter((b) => now - b.born < b.life)
    for (const b of bolts) {
      const a = (1 - (now - b.born) / b.life) * fade * (Math.random() < 0.15 ? 0.3 : 1)
      ctx.shadowColor = '#7fc4ff'; ctx.shadowBlur = 18
      ctx.strokeStyle = `rgba(120,180,255,${0.5 * a})`; ctx.lineWidth = b.w * 4; strokePath(b.pts)
      ctx.strokeStyle = `rgba(235,245,255,${a})`; ctx.lineWidth = b.w; strokePath(b.pts)
      ctx.lineWidth = b.w * 0.6
      for (const br of b.branches) strokePath(br)
    }
    ctx.shadowBlur = 0
    // screen flash
    const flash = reduced ? Math.max(0, 0.18 - el / 1500) : Math.max(0, 0.55 - el / 300) + (Math.random() < 0.06 && el < DUR - 500 ? 0.18 : 0)
    if (flash > 0) { ctx.fillStyle = `rgba(200,225,255,${flash * fade})`; ctx.fillRect(0, 0, W, H) }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
