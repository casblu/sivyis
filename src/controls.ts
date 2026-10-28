import * as THREE from 'three'
import { GENRE_BALL_RADIUS, OVERVIEW_ORBIT_RADIUS } from './genreBall.ts'

const LOOK_SENS = 0.0022
const TOUCH_LOOK = 0.0036
const TOUCH_PAN = 0.045
const PINCH_ZOOM = 0.085
const ACCEL = 38
const DAMP = 4.2
const BASE_SPEED = 26
const BOOST_SPEED = 58
const PITCH_MAX = Math.PI / 2 - 0.08
const LOOK_INERTIA = 0.92
const LOOK_INERTIA_STOP = 0.0004
const ZOOM_MIN_ORIGIN = 1.2
const ZOOM_MAX_ORIGIN = 320
const DOLLY_NEAR_STAR = 7
const TAP_MOVE_PX = 12
const TAP_MAX_MS = 650
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_PX = 36

/** Overview home: gentle orbit of the whole galaxy */
const OVERVIEW_RADIUS = OVERVIEW_ORBIT_RADIUS
const OVERVIEW_HEIGHT = 28
const OVERVIEW_PITCH = -0.18
const OVERVIEW_AUTO_YAW = 0.085
const OVERVIEW_RETURN_MS = 2800

export type NavMode = 'overview' | 'fly'

export type TapResult = {
  kind: 'tap' | 'doubletap'
  x: number
  y: number
  pointerType?: string
}

type FlightKind = 'zoom' | 'flyto' | 'lookat' | 'overview'

type Flight = {
  kind: FlightKind
  duration: number
  t: number
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  ctrlA: THREE.Vector3
  ctrlB: THREE.Vector3
  yawFrom: number
  yawTo: number
  pitchFrom: number
  pitchTo: number
  lookPivot: number
  onDone: (() => void) | null
}

/**
 * Google Earth–style mobile navigation (phone-first):
 * - 1-finger drag  → orbit/look (yaw+pitch) with inertia — INVERTED as shipped
 * - Pinch          → zoom (dolly toward/away), clamped
 * - 2-finger drag  → lateral pan in the view plane (Earth-like “slide”)
 * Plus Overview (auto-orbit) ↔ Fly modes with Look At / Fly To search jumps.
 */
export class FlyControls {
  camera: THREE.PerspectiveCamera
  private dom: HTMLElement

  yaw = 0
  pitch = -0.12
  speedScale = 1
  enabled = false
  pointerLocked = false
  thrusting = false
  isTouch = false
  navMode: NavMode = 'overview'

  onTap: ((result: TapResult) => void) | null = null
  onGesture: (() => void) | null = null
  onModeChange: ((mode: NavMode) => void) | null = null

  private keys = new Set<string>()
  private velocity = new THREE.Vector3()
  private forward = new THREE.Vector3()
  private right = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)
  private lookDirty = true
  private yawVel = 0
  private pitchVel = 0

  private pointers = new Map<number, { x: number; y: number }>()
  private mode: 'none' | 'orbit' | 'pinchpan' = 'none'
  private lastCentroid = { x: 0, y: 0 }
  private pinch0 = 0
  private gestureStarted = false

  private downX = 0
  private downY = 0
  private downAt = 0
  private moved = false
  // Smoothed input: raw gestures accumulate here and are eased in per frame (no snapping).
  private pendYaw = 0
  private pendPitch = 0
  private pendDolly = 0
  private wishTmp = new THREE.Vector3()
  private upTmp = new THREE.Vector3()
  private lastTapAt = 0
  private lastTapX = 0
  private lastTapY = 0

  private flight: Flight | null = null
  private overviewYaw = 0
  private overviewUserSpin = 0
  private tmpA = new THREE.Vector3()
  private tmpLook = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera
    this.dom = dom
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

    // Preserve scene camera pose (starts inside hollow genre ball looking outward).
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    this.yaw = euler.y
    this.pitch = euler.x
    this.overviewYaw = this.yaw
    this.applyLook()
    this.bind()
  }

  lock(): void {
    if (this.isTouch) return
    if (this.navMode !== 'fly') return
    this.dom.requestPointerLock()
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  get boost(): boolean {
    return this.keys.has('shift')
  }

  get isFlying(): boolean {
    return this.flight !== null
  }

  /** Enter free-fly exploration (Earth-style touch + WASD). */
  enterFly(opts?: { lock?: boolean }): void {
    if (this.navMode === 'fly' && !this.flight) {
      if (opts?.lock && !this.isTouch) this.lock()
      return
    }
    this.cancelFlight()
    this.navMode = 'fly'
    this.velocity.set(0, 0, 0)
    this.yawVel = 0
    this.pitchVel = 0
    this.syncYawPitchFromCamera()
    this.onModeChange?.('fly')
    if (opts?.lock && !this.isTouch) this.lock()
  }

  /** Instantly place camera at overview orbit (no flight). */
  snapToOverview(): void {
    this.cancelFlight()
    this.unlock()
    this.camera.position.copy(this.overviewPosition(this.overviewYaw + this.overviewUserSpin))
    this.camera.lookAt(0, 4, 0)
    this.navMode = 'overview'
    this.velocity.set(0, 0, 0)
    this.yawVel = 0
    this.pitchVel = 0
    this.syncYawPitchFromCamera()
    this.onModeChange?.('overview')
  }

  /** Smooth return to gentle auto-orbit overview of the whole galaxy. */
  returnToOverview(onDone?: () => void): void {
    this.unlock()
    const target = this.overviewPosition(this.overviewYaw + this.overviewUserSpin)
    const lookAt = new THREE.Vector3(0, 4, 0)
    this.startBezierFlight({
      kind: 'overview',
      toPos: target,
      lookAt,
      duration: OVERVIEW_RETURN_MS / 1000,
      lookPivot: 0.92,
      onDone: () => {
        this.navMode = 'overview'
        this.velocity.set(0, 0, 0)
        this.yawVel = 0
        this.pitchVel = 0
        this.syncYawPitchFromCamera()
        this.onModeChange?.('overview')
        onDone?.()
      },
    })
  }

  /** Ease camera orientation to face an artist (stays roughly in place). */
  lookAtArtist(target: THREE.Vector3, onDone?: () => void): void {
    if (this.navMode === 'overview') this.enterFly()
    const from = this.camera.position.clone()
    const dir = this.tmpLook.subVectors(target, from)
    if (dir.lengthSq() < 1e-6) {
      onDone?.()
      return
    }
    dir.normalize()
    const yawTo = Math.atan2(-dir.x, -dir.z)
    const pitchTo = Math.max(
      -PITCH_MAX,
      Math.min(PITCH_MAX, Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))),
    )
    this.startBezierFlight({
      kind: 'lookat',
      toPos: from,
      lookAt: target.clone(),
      duration: 1.15,
      lookPivot: 0.96,
      yawTo,
      pitchTo,
      onDone: onDone ?? null,
    })
  }

  /**
   * Smooth cubic/bezier path toward an artist (~1.5–3.5s by distance),
   * ending ~DOLLY_NEAR_STAR away and facing the star.
   */
  flyToArtist(target: THREE.Vector3, onDone?: () => void): void {
    if (this.navMode === 'overview') {
      this.navMode = 'fly'
      this.onModeChange?.('fly')
    }
    const from = this.camera.position.clone()
    const dir = new THREE.Vector3().subVectors(from, target)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.25, 1)
    dir.normalize()
    const toPos = target.clone().addScaledVector(dir, DOLLY_NEAR_STAR)
    const dist = toPos.length()
    if (dist < ZOOM_MIN_ORIGIN && dist > 1e-6) {
      /* allow near-origin approaches inside the hollow ball */
    } else if (dist > ZOOM_MAX_ORIGIN) toPos.setLength(ZOOM_MAX_ORIGIN)

    const distance = from.distanceTo(toPos)
    const duration = THREE.MathUtils.clamp(1.5 + 2.0 * (distance / 200), 1.5, 3.5)

    // Outward control points so the arc feels like a galactic swoop
    const mid = new THREE.Vector3().addVectors(from, toPos).multiplyScalar(0.5)
    const outward = mid.clone().normalize()
    const lift = Math.min(42, distance * 0.22)
    const ctrlA = from.clone().lerp(mid, 0.35).addScaledVector(outward, lift * 0.55)
    ctrlA.y += lift * 0.35
    const ctrlB = toPos.clone().lerp(mid, 0.35).addScaledVector(outward, lift * 0.4)
    ctrlB.y += lift * 0.2

    this.startBezierFlight({
      kind: 'flyto',
      toPos,
      lookAt: target.clone(),
      duration,
      lookPivot: 0.94,
      ctrlA,
      ctrlB,
      onDone: onDone ?? null,
    })
  }

  /** Smooth fly/zoom toward a world point (double-tap). Stops ~DOLLY_NEAR_STAR away. */
  zoomToward(target: THREE.Vector3): void {
    if (this.navMode === 'overview') {
      this.navMode = 'fly'
      this.onModeChange?.('fly')
    }
    const dir = new THREE.Vector3().subVectors(this.camera.position, target)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.2, 1)
    dir.normalize()
    const toPos = target.clone().addScaledVector(dir, DOLLY_NEAR_STAR)
    const dist = toPos.length()
    if (dist > ZOOM_MAX_ORIGIN) toPos.setLength(ZOOM_MAX_ORIGIN)

    this.startBezierFlight({
      kind: 'zoom',
      toPos,
      lookAt: target.clone(),
      duration: 0.85,
      lookPivot: 0.9,
      onDone: null,
    })
  }

  update(dt: number): void {
    if (!this.enabled) return

    if (this.flight) {
      this.pendYaw = this.pendPitch = this.pendDolly = 0
      this.updateFlight(dt)
      return
    }
    this.applySmoothedInput(dt)

    if (this.navMode === 'overview') {
      this.updateOverview(dt)
      return
    }

    // Look inertia (Earth-style momentum after one-finger drag)
    if (this.mode !== 'orbit' && (Math.abs(this.yawVel) > LOOK_INERTIA_STOP || Math.abs(this.pitchVel) > LOOK_INERTIA_STOP)) {
      const k = Math.min(3, dt * 60)
      this.yaw += this.yawVel * k
      this.pitch += this.pitchVel * k
      const decay = Math.pow(LOOK_INERTIA, k)
      this.yawVel *= decay
      this.pitchVel *= decay
      this.lookDirty = true
    } else if (this.mode !== 'orbit') {
      this.yawVel = 0
      this.pitchVel = 0
    }

    if (this.lookDirty) this.applyLook()

    this.camera.getWorldDirection(this.forward)
    this.right.crossVectors(this.forward, this.up).normalize()

    const max = (this.boost ? BOOST_SPEED : BASE_SPEED) * this.speedScale
    const wish = this.wishTmp.set(0, 0, 0)

    if (this.keys.has('w') || this.keys.has('arrowup') || this.thrusting) {
      wish.add(this.forward)
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      wish.sub(this.forward)
    }

    if (this.keys.has('a')) wish.sub(this.right)
    if (this.keys.has('d')) wish.add(this.right)
    if (this.keys.has('e') || this.keys.has(' ')) wish.y += 1
    if (this.keys.has('q') || this.keys.has('control')) wish.y -= 1

    if (this.keys.has('arrowleft')) {
      this.yaw -= 1.1 * dt
      this.lookDirty = true
    }
    if (this.keys.has('arrowright')) {
      this.yaw += 1.1 * dt
      this.lookDirty = true
    }

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(max)
      this.velocity.lerp(wish, 1 - Math.exp(-ACCEL * 0.12 * dt))
    } else {
      this.velocity.multiplyScalar(Math.exp(-DAMP * dt))
    }

    this.camera.position.addScaledVector(this.velocity, dt)
    this.clampOriginDistance()
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    this.dom.removeEventListener('mousemove', this.onMouseMove)
    this.dom.removeEventListener('wheel', this.onWheel)
    this.dom.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    window.removeEventListener('pointermove', this.onPointerMove)
  }


  private overviewPosition(yaw: number): THREE.Vector3 {
    return new THREE.Vector3(
      Math.sin(yaw) * OVERVIEW_RADIUS,
      OVERVIEW_HEIGHT,
      Math.cos(yaw) * OVERVIEW_RADIUS,
    )
  }

  private updateOverview(dt: number): void {
    // Manual one-finger drag steers the orbit; otherwise gentle auto-spin
    if (this.mode === 'orbit' && this.moved) {
      // yaw/pitch already updated in pointer move — re-project on sphere
      this.overviewUserSpin = this.yaw - this.overviewYaw
    } else {
      this.overviewYaw += OVERVIEW_AUTO_YAW * dt
      this.yaw = this.overviewYaw + this.overviewUserSpin
      this.pitch = THREE.MathUtils.lerp(this.pitch, OVERVIEW_PITCH, 1 - Math.exp(-2.5 * dt))
    }

    const yaw = this.overviewYaw + this.overviewUserSpin
    const pos = this.overviewPosition(yaw)
    // Keep slight pitch by lifting look target
    const lookY = 4 + Math.sin(this.pitch + 0.18) * 18
    this.camera.position.lerp(pos, 1 - Math.exp(-6 * dt))
    this.tmpLook.set(0, lookY, 0)
    this.camera.lookAt(this.tmpLook)
    this.syncYawPitchFromCamera()
  }

  private startBezierFlight(opts: {
    kind: FlightKind
    toPos: THREE.Vector3
    lookAt: THREE.Vector3
    duration: number
    lookPivot: number
    ctrlA?: THREE.Vector3
    ctrlB?: THREE.Vector3
    yawTo?: number
    pitchTo?: number
    onDone: (() => void) | null
  }): void {
    const fromPos = this.camera.position.clone()
    const toPos = opts.toPos.clone()
    let ctrlA = opts.ctrlA?.clone()
    let ctrlB = opts.ctrlB?.clone()
    if (!ctrlA || !ctrlB) {
      const mid = fromPos.clone().lerp(toPos, 0.5)
      ctrlA = fromPos.clone().lerp(mid, 0.5)
      ctrlB = toPos.clone().lerp(mid, 0.5)
    }

    const lookDir = new THREE.Vector3().subVectors(opts.lookAt, toPos)
    if (lookDir.lengthSq() < 1e-6) lookDir.set(0, 0, -1)
    lookDir.normalize()
    const yawTo =
      opts.yawTo ??
      Math.atan2(-lookDir.x, -lookDir.z)
    const pitchTo =
      opts.pitchTo ??
      Math.max(-PITCH_MAX, Math.min(PITCH_MAX, Math.asin(THREE.MathUtils.clamp(lookDir.y, -1, 1))))

    this.flight = {
      kind: opts.kind,
      duration: Math.max(0.2, opts.duration),
      t: 0,
      fromPos,
      toPos,
      ctrlA,
      ctrlB,
      yawFrom: this.yaw,
      yawTo: shortestYaw(this.yaw, yawTo),
      pitchFrom: this.pitch,
      pitchTo,
      lookPivot: opts.lookPivot,
      onDone: opts.onDone,
    }
    this.yawVel = 0
    this.pitchVel = 0
    this.velocity.set(0, 0, 0)
    this.markGesture()
  }

  private updateFlight(dt: number): void {
    const f = this.flight
    if (!f) return
    f.t += dt / f.duration
    const u = Math.min(1, f.t)
    const e = easeInOutCubic(u)

    // Cubic Bézier position
    const pos = cubicBezier(f.fromPos, f.ctrlA, f.ctrlB, f.toPos, e, this.tmpA)
    this.camera.position.copy(pos)

    // Exponential look pivot toward target orientation
    const pivot = 1 - Math.pow(1 - f.lookPivot, dt * 60)
    this.yaw = THREE.MathUtils.lerp(this.yaw, f.yawTo, Math.max(e * 0.35, pivot * e))
    this.pitch = THREE.MathUtils.lerp(this.pitch, f.pitchTo, Math.max(e * 0.35, pivot * e))
    // Also blend absolute from→to for stable end pose
    this.yaw = THREE.MathUtils.lerp(f.yawFrom, f.yawTo, e)
    this.pitch = THREE.MathUtils.lerp(f.pitchFrom, f.pitchTo, e)
    this.lookDirty = true
    this.applyLook()

    if (u >= 1) {
      const done = f.onDone
      this.flight = null
      if (f.kind === 'overview') {
        this.overviewYaw = this.yaw
        this.overviewUserSpin = 0
      }
      done?.()
    }
  }

  private cancelFlight(): void {
    this.flight = null
  }

  private syncYawPitchFromCamera(): void {
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ')
    this.yaw = euler.y
    this.pitch = euler.x
    this.lookDirty = false
  }

  private applyLook(): void {
    this.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch))
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
    this.lookDirty = false
  }

  private clampOriginDistance(): void {
    const len = this.camera.position.length()
    // Allow camera near/at hollow origin (inside genre ball); only soft-floor when somehow below min.
    const insideShell = len < GENRE_BALL_RADIUS * 0.35
    const minZoom = insideShell ? 0.35 : ZOOM_MIN_ORIGIN
    if (len < minZoom && len > 1e-6) this.camera.position.setLength(minZoom)
    else if (len > ZOOM_MAX_ORIGIN) this.camera.position.setLength(ZOOM_MAX_ORIGIN)
  }

  private markGesture(): void {
    if (this.gestureStarted) return
    this.gestureStarted = true
    this.onGesture?.()
  }

  private bind(): void {
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
    this.dom.addEventListener('mousemove', this.onMouseMove)
    this.dom.addEventListener('wheel', this.onWheel, { passive: false })
    this.dom.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('pointermove', this.onPointerMove)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') e.preventDefault()
    // Typing in search — ignore movement keys
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    this.keys.add(e.key.toLowerCase())
    if (e.key === 'Shift') this.keys.add('shift')
    if (e.key === 'Control') this.keys.add('control')
    // WASD in overview starts fly
    if (this.navMode === 'overview' && this.enabled) {
      const k = e.key.toLowerCase()
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') {
        this.enterFly({ lock: !this.isTouch })
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
    if (e.key === 'Shift') this.keys.delete('shift')
    if (e.key === 'Control') this.keys.delete('control')
  }

  private onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.dom
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return
    if (!this.pointerLocked) return
    if (this.navMode !== 'fly') return
    // Desktop mouse look: reversed per Txai (Oct 2026)
    this.pendYaw -= e.movementX * LOOK_SENS
    this.pendPitch -= e.movementY * LOOK_SENS
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (!this.enabled) return
    if (this.navMode === 'overview') {
      // Scroll zooms overview radius feel via entering slight dolly then stay overview
      const delta = -(e.deltaY > 0 ? 1 : -1) * Math.min(8, Math.abs(e.deltaY) * 0.04)
      this.camera.getWorldDirection(this.forward)
      this.camera.position.addScaledVector(this.forward, delta * 0.6)
      this.clampOriginDistance()
      return
    }
    if (this.isTouch || !this.pointerLocked) {
      this.dolly(-(e.deltaY > 0 ? 1 : -1) * Math.min(8, Math.abs(e.deltaY) * 0.04))
      return
    }
    const next = this.speedScale * (e.deltaY > 0 ? 0.9 : 1.1)
    this.speedScale = Math.max(0.35, Math.min(2.4, next))
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = e.target as HTMLElement | null
    if (t && t !== this.dom && !this.dom.contains(t)) return

    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointerLocked) return

    if (this.pointers.size === 1) {
      this.mode = 'orbit'
      this.downX = e.clientX
      this.downY = e.clientY
      this.downAt = performance.now()
      this.moved = false
      this.yawVel = 0
      this.pitchVel = 0
      this.lastCentroid.x = e.clientX
      this.lastCentroid.y = e.clientY
      try {
        this.dom.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    } else if (this.pointers.size === 2) {
      if (this.navMode === 'overview') this.enterFly()
      this.mode = 'pinchpan'
      this.moved = true
      this.pinch0 = this.pinchDistance()
      const c = this.centroid()
      this.lastCentroid.x = c.x
      this.lastCentroid.y = c.y
      this.markGesture()
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    const had = this.pointers.has(e.pointerId)
    this.pointers.delete(e.pointerId)
    if (!had) return

    if (this.pointers.size === 0) {
      const elapsed = performance.now() - this.downAt
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
      const wasTap = this.mode === 'orbit' && !this.moved && elapsed < TAP_MAX_MS && dist < TAP_MOVE_PX

      if (wasTap && this.enabled && !this.pointerLocked) {
        const now = performance.now()
        const nearPrev =
          now - this.lastTapAt < DOUBLE_TAP_MS &&
          Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY) < DOUBLE_TAP_PX
        if (nearPrev) {
          this.onTap?.({ kind: 'doubletap', x: e.clientX, y: e.clientY, pointerType: e.pointerType })
          this.lastTapAt = 0
        } else {
          this.onTap?.({ kind: 'tap', x: e.clientX, y: e.clientY, pointerType: e.pointerType })
          this.lastTapAt = now
          this.lastTapX = e.clientX
          this.lastTapY = e.clientY
        }
      }

      this.mode = 'none'
    } else if (this.pointers.size === 1) {
      this.mode = 'orbit'
      const p = [...this.pointers.values()][0]
      this.lastCentroid.x = p.x
      this.lastCentroid.y = p.y
      this.pinch0 = 0
    }

    if (this.pointers.size < 2) this.pinch0 = 0
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointerLocked || !this.enabled) return
    if (this.flight) return

    if (this.mode === 'pinchpan' && this.pointers.size >= 2) {
      const c = this.centroid()
      const dx = c.x - this.lastCentroid.x
      const dy = c.y - this.lastCentroid.y
      this.lastCentroid.x = c.x
      this.lastCentroid.y = c.y

      if (this.pinch0 > 0) {
        const d = this.pinchDistance()
        const delta = (d - this.pinch0) * PINCH_ZOOM
        this.dolly(delta)
        this.pinch0 = d
      }

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        this.camera.getWorldDirection(this.forward)
        this.right.crossVectors(this.forward, this.up).normalize()
        const localUp = this.upTmp.crossVectors(this.right, this.forward).normalize()
        this.camera.position.addScaledVector(this.right, -dx * TOUCH_PAN)
        this.camera.position.addScaledVector(localUp, dy * TOUCH_PAN)
        this.clampOriginDistance()
        this.markGesture()
      }
      return
    }

    if (this.mode !== 'orbit' || this.pointers.size !== 1) return

    const dx = e.clientX - this.lastCentroid.x
    const dy = e.clientY - this.lastCentroid.y
    this.lastCentroid.x = e.clientX
    this.lastCentroid.y = e.clientY

    if (!this.moved && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_MOVE_PX) {
      this.moved = true
      this.markGesture()
    }
    if (!this.moved) return

    // Mouse drag is reversed vs touch (per Txai, Oct 2026); touch unchanged.
    const inv = e.pointerType === 'mouse' ? -1 : 1
    const dYaw = dx * TOUCH_LOOK * inv
    const dPitch = dy * TOUCH_LOOK * inv
    this.pendYaw += dYaw
    this.pendPitch += dPitch
    this.yawVel = dYaw * 0.6
    this.pitchVel = dPitch * 0.6
  }

  /** Ease accumulated look/dolly input in with frame-rate-independent damping. */
  private applySmoothedInput(dt: number): void {
    const a = 1 - Math.exp(-16 * dt)
    if (Math.abs(this.pendYaw) > 1e-6 || Math.abs(this.pendPitch) > 1e-6) {
      const dy = this.pendYaw * a
      const dp = this.pendPitch * a
      this.yaw += dy
      this.pitch += dp
      this.pendYaw -= dy
      this.pendPitch -= dp
      this.lookDirty = true
      if (this.navMode === 'overview') this.overviewUserSpin = this.yaw - this.overviewYaw
    }
    if (Math.abs(this.pendDolly) > 1e-4) {
      const step = this.pendDolly * (1 - Math.exp(-10 * dt))
      this.pendDolly -= step
      this.dollyNow(step)
    }
  }

  private dolly(amount: number): void {
    this.pendDolly += amount
  }

  private dollyNow(amount: number): void {
    this.camera.getWorldDirection(this.forward)
    this.camera.position.addScaledVector(this.forward, amount)
    this.clampOriginDistance()
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  private centroid(): { x: number; y: number } {
    const pts = [...this.pointers.values()]
    if (pts.length === 0) return { x: 0, y: 0 }
    let x = 0
    let y = 0
    for (const p of pts) {
      x += p.x
      y += p.y
    }
    return { x: x / pts.length, y: y / pts.length }
  }
}

function easeInOutCubic(t: number): number {
  // Smootherstep (C2-continuous): zero velocity AND acceleration at both ends — no jolt.
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function shortestYaw(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return from + d
}

function cubicBezier(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  out.set(0, 0, 0)
  out.addScaledVector(p0, uuu)
  out.addScaledVector(p1, 3 * uu * t)
  out.addScaledVector(p2, 3 * u * tt)
  out.addScaledVector(p3, ttt)
  return out
}
