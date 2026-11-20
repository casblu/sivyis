/**
 * Genre → photographic nebula plate.
 * NASA / ESA / CSA / STScI public-domain imagery, plus one procedural plate.
 * See public/nebulae/CREDITS.txt
 */
import type { GenreId } from './artists.ts'

export type PlateMask = 'object' | 'field'

export type NebulaPhoto = {
  src: string
  name: string
  /** Catalog id, or "procedural" when the plate is generated in-repo. */
  nasaId: string
  credit: string
  /** World-space size of the plate's long side. */
  span: number
  /**
   * object: black space around a compact nebula (key it out).
   * field: gas and dark dust fill the frame (keep the silhouette, feather the border).
   */
  mask: PlateMask
  /** Luminance key for object plates. */
  keyLow: number
  keyHigh: number
  /** How strongly the close-up shader adds filament detail. */
  detail: number
  /**
   * Field-plate edge. ell scales distance from center; alpha falls from `from` to `to`.
   * Omitted plates use a tight cloud so a full-frame photo does not read as a card.
   */
  edge?: { ell: number; from: number; to: number }
  /** Mist colors around the plate (not a tint of the photograph). */
  mist: [number, number]
}

export const GENRE_NEBULA_PHOTO: Record<Exclude<GenreId, 'classical'>, NebulaPhoto> = {
  electronic: {
    src: './nebulae/ring.jpg',
    name: 'Ring Nebula (JWST NIRCam)',
    nasaId: 'weic2320b',
    credit: 'ESA/Webb, NASA, CSA, M. Barlow, N. Cox, R. Wesson',
    span: 58,
    mask: 'object',
    keyLow: 0.012,
    keyHigh: 0.07,
    detail: 0.42,
    mist: [0x3ee0d0, 0xff5a78],
  },
  pop: {
    src: './nebulae/butterfly.jpg',
    name: 'Butterfly Nebula',
    nasaId: 'heic0910h',
    credit: 'NASA, ESA, and the Hubble SM4 ERO Team',
    span: 60,
    mask: 'object',
    keyLow: 0.018,
    keyHigh: 0.085,
    detail: 0.4,
    mist: [0xff7ec8, 0x7af0ff],
  },
  metal: {
    src: './nebulae/horsehead.jpg',
    name: 'Horsehead Nebula',
    nasaId: 'heic0105a',
    credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
    span: 54,
    mask: 'field',
    keyLow: 0.02,
    keyHigh: 0.08,
    detail: 0.38,
    edge: { ell: 1.48, from: 0.26, to: 0.7 },
    mist: [0xff2a3a, 0x3aa0ff],
  },
  latin: {
    src: './nebulae/hourglass.jpg',
    name: 'Hourglass Nebula (MyCn 18)',
    nasaId: 'opo9607a',
    credit: 'R. Sahai, J. Trauger (JPL), WFPC2 Science Team, NASA/ESA',
    span: 62,
    mask: 'object',
    keyLow: 0.02,
    keyHigh: 0.09,
    detail: 0.72,
    mist: [0xff5a20, 0x3ee0ff],
  },
  rock: {
    src: './nebulae/jet.jpg',
    name: 'Emission curtain with a stellar jet',
    nasaId: 'procedural',
    credit: 'Procedural plate in the style of Hubble Herbig–Haro jets (not a copied photograph)',
    span: 46,
    mask: 'field',
    keyLow: 0.02,
    keyHigh: 0.08,
    detail: 0.8,
    mist: [0xff2438, 0x8fd8ff],
  },
  country: {
    src: './nebulae/mystic.jpg',
    name: 'Carina Mystic Mountain',
    nasaId: 'heic1007a',
    credit: 'NASA, ESA, and M. Livio and the Hubble 20th Anniversary Team (STScI)',
    span: 48,
    mask: 'field',
    keyLow: 0.02,
    keyHigh: 0.08,
    detail: 0.34,
    mist: [0xe8c080, 0x68b0ff],
  },
  jazz: {
    src: './nebulae/pillars.jpg',
    name: 'Pillars of Creation',
    nasaId: 'heic1501a',
    credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
    span: 50,
    mask: 'field',
    keyLow: 0.02,
    keyHigh: 0.08,
    detail: 0.34,
    mist: [0xff8a3a, 0x4aa8ff],
  },
  hiphop: {
    src: './nebulae/crab.jpg',
    name: 'Crab Nebula',
    nasaId: 'PIA03606',
    credit: 'NASA, ESA, J. Hester and A. Loll (Arizona State University)',
    span: 56,
    mask: 'object',
    keyLow: 0.016,
    keyHigh: 0.075,
    detail: 0.4,
    mist: [0x7dffc0, 0xffb060],
  },
  indie: {
    src: './nebulae/helix.jpg',
    name: 'Helix Nebula',
    nasaId: 'PIA18164',
    credit: 'NASA, ESA, C.R. O\'Dell (Vanderbilt University), M. Meixner and P. McCullough (STScI)',
    span: 58,
    mask: 'object',
    keyLow: 0.02,
    keyHigh: 0.09,
    detail: 0.45,
    mist: [0x7ec8ff, 0xffc060],
  },
  rnb: {
    src: './nebulae/orion.jpg',
    name: 'Orion Nebula',
    nasaId: 'PIA01322',
    credit: 'NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Space Telescope Orion Treasury Project Team',
    span: 46,
    mask: 'field',
    keyLow: 0.02,
    keyHigh: 0.08,
    detail: 0.36,
    mist: [0xff8844, 0x44e0c8],
  },
}
