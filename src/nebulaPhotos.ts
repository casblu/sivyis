/**
 * Genre → NASA/ESA public-domain nebula photography.
 * Sources: images.nasa.gov (Hubble / Spitzer / JWST). Not copyrighted unless noted.
 * See public/nebulae/CREDITS.txt
 */
import type { GenreId } from './artists.ts'

export type NebulaPhoto = {
  src: string
  name: string
  nasaId: string
}

export const GENRE_NEBULA_PHOTO: Record<GenreId, NebulaPhoto> = {
  hiphop: {
    src: import.meta.env.BASE_URL + 'nebulae/bubble.jpg',
    name: 'Hubble Bubbles and Baby Stars',
    nasaId: 'GSFC_20171208_Archive_e002039',
  },
  pop: {
    src: import.meta.env.BASE_URL + 'nebulae/lagoon.jpg',
    name: 'Lagoon Nebula',
    nasaId: 'GSFC_20171208_Archive_e001955',
  },
  rock: {
    src: import.meta.env.BASE_URL + 'nebulae/orion.jpg',
    name: 'Chaos at the Heart of Orion',
    nasaId: 'PIA01322',
  },
  rnb: {
    src: import.meta.env.BASE_URL + 'nebulae/trifid.jpg',
    name: 'Trifid Nebula',
    nasaId: 'PIA07226',
  },
  electronic: {
    src: import.meta.env.BASE_URL + 'nebulae/helix.jpg',
    name: 'Helix Nebula',
    nasaId: 'PIA18164',
  },
  jazz: {
    src: import.meta.env.BASE_URL + 'nebulae/crab.jpg',
    name: 'Crab Nebula',
    nasaId: 'PIA03606',
  },
  latin: {
    src: import.meta.env.BASE_URL + 'nebulae/horsehead.jpg',
    name: 'Horsehead Nebula (Hubble)',
    nasaId: 'PIA16008',
  },
  country: {
    src: import.meta.env.BASE_URL + 'nebulae/carina.jpg',
    name: 'Carina Nebula landscape',
    nasaId: 'GSFC_20171208_Archive_e002076',
  },
  indie: {
    src: import.meta.env.BASE_URL + 'nebulae/mystic.jpg',
    name: 'Carina Mystic Mountain',
    nasaId: 'PIA15985',
  },
  metal: {
    src: import.meta.env.BASE_URL + 'nebulae/pillars.jpg',
    name: 'Pillars of Creation',
    nasaId: 'GSFC_20171208_Archive_e000842',
  },
}
