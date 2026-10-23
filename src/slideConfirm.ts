/** Hold-and-slide-to-confirm control. Calls onConfirm once the thumb passes the threshold. */
export function mountSlideConfirm(host: HTMLElement, onConfirm: () => void, label = 'Slide to send'): void {
  host.innerHTML = `
    <div class="slide-confirm" role="slider" tabindex="0" aria-label="${label}. Hold Enter or press Right Arrow repeatedly to confirm"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="slide-fill"></div>
      <span class="slide-label">${label} →</span>
      <div class="slide-thumb" aria-hidden="true">⚡</div>
    </div>`
  const track = host.querySelector<HTMLElement>('.slide-confirm')!
  const thumb = host.querySelector<HTMLElement>('.slide-thumb')!
  const fill = host.querySelector<HTMLElement>('.slide-fill')!
  const THRESH = 0.85
  let dragging = false, startX = 0, startOff = 0, off = 0, done = false
  const max = () => Math.max(1, track.clientWidth - thumb.offsetWidth - 8)
  const set = (px: number, anim = false) => {
    off = Math.min(max(), Math.max(0, px))
    thumb.style.transition = fill.style.transition = anim ? 'transform .3s cubic-bezier(.3,1.4,.5,1), width .3s' : 'none'
    thumb.style.transform = `translateX(${off}px)`
    fill.style.width = `${off + thumb.offsetWidth / 2 + 4}px`
    const p = off / max()
    track.setAttribute('aria-valuenow', String(Math.round(p * 100)))
    track.style.setProperty('--p', String(p))
  }
  const complete = () => {
    if (done) return
    done = true
    set(max(), true)
    track.classList.add('confirmed')
    try { navigator.vibrate?.([30, 40, 60]) } catch { /* ignore */ }
    onConfirm()
    setTimeout(() => { done = false; track.classList.remove('confirmed'); set(0, true) }, 1400)
  }
  const release = () => {
    if (!dragging) return
    dragging = false
    track.classList.remove('dragging')
    if (off / max() >= THRESH) complete()
    else set(0, true)
  }
  thumb.addEventListener('pointerdown', (e) => {
    if (done) return
    dragging = true; startX = e.clientX; startOff = off
    track.classList.add('dragging')
    thumb.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  })
  thumb.addEventListener('pointermove', (e) => { if (dragging) set(startOff + e.clientX - startX) })
  thumb.addEventListener('pointerup', release)
  thumb.addEventListener('pointercancel', release)
  thumb.addEventListener('lostpointercapture', release)
  // keyboard: hold Enter/Space to fill, or arrows to step
  let holdTimer = 0
  track.addEventListener('keydown', (e) => {
    if (done) return
    if (e.key === 'ArrowRight') { set(off + max() * 0.2); if (off / max() >= THRESH) complete(); e.preventDefault() }
    else if (e.key === 'ArrowLeft') { set(off - max() * 0.2); e.preventDefault() }
    else if ((e.key === 'Enter' || e.key === ' ') && !holdTimer) {
      e.preventDefault()
      holdTimer = window.setInterval(() => { set(off + max() * 0.06); if (off / max() >= THRESH) { clearInterval(holdTimer); holdTimer = 0; complete() } }, 30)
    }
  })
  track.addEventListener('keyup', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && holdTimer) { clearInterval(holdTimer); holdTimer = 0; if (!done) set(0, true) }
  })
}
