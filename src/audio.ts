import type { Artist, AudioPreset, Genre } from './artists.ts'
import { HEARING_RADIUS } from './artists.ts'
import type { PerspectiveCamera } from 'three'

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

type Nearby = {
  artist: Artist
  distance: number
}

type Voice = {
  id: string
  artist: Artist
  preset: AudioPreset
  bus: GainNode
  filter: BiquadFilterNode
  panner: PannerNode
  pad: OscillatorNode
  padFifth: OscillatorNode
  padGain: GainNode
  nextNote: number
  step: number
  flourishUntil: number
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

/** Prefer the nearest star; keep a faint second voice if another is close. */
const MAX_ACTIVE_VOICES = 2

export class ProximityAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambience: GainNode | null = null
  private ambienceFilter: BiquadFilterNode | null = null
  private ambienceHum: OscillatorNode | null = null
  private analyser: AnalyserNode | null = null
  private analyserData: Uint8Array | null = null
  private voices = new Map<string, Voice>()
  private started = false
  muted = false
  private flourishArtist: string | null = null
  /** Loudest currently playing artist id (for sticky label / pulse). */
  playingId: string | null = null
  /** 0–1 time-domain peak for visual pulse. */
  amplitude = 0

  get ready(): boolean {
    return this.started && this.ctx !== null
  }

  async start(): Promise<void> {
    if (this.started) {
      await this.ctx?.resume()
      return
    }
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.55

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    master.connect(analyser)
    analyser.connect(ctx.destination)

    const ambience = ctx.createGain()
    ambience.gain.value = 0.035
    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx)
    noise.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 280
    const hum = ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 55
    const humGain = ctx.createGain()
    humGain.gain.value = 0.15
    noise.connect(noiseFilter)
    noiseFilter.connect(ambience)
    hum.connect(humGain)
    humGain.connect(ambience)
    ambience.connect(master)
    noise.start()
    hum.start()

    this.ctx = ctx
    this.master = master
    this.ambience = ambience
    this.ambienceFilter = noiseFilter
    this.ambienceHum = hum
    this.analyser = analyser
    this.analyserData = new Uint8Array(analyser.fftSize)
    this.started = true
    await ctx.resume()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  /** Softly tint the ambient bed when deep inside a genre nebula. */
  setGenreAmbient(genre: Genre | null, depth: number): void {
    if (!this.ctx || !this.ambienceFilter || !this.ambienceHum) return
    const now = this.ctx.currentTime
    const t = Math.max(0, Math.min(1, depth))
    if (!genre || t < 0.05) {
      this.ambienceFilter.frequency.setTargetAtTime(280, now, 0.4)
      this.ambienceHum.frequency.setTargetAtTime(55, now, 0.4)
      return
    }
    const preset = genre.audio
    const humHz = midiToHz(preset.root - 24)
    const cutoff = 180 + t * (preset.cutoff * 0.12)
    this.ambienceFilter.frequency.setTargetAtTime(cutoff, now, 0.35)
    this.ambienceHum.frequency.setTargetAtTime(humHz, now, 0.35)
  }

  playTrackCue(artist: Artist, trackIndex: number): void {
    if (!this.ctx || !this.master) return
    this.flourishArtist = artist.id
    this.playingId = artist.id
    const voice = this.voices.get(artist.id)
    if (voice) {
      voice.step = trackIndex * 3
      voice.flourishUntil = this.ctx.currentTime + 2.4
    }
    this.sparkle(artist, trackIndex)
  }

  /**
   * Update proximity voices + spatial panners from camera pose.
   * Soft crossfade via setTargetAtTime; nearest star preferred.
   */
  update(nearby: Nearby[], camera: PerspectiveCamera, boost = false): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime

    this.updateListener(camera)

    const mute = this.muted ? 0 : 1
    this.master.gain.setTargetAtTime(0.55 * mute, now, 0.08)

    if (this.ambience) {
      this.ambience.gain.setTargetAtTime(this.muted ? 0.0 : 0.035, now, 0.12)
    }

    const ranked = nearby.slice(0, MAX_ACTIVE_VOICES)
    const wanted = new Map<string, { artist: Artist; vol: number }>()
    ranked.forEach((item, index) => {
      const t = 1 - Math.min(1, item.distance / HEARING_RADIUS)
      const base = t * t
      const prefer = index === 0 ? 1 : 0.28
      const vol = base * prefer
      if (vol > 0.02) wanted.set(item.artist.id, { artist: item.artist, vol })
    })

    this.playingId = ranked[0]?.artist.id ?? this.flourishArtist

    for (const [id, voice] of this.voices) {
      if (!wanted.has(id)) {
        voice.bus.gain.setTargetAtTime(0.0001, now, 0.28)
        if (voice.bus.gain.value < 0.008) {
          this.disposeVoice(voice)
          this.voices.delete(id)
        }
      }
    }

    const rolloff = boost ? 0.55 : 0.84

    for (const [id, item] of wanted) {
      let voice = this.voices.get(id)
      if (!voice) {
        voice = this.createVoice(item.artist)
        this.voices.set(id, voice)
      }
      voice.panner.rolloffFactor = rolloff
      this.setPannerPos(voice.panner, item.artist.position, now)
      const boostGain = this.flourishArtist === id ? 1.25 : 1
      voice.bus.gain.setTargetAtTime(Math.min(0.9, item.vol * boostGain), now, 0.14)
      this.schedule(voice, now)
    }

    this.sampleAmplitude()
  }

  stopAll(): void {
    for (const [id, voice] of this.voices) {
      this.disposeVoice(voice)
      this.voices.delete(id)
    }
  }

  private updateListener(camera: PerspectiveCamera): void {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    const listener = ctx.listener
    const p = camera.position
    const e = camera.matrixWorld.elements
    const fx = -e[8]
    const fy = -e[9]
    const fz = -e[10]
    const ux = e[4]
    const uy = e[5]
    const uz = e[6]

    if (listener.positionX) {
      listener.positionX.setValueAtTime(p.x, now)
      listener.positionY.setValueAtTime(p.y, now)
      listener.positionZ.setValueAtTime(p.z, now)
      listener.forwardX.setValueAtTime(fx, now)
      listener.forwardY.setValueAtTime(fy, now)
      listener.forwardZ.setValueAtTime(fz, now)
      listener.upX.setValueAtTime(ux, now)
      listener.upY.setValueAtTime(uy, now)
      listener.upZ.setValueAtTime(uz, now)
    } else {
      const legacy = listener as AudioListener & {
        setPosition?: (x: number, y: number, z: number) => void
        setOrientation?: (
          fx: number,
          fy: number,
          fz: number,
          ux: number,
          uy: number,
          uz: number,
        ) => void
      }
      legacy.setPosition?.(p.x, p.y, p.z)
      legacy.setOrientation?.(fx, fy, fz, ux, uy, uz)
    }
  }

  private setPannerPos(panner: PannerNode, pos: [number, number, number], now: number): void {
    if (panner.positionX) {
      panner.positionX.setValueAtTime(pos[0], now)
      panner.positionY.setValueAtTime(pos[1], now)
      panner.positionZ.setValueAtTime(pos[2], now)
    } else {
      const legacy = panner as PannerNode & {
        setPosition?: (x: number, y: number, z: number) => void
      }
      legacy.setPosition?.(pos[0], pos[1], pos[2])
    }
  }

  private sampleAmplitude(): void {
    if (!this.analyser || !this.analyserData) {
      this.amplitude = 0
      return
    }
    // Cast for TS lib variance between ArrayBuffer and ArrayBufferLike
    this.analyser.getByteTimeDomainData(this.analyserData as Uint8Array<ArrayBuffer>)
    let peak = 0
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = Math.abs(this.analyserData[i] - 128) / 128
      if (v > peak) peak = v
    }
    this.amplitude = this.amplitude * 0.7 + peak * 0.3
  }

  private sparkle(artist: Artist, trackIndex: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    const preset = artist.audio
    for (let i = 0; i < 8; i++) {
      const deg = preset.intervals[(trackIndex + i * 2) % preset.intervals.length]
      const t = now + i * 0.09
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = midiToHz(preset.root + 12 + deg)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
      osc.connect(g)
      g.connect(master)
      osc.start(t)
      osc.stop(t + 0.3)
    }
  }

  private createVoice(artist: Artist): Voice {
    const ctx = this.ctx!
    const master = this.master!
    const preset = artist.audio
    const detune = (artist.name.length % 5) - 2
    const rooted = { ...preset, root: preset.root + detune }

    const bus = ctx.createGain()
    bus.gain.value = 0.0001

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = rooted.cutoff
    filter.Q.value = 0.7

    const panner = ctx.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'linear'
    panner.refDistance = 1
    panner.maxDistance = HEARING_RADIUS * 1.4
    panner.rolloffFactor = 0.84
    panner.coneInnerAngle = 360
    panner.coneOuterAngle = 360

    const padGain = ctx.createGain()
    padGain.gain.value = rooted.padMix * 0.22

    const pad = ctx.createOscillator()
    pad.type = rooted.wave === 'square' ? 'sine' : 'sine'
    pad.frequency.value = midiToHz(rooted.root - 12)

    const padFifth = ctx.createOscillator()
    padFifth.type = 'sine'
    padFifth.frequency.value = midiToHz(rooted.root - 5)

    pad.connect(padGain)
    padFifth.connect(padGain)
    padGain.connect(filter)
    filter.connect(bus)
    bus.connect(panner)
    panner.connect(master)
    pad.start()
    padFifth.start()

    this.setPannerPos(panner, artist.position, ctx.currentTime)

    return {
      id: artist.id,
      artist,
      preset: rooted,
      bus,
      filter,
      panner,
      pad,
      padFifth,
      padGain,
      nextNote: ctx.currentTime + 0.05,
      step: 0,
      flourishUntil: 0,
    }
  }

  private schedule(voice: Voice, now: number): void {
    const horizon = now + 0.18
    const stepDur = 60 / voice.preset.tempo / 2
    while (voice.nextNote < horizon) {
      const degree = voice.preset.pattern[voice.step % voice.preset.pattern.length]
      if (degree >= 0) {
        this.trigger(voice, voice.nextNote, degree)
      }
      voice.nextNote += stepDur
      voice.step += 1
    }
  }

  private trigger(voice: Voice, time: number, degreeIndex: number): void {
    const ctx = this.ctx!
    const preset = voice.preset
    const interval = preset.intervals[degreeIndex % preset.intervals.length]
    const flourish = time < voice.flourishUntil
    const midi = preset.root + interval + (flourish ? 12 : 0)
    const osc = ctx.createOscillator()
    osc.type = preset.wave
    osc.frequency.value = midiToHz(midi)

    const g = ctx.createGain()
    const peak = flourish ? 0.22 : 0.14
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(peak, time + 0.018)
    const release = preset.wave === 'sine' ? 0.55 : 0.28
    g.gain.exponentialRampToValueAtTime(0.0001, time + release)

    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.setValueAtTime(preset.cutoff * 0.6, time)
    filt.frequency.exponentialRampToValueAtTime(preset.cutoff, time + 0.03)
    filt.frequency.exponentialRampToValueAtTime(preset.cutoff * 0.4, time + release)

    osc.connect(filt)
    filt.connect(g)
    g.connect(voice.bus)
    osc.start(time)
    osc.stop(time + release + 0.05)
  }

  private disposeVoice(voice: Voice): void {
    try {
      voice.pad.stop()
      voice.padFifth.stop()
    } catch {
      /* already stopped */
    }
    voice.pad.disconnect()
    voice.padFifth.disconnect()
    voice.padGain.disconnect()
    voice.filter.disconnect()
    voice.bus.disconnect()
    voice.panner.disconnect()
  }
}
