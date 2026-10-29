import { mountSlideConfirm } from './slideConfirm.ts'
import { formatEnergy, formatEnergyText, wallet, ZAP_PRESETS, type SendResult } from './wallet.ts'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Preset + custom Energy zap. Sends only after the slide control — demo funds,
 * never a silent transfer.
 */
export function mountEnergyZap(
  host: HTMLElement,
  opts: {
    artistName: string
    onConfirm: (sats: number) => SendResult
  },
): void {
  let selected: number | null = 100
  let sending = false

  const readCustom = (): number => {
    const input = host.querySelector<HTMLInputElement>('#zap-custom')
    return Math.round(Number(input?.value))
  }

  const chosenSats = (): number => {
    if (selected != null) return selected
    return readCustom()
  }

  const paint = (error = ''): void => {
    const sats = chosenSats()
    const valid = Number.isFinite(sats) && sats >= 1
    const label = valid ? `Slide to send ${formatEnergyText(sats)}` : 'Enter an amount'
    host.innerHTML = `
      <p class="send-hint">Your Energy: <span id="zap-user-bal">${formatEnergy(wallet.userSats)}</span></p>
      <div class="zap-presets" role="group" aria-label="Zap amounts">
        ${ZAP_PRESETS.map((n) => `<button type="button" class="zap-preset${selected === n ? ' on' : ''}" data-sats="${n}">${formatEnergyText(n)}</button>`).join('')}
      </div>
      <label class="zap-custom-label" for="zap-custom">Custom amount</label>
      <input id="zap-custom" type="number" inputmode="numeric" min="1" step="1" placeholder="Sats of Energy" aria-label="Custom Energy amount in sats" value="${selected == null ? '' : ''}" />
      <div id="zap-slide"></div>
      <p class="send-status${error ? ' err' : ''}" id="zap-status" role="status">${escapeHtml(error)}</p>
      <p class="demo-note">Demo only. Sliding confirms a simulated send from your connected demo wallet. No real funds move.</p>`
    host.querySelectorAll<HTMLButtonElement>('.zap-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        selected = Number(btn.dataset.sats)
        const input = host.querySelector<HTMLInputElement>('#zap-custom')
        if (input) input.value = ''
        paint()
      })
    })
    const custom = host.querySelector<HTMLInputElement>('#zap-custom')
    custom?.addEventListener('input', () => {
      const n = Math.round(Number(custom.value))
      selected = Number.isFinite(n) && n >= 1 ? null : selected
      host.querySelectorAll('.zap-preset').forEach((el) => el.classList.remove('on'))
      const slideLabel = host.querySelector('.slide-label')
      if (slideLabel && Number.isFinite(n) && n >= 1) slideLabel.textContent = `Slide to send ${formatEnergyText(n)} →`
    })
    mountSlideConfirm(host.querySelector<HTMLElement>('#zap-slide')!, () => {
      if (sending) return
      const amount = chosenSats()
      if (!Number.isFinite(amount) || amount < 1) {
        paint('Enter at least 1 sat of Energy')
        return
      }
      sending = true
      const result = opts.onConfirm(amount)
      if (result.ok) {
        host.innerHTML = `
          <div class="send-receipt" role="status">
            <span class="receipt-bolt">⚡</span>
            <div><strong>${formatEnergy(amount)}</strong><small>sent to ${escapeHtml(opts.artistName)} (demo)</small></div>
          </div>`
      } else {
        sending = false
        paint(result.error)
      }
    }, label, true)
  }

  paint()
}
