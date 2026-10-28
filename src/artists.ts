import openCatalog from './openCatalog.json'
import { MEMORIALS, SUPERNOVA_REMNANTS, type Memorial } from './memorials.ts'
import {
  GENRE_BALL_RADIUS,
  GENRE_CLUSTER_RADIUS,
  SUBGENRE_ORBIT_MUL,
  SUBGENRE_CLUSTER_RADIUS,
  fibonacciSphere,
  pentagonOffsets,
  lerpHex,
  rgbaFromHex,
  nearestIndices,
} from './genreBall.ts'

export { GENRE_BALL_RADIUS, START_INSIDE_POS, START_LOOK_AT } from './genreBall.ts'

export type CatalogSource = 'rss' | 'nostr'

export type Track = {
  title: string
  duration: string
  /** Real playable audio (open catalog only) */
  audioUrl?: string
  source?: CatalogSource
  album?: string
  /** Only show when a real source provides lyrics — never invent them */
  lyrics?: string
}

export type ValueRecipient = {
  name: string
  type: string
  address: string
  split: number
  customKey?: string
  customValue?: string
  fee?: boolean
}

/** Pay targets only — Cosmoly does not move money here. */
export type PayInfo = {
  /** Podcasting 2.0 podcast:value block (streaming sats / boosts, keysend splits) */
  valueSplits: { type: string; method: string; recipients: ValueRecipient[] } | null
  /** Lightning address for NIP-57 zaps (from Nostr kind 0) */
  lud16: string | null
  nostrPubkey: string | null
  zapSplits: { pubkey: string; relay?: string; weight: number }[]
}

export type OpenInfo = {
  sources: CatalogSource[]
  image: string
  links: { label: string; url: string }[]
  pay: PayInfo
  genreTags: string[]
}

export type AudioPreset = {
  root: number
  intervals: number[]
  pattern: number[]
  tempo: number
  wave: OscillatorType
  cutoff: number
  padMix: number
}

export type GenreId =
  | 'hiphop'
  | 'pop'
  | 'rock'
  | 'rnb'
  | 'electronic'
  | 'jazz'
  | 'latin'
  | 'country'
  | 'indie'
  | 'metal'

export type Genre = {
  id: GenreId
  name: string
  color: number
  /** Nebula / cluster center on the hollow genre-ball shell */
  center: [number, number, number]
  /** Cluster radius for artist placement / nebula size */
  radius: number
  /** Nebula visual tint (CSS rgba stops) */
  nebulaA: string
  nebulaB: string
  audio: AudioPreset
}

export type Subgenre = {
  id: string
  name: string
  parentId: GenreId
  center: [number, number, number]
  radius: number
  color: number
  nebulaA: string
  nebulaB: string
  audio: AudioPreset
}

export type ArtistAlsoIn = {
  genreId: GenreId
  subgenreId: string
}

export type Artist = {
  /** Unique star-instance id (secondary instances use `${baseId}__${subgenreId}`) */
  id: string
  /** Profile id shared across multi-genre instances */
  baseId: string
  name: string
  genre: string
  genreId: GenreId
  subgenreId: string
  subgenre: string
  /** Other clusters this artist also appears in (primary instance only) */
  alsoIn: ArtistAlsoIn[]
  bio: string
  tracks: Track[]
  color: number
  size: number
  /** Offset within subgenre cluster */
  offset: [number, number, number]
  position: [number, number, number]
  audio: AudioPreset
  /** Present for artists loaded from the open V4V RSS / Nostr catalog */
  open?: OpenInfo
  /** Set when the artist has died — renders as a memorial star (see memorials.ts) */
  memorial?: Memorial
  /** Artist privacy setting: show wallet balance publicly. Default false (future: chosen at sign-up). */
  showBalance: boolean
  /** Life-cycle stage: protostar = newly signed-up artist, star = active, dead = deceased. */
  stage: ArtistStage
  deceased: boolean
  deathYear?: number
  /** Newly joined artist (demo flag until accounts exist) */
  isNew: boolean
  /** Dead-star look: planetary nebula (default) or supernova remnant (very influential) */
  remnant?: 'nebula' | 'supernova'
}
export type ArtistStage = 'protostar' | 'star' | 'dead'

/** Demo "just signed up" artists (open catalog indies) — render as protostars. */
export const DEMO_NEW_ARTIST_IDS = new Set<string>()

const PENT = [0, 3, 5, 7, 10]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const MIXO = [0, 2, 4, 5, 7, 9, 10]

const ARP_A = [0, 2, 4, 2, 0, 3, -1, 4, 1, 2, 4, 5, 4, 2, 0, 3]
const ARP_B = [0, -1, 2, 4, 3, 2, 0, -1, 4, 2, 5, 4, -1, 3, 0, 2]
const ARP_C = [4, 2, 0, 2, 5, 4, 2, 0, 3, -1, 4, 2, 0, 2, 4, 5]
const ARP_D = [0, 0, 3, 5, -1, 4, 2, 0, 5, 4, 2, -1, 0, 3, 4, 2]
const ARP_E = [0, 4, 7, 4, 0, 5, 4, 2, 0, -1, 3, 5, 7, 5, 3, 0]
const ARP_F = [0, 3, 5, 3, 0, 5, 7, 5, 3, 0, -1, 3, 5, 6, 5, 3]

/** Genre shell positions — Fibonacci sphere, hollow origin (Metal not special-cased). */
const SHELL = fibonacciSphere(10, GENRE_BALL_RADIUS)

type GenreDef = Omit<Genre, 'center' | 'radius' | 'nebulaA' | 'nebulaB'> & {
  nebulaA: string
  nebulaB: string
}

const GENRE_DEFS: GenreDef[] = [
  {
    id: 'hiphop',
    name: 'Hip-Hop',
    color: 0x7cffb2,
    nebulaA: 'rgba(40,180,120,0.32)',
    nebulaB: 'rgba(20,90,70,0.16)',
    audio: { root: 43, intervals: PENT, pattern: ARP_D, tempo: 90, wave: 'triangle', cutoff: 1300, padMix: 0.18 },
  },
  {
    id: 'pop',
    name: 'Pop',
    color: 0xff6ec7,
    nebulaA: 'rgba(220,80,180,0.30)',
    nebulaB: 'rgba(140,40,160,0.16)',
    audio: { root: 58, intervals: MAJOR, pattern: ARP_C, tempo: 118, wave: 'square', cutoff: 2300, padMix: 0.14 },
  },
  {
    id: 'rock',
    name: 'Rock',
    color: 0xff6a4a,
    nebulaA: 'rgba(220,70,50,0.28)',
    nebulaB: 'rgba(160,40,30,0.14)',
    audio: { root: 47, intervals: MIXO, pattern: ARP_B, tempo: 112, wave: 'sawtooth', cutoff: 2100, padMix: 0.16 },
  },
  {
    id: 'rnb',
    name: 'R&B / Soul',
    color: 0xff7a9a,
    nebulaA: 'rgba(220,70,120,0.30)',
    nebulaB: 'rgba(160,40,90,0.15)',
    audio: { root: 51, intervals: DORIAN, pattern: ARP_E, tempo: 92, wave: 'sine', cutoff: 1700, padMix: 0.32 },
  },
  {
    id: 'electronic',
    name: 'Electronic',
    color: 0x4df0ff,
    nebulaA: 'rgba(40,180,220,0.30)',
    nebulaB: 'rgba(30,80,180,0.16)',
    audio: { root: 45, intervals: PENT, pattern: ARP_B, tempo: 124, wave: 'sawtooth', cutoff: 2200, padMix: 0.12 },
  },
  {
    id: 'jazz',
    name: 'Jazz',
    color: 0xffcc66,
    nebulaA: 'rgba(220,180,60,0.26)',
    nebulaB: 'rgba(160,100,30,0.14)',
    audio: { root: 50, intervals: DORIAN, pattern: ARP_E, tempo: 96, wave: 'triangle', cutoff: 1700, padMix: 0.25 },
  },
  {
    id: 'latin',
    name: 'Latin',
    color: 0xff9a4a,
    nebulaA: 'rgba(240,140,40,0.28)',
    nebulaB: 'rgba(180,60,40,0.14)',
    audio: { root: 46, intervals: PENT, pattern: ARP_F, tempo: 102, wave: 'sine', cutoff: 1600, padMix: 0.24 },
  },
  {
    id: 'country',
    name: 'Country',
    color: 0xf0d08a,
    nebulaA: 'rgba(220,180,100,0.26)',
    nebulaB: 'rgba(140,100,40,0.14)',
    audio: { root: 55, intervals: MAJOR, pattern: ARP_A, tempo: 88, wave: 'triangle', cutoff: 1500, padMix: 0.22 },
  },
  {
    id: 'indie',
    name: 'Indie / Alt',
    color: 0x9affd4,
    nebulaA: 'rgba(80,220,180,0.26)',
    nebulaB: 'rgba(40,120,140,0.14)',
    audio: { root: 56, intervals: MAJOR, pattern: ARP_B, tempo: 104, wave: 'triangle', cutoff: 1800, padMix: 0.22 },
  },
  {
    id: 'metal',
    name: 'Metal',
    color: 0xff3b3b,
    nebulaA: 'rgba(180,20,40,0.28)',
    nebulaB: 'rgba(80,10,30,0.16)',
    audio: { root: 38, intervals: MINOR, pattern: ARP_B, tempo: 140, wave: 'sawtooth', cutoff: 2600, padMix: 0.08 },
  },
]

/** Ten main genres equally spaced on the hollow ball shell. */
export const GENRES: Genre[] = GENRE_DEFS.map((def, i) => ({
  ...def,
  center: SHELL[i],
  radius: GENRE_CLUSTER_RADIUS,
}))

export const GENRE_BY_ID: Record<GenreId, Genre> = Object.fromEntries(
  GENRES.map((g) => [g.id, g]),
) as Record<GenreId, Genre>

const SUBGENRE_NAMES: Record<GenreId, string[]> = {
  hiphop: ['Boom Bap', 'Trap', 'Conscious', 'Drill', 'Alternative Rap'],
  pop: ['Dance Pop', 'Synth Pop', 'Teen Pop', 'Art Pop', 'Electropop'],
  rock: ['Classic Rock', 'Alternative', 'Punk', 'Indie Rock', 'Progressive'],
  rnb: ['Neo-Soul', 'Contemporary R&B', 'Quiet Storm', 'Funk', 'Gospel-Soul'],
  electronic: ['House', 'Techno', 'Ambient', 'Drum & Bass', 'Synthwave'],
  jazz: ['Bebop', 'Cool', 'Fusion', 'Vocal Jazz', 'Contemporary'],
  latin: ['Reggaeton', 'Salsa', 'Latin Pop', 'Brazilian', 'Regional Mexican'],
  country: ['Contemporary', 'Outlaw', 'Americana', 'Country Pop', 'Bluegrass-tinged'],
  indie: ['Indie Pop', 'Dream Pop', 'Post-Punk', 'Singer-Songwriter', 'Chamber'],
  metal: ['Thrash', 'Doom', 'Nu-Metal', 'Prog Metal', 'Industrial'],
}

function subgenreIdFor(parentId: GenreId, name: string): string {
  return (
    parentId +
    '-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
}

function buildSubgenres(): Subgenre[] {
  const centers = GENRES.map((g) => g.center)
  const out: Subgenre[] = []
  GENRES.forEach((parent, gi) => {
    const names = SUBGENRE_NAMES[parent.id]
    const orbit = parent.radius * SUBGENRE_ORBIT_MUL
    const offsets = pentagonOffsets(orbit, gi)
    const near = nearestIndices(centers, gi, 2)
    names.forEach((name, si) => {
      const [ox, oy, oz] = offsets[si]
      // Blend toward nearest neighbor genres (15–35% by subgenre index)
      const t1 = 0.15 + (si % 5) * 0.04
      const t2 = 0.08 + ((si + 2) % 5) * 0.03
      let color = lerpHex(parent.color, GENRES[near[0]].color, t1)
      color = lerpHex(color, GENRES[near[1]].color, t2)
      out.push({
        id: subgenreIdFor(parent.id, name),
        name,
        parentId: parent.id,
        center: [parent.center[0] + ox, parent.center[1] + oy, parent.center[2] + oz],
        radius: SUBGENRE_CLUSTER_RADIUS,
        color,
        nebulaA: rgbaFromHex(color, 0.22),
        nebulaB: rgbaFromHex(color, 0.1),
        audio: { ...parent.audio },
      })
    })
  })
  return out
}

export const SUBGENRES: Subgenre[] = buildSubgenres()

export const SUBGENRE_BY_ID: Record<string, Subgenre> = Object.fromEntries(
  SUBGENRES.map((s) => [s.id, s]),
)

type ArtistSeed = {
  id: string
  name: string
  genreId: GenreId
  subgenreId: string
  alsoIn?: ArtistAlsoIn[]
  bio: string
  tracks: Track[]
  offset: [number, number, number]
  size?: number
  /**
   * Optional 0..1 override: how far from the genre center this artist sits.
   * 0 = core/mainstream (inward), 1 = niche / genre-bending (outer rim).
   * When omitted, computed from alsoIn, size, subgenre niche keywords, open tags.
   */
  edge?: number
  open?: OpenInfo
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const seeds: ArtistSeed[] = [
  // —— Hip-Hop ——
  {
    id: slug('Kendrick Lamar'),
    name: 'Kendrick Lamar',
    genreId: 'hiphop',
    subgenreId: 'hiphop-conscious',
    bio: 'Pulitzer-winning rapper from Compton whose concept albums (good kid, m.A.A.d city; To Pimp a Butterfly; DAMN.) reshaped mainstream hip-hop storytelling.',
    tracks: [
      { title: 'HUMBLE.', duration: '2:57' },
      { title: 'Alright', duration: '3:39' },
      { title: 'DNA.', duration: '3:05' },
      { title: 'King Kunta', duration: '3:54' },
      { title: 'Swimming Pools (Drank)', duration: '4:07' },
      { title: 'Money Trees', duration: '6:26' },
    ],
    offset: [0.1, 0.2, -0.15],
    size: 1.3,
  },
  {
    id: slug('Drake'),
    name: 'Drake',
    genreId: 'hiphop',
    subgenreId: 'hiphop-trap',
    alsoIn: [{ genreId: 'rnb' as const, subgenreId: 'rnb-contemporary-r-b' }],
    bio: 'Toronto artist who blurred rap and R&B into global chart dominance with melodic hooks and confessional bars across Views, Scorpion, and more.',
    tracks: [
      { title: "God's Plan", duration: '3:19' },
      { title: 'Hotline Bling', duration: '4:27' },
      { title: 'Started From the Bottom', duration: '2:53' },
      { title: 'One Dance', duration: '2:54' },
      { title: 'Nice For What', duration: '3:30' },
      { title: 'Hold On, We\'re Going Home', duration: '3:51' },
    ],
    offset: [-0.45, 0.05, 0.35],
    size: 1.32,
    edge: 0.22,
  },
  {
    id: slug('Nicki Minaj'),
    name: 'Nicki Minaj',
    genreId: 'hiphop',
    subgenreId: 'hiphop-trap',
    alsoIn: [{ genreId: 'pop' as const, subgenreId: 'pop-dance-pop' }],
    bio: 'Trinidadian-American rapper whose Pink Friday era and rapid-fire versatility made her one of hip-hop\'s most influential mainstream voices.',
    tracks: [
      { title: 'Super Bass', duration: '3:20' },
      { title: 'Anaconda', duration: '4:20' },
      { title: 'Starships', duration: '3:30' },
      { title: 'Chun-Li', duration: '3:11' },
      { title: 'Moment 4 Life', duration: '4:39' },
      { title: 'Pound the Alarm', duration: '3:25' },
    ],
    offset: [0.55, -0.2, 0.1],
  },
  {
    id: slug('J. Cole'),
    name: 'J. Cole',
    genreId: 'hiphop',
    subgenreId: 'hiphop-conscious',
    bio: 'Fayetteville-raised rapper-producer known for introspective storytelling on 2014 Forest Hills Drive and a fiercely independent Dreamville lane.',
    tracks: [
      { title: 'No Role Modelz', duration: '4:52' },
      { title: 'Middle Child', duration: '3:33' },
      { title: 'Wet Dreamz', duration: '3:59' },
      { title: 'Work Out', duration: '3:54' },
      { title: 'Love Yourz', duration: '3:31' },
      { title: 'ATM', duration: '3:36' },
    ],
    offset: [-0.2, 0.4, -0.5],
  },
  {
    id: slug('Travis Scott'),
    name: 'Travis Scott',
    genreId: 'hiphop',
    subgenreId: 'hiphop-trap',
    alsoIn: [{ genreId: 'electronic' as const, subgenreId: 'electronic-synthwave' }, { genreId: 'pop' as const, subgenreId: 'pop-electropop' }],
    bio: 'Houston visionary behind Astroworld and Utopia, known for psychedelic production, festival spectacle, and auto-tuned melodies.',
    tracks: [
      { title: 'SICKO MODE', duration: '5:12' },
      { title: 'goosebumps', duration: '4:03' },
      { title: 'Butterfly Effect', duration: '3:10' },
      { title: 'HIGHEST IN THE ROOM', duration: '2:55' },
      { title: 'Antidote', duration: '4:22' },
      { title: 'FE!N', duration: '3:11' },
    ],
    offset: [0.35, -0.35, -0.4],
    edge: 0.7,
  },
  {
    id: slug('Cardi B'),
    name: 'Cardi B',
    genreId: 'hiphop',
    subgenreId: 'hiphop-drill',
    bio: 'Bronx rapper who crashed into superstardom with Invasion of Privacy — sharp punchlines, chart-topping singles, and unfiltered charisma.',
    tracks: [
      { title: 'Bodak Yellow', duration: '3:43' },
      { title: 'I Like It', duration: '4:13' },
      { title: 'WAP', duration: '3:07' },
      { title: 'Up', duration: '2:36' },
      { title: 'Money', duration: '3:03' },
      { title: 'Be Careful', duration: '3:30' },
    ],
    offset: [-0.55, -0.15, 0.05],
  },
  {
    id: slug('Jay-Z'),
    name: 'Jay-Z',
    genreId: 'hiphop',
    subgenreId: 'hiphop-boom-bap',
    bio: 'Brooklyn icon whose catalogs from Reasonable Doubt to 4:44 helped define hip-hop entrepreneurship and lyric craft for decades.',
    tracks: [
      { title: '99 Problems', duration: '3:54' },
      { title: 'Empire State of Mind', duration: '4:36' },
      { title: 'Big Pimpin\'', duration: '4:44' },
      { title: 'Ni**as in Paris', duration: '3:39' },
      { title: 'Dirt Off Your Shoulder', duration: '4:04' },
      { title: 'Hard Knock Life', duration: '3:58' },
    ],
    offset: [0.0, 0.5, 0.45],
  },
  {
    id: slug('Missy Elliott'),
    name: 'Missy Elliott',
    genreId: 'hiphop',
    subgenreId: 'hiphop-alternative-rap',
    bio: 'Virginia Beach innovator whose futuristic videos and Timbaland collaborations (Supa Dupa Fly, Under Construction) remade rap\'s sound and look.',
    tracks: [
      { title: 'Get Ur Freak On', duration: '3:56' },
      { title: 'Work It', duration: '4:23' },
      { title: 'Lose Control', duration: '3:47' },
      { title: 'The Rain (Supa Dupa Fly)', duration: '4:11' },
      { title: 'Pass That Dutch', duration: '3:41' },
      { title: 'Sock It 2 Me', duration: '4:16' },
    ],
    offset: [0.4, 0.25, 0.55],
    edge: 0.72,
  },

  // —— Pop ——
  {
    id: slug('Taylor Swift'),
    name: 'Taylor Swift',
    genreId: 'pop',
    subgenreId: 'pop-teen-pop',
    bio: 'Songwriter who moved from country roots to global pop domination, with eras spanning 1989, Folklore, Midnights, and record-breaking tours.',
    tracks: [
      { title: 'Blank Space', duration: '3:51' },
      { title: 'Anti-Hero', duration: '3:20' },
      { title: 'Shake It Off', duration: '3:39' },
      { title: 'Cruel Summer', duration: '2:58' },
      { title: 'Love Story', duration: '3:55' },
      { title: 'cardigan', duration: '3:59' },
    ],
    offset: [0.05, 0.15, -0.1],
    size: 1.35,
    edge: 0.08,
  },
  {
    id: slug('Beyoncé'),
    name: 'Beyoncé',
    genreId: 'pop',
    subgenreId: 'pop-dance-pop',
    alsoIn: [{ genreId: 'rnb' as const, subgenreId: 'rnb-contemporary-r-b' }],
    bio: 'Houston superstar whose solo run from Dangerously in Love through Renaissance redefined pop spectacle, visual albums, and cultural influence.',
    tracks: [
      { title: 'Crazy in Love', duration: '3:56' },
      { title: 'Single Ladies', duration: '3:13' },
      { title: 'Formation', duration: '3:26' },
      { title: 'Halo', duration: '4:21' },
      { title: 'CUFF IT', duration: '3:45' },
      { title: 'Drunk in Love', duration: '5:23' },
    ],
    offset: [-0.4, 0.1, 0.4],
  },
  {
    id: slug('Ariana Grande'),
    name: 'Ariana Grande',
    genreId: 'pop',
    subgenreId: 'pop-dance-pop',
    bio: 'Powerhouse vocalist behind Thank U, Next and Positions, mixing R&B polish with bubblegum hooks and four-octave range.',
    tracks: [
      { title: 'thank u, next', duration: '3:27' },
      { title: '7 rings', duration: '2:58' },
      { title: 'into you', duration: '4:04' },
      { title: 'no tears left to cry', duration: '3:25' },
      { title: 'positions', duration: '2:52' },
      { title: 'Problem', duration: '3:13' },
    ],
    offset: [0.5, -0.25, 0.15],
  },
  {
    id: slug('The Weeknd'),
    name: 'The Weeknd',
    genreId: 'pop',
    subgenreId: 'pop-synth-pop',
    alsoIn: [{ genreId: 'rnb' as const, subgenreId: 'rnb-neo-soul' }],
    bio: 'Abel Tesfaye\'s dark-pop noir — from House of Balloons to After Hours — fused alternative R&B with stadium-sized choruses.',
    tracks: [
      { title: 'Blinding Lights', duration: '3:20' },
      { title: 'Starboy', duration: '3:50' },
      { title: 'The Hills', duration: '4:02' },
      { title: 'Save Your Tears', duration: '3:35' },
      { title: 'Can\'t Feel My Face', duration: '3:33' },
      { title: 'Die For You', duration: '4:20' },
    ],
    offset: [-0.25, 0.45, -0.4],
  },
  {
    id: slug('Billie Eilish'),
    name: 'Billie Eilish',
    genreId: 'pop',
    subgenreId: 'pop-art-pop',
    alsoIn: [{ genreId: 'indie' as const, subgenreId: 'indie-dream-pop' }],
    bio: 'Whisper-pop trailblazer with brother Finneas; When We All Fall Asleep and Happier Than Ever flipped teen-pop conventions into eerie intimacy.',
    tracks: [
      { title: 'bad guy', duration: '3:14' },
      { title: 'ocean eyes', duration: '3:20' },
      { title: 'everything i wanted', duration: '4:05' },
      { title: 'Happier Than Ever', duration: '4:58' },
      { title: 'Therefore I Am', duration: '2:54' },
      { title: 'What Was I Made For?', duration: '3:42' },
    ],
    offset: [0.35, -0.4, -0.35],
  },
  {
    id: slug('Dua Lipa'),
    name: 'Dua Lipa',
    genreId: 'pop',
    subgenreId: 'pop-dance-pop',
    bio: 'London-raised pop star whose Future Nostalgia disco revival and dance-floor singles made her a defining 2020s chart force.',
    tracks: [
      { title: 'Don\'t Start Now', duration: '3:03' },
      { title: 'Levitating', duration: '3:23' },
      { title: 'New Rules', duration: '3:29' },
      { title: 'Physical', duration: '3:13' },
      { title: 'Hotter Than Hell', duration: '3:07' },
      { title: 'Houdini', duration: '3:05' },
    ],
    offset: [-0.5, -0.2, 0.05],
  },
  {
    id: slug('Bruno Mars'),
    name: 'Bruno Mars',
    genreId: 'pop',
    subgenreId: 'pop-electropop',
    alsoIn: [{ genreId: 'rnb' as const, subgenreId: 'rnb-funk' }],
    bio: 'Hawaiian showman mixing Motown, funk, and modern pop — from Doo-Wops & Hooligans to Silk Sonic — with airtight live bands.',
    tracks: [
      { title: 'Uptown Funk', duration: '4:29' },
      { title: 'Just the Way You Are', duration: '3:40' },
      { title: '24K Magic', duration: '3:46' },
      { title: 'Locked Out of Heaven', duration: '3:53' },
      { title: 'That\'s What I Like', duration: '3:26' },
      { title: 'Grenade', duration: '3:42' },
    ],
    offset: [0.15, 0.5, 0.5],
  },
  {
    id: slug('Rihanna'),
    name: 'Rihanna',
    genreId: 'pop',
    subgenreId: 'pop-dance-pop',
    alsoIn: [{ genreId: 'rnb' as const, subgenreId: 'rnb-contemporary-r-b' }],
    bio: 'Barbadian megastar whose run from Music of the Sun through Anti spanned dancehall, pop, R&B, and fashion-empire status.',
    tracks: [
      { title: 'Umbrella', duration: '4:36' },
      { title: 'Diamonds', duration: '3:45' },
      { title: 'We Found Love', duration: '3:35' },
      { title: 'Work', duration: '3:39' },
      { title: 'Only Girl (In the World)', duration: '3:55' },
      { title: 'Needed Me', duration: '3:11' },
    ],
    offset: [0.45, 0.2, -0.55],
  },

  // —— Rock ——
  {
    id: slug('Queen'),
    name: 'Queen',
    genreId: 'rock',
    subgenreId: 'rock-progressive',
    bio: 'British rock legends led by Freddie Mercury — operatic scope, stadium anthems, and a catalog from A Night at the Opera to The Game.',
    tracks: [
      { title: 'Bohemian Rhapsody', duration: '5:55' },
      { title: 'Don\'t Stop Me Now', duration: '3:29' },
      { title: 'We Will Rock You', duration: '2:02' },
      { title: 'Another One Bites the Dust', duration: '3:35' },
      { title: 'Somebody to Love', duration: '4:56' },
      { title: 'Radio Ga Ga', duration: '5:48' },
    ],
    offset: [0.0, 0.2, -0.1],
    size: 1.32,
  },
  {
    id: slug('The Beatles'),
    name: 'The Beatles',
    genreId: 'rock',
    subgenreId: 'rock-classic-rock',
    bio: 'Liverpool quartet that transformed popular music across Rubber Soul, Revolver, Sgt. Pepper, and Abbey Road — still the template for rock ambition.',
    tracks: [
      { title: 'Hey Jude', duration: '7:11' },
      { title: 'Come Together', duration: '4:19' },
      { title: 'Let It Be', duration: '4:03' },
      { title: 'Here Comes the Sun', duration: '3:05' },
      { title: 'Yesterday', duration: '2:05' },
      { title: 'Help!', duration: '2:19' },
    ],
    offset: [-0.45, 0.05, 0.35],
  },
  {
    id: slug('Foo Fighters'),
    name: 'Foo Fighters',
    genreId: 'rock',
    subgenreId: 'rock-alternative',
    bio: 'Dave Grohl\'s post-Nirvana band — arena-sized hooks and guitar roar from The Colour and the Shape through later stadium eras.',
    tracks: [
      { title: 'Everlong', duration: '4:10' },
      { title: 'The Pretender', duration: '4:29' },
      { title: 'My Hero', duration: '4:20' },
      { title: 'Learn to Fly', duration: '3:55' },
      { title: 'Best of You', duration: '4:16' },
      { title: 'Times Like These', duration: '4:26' },
    ],
    offset: [0.5, -0.25, 0.2],
  },
  {
    id: slug('Arctic Monkeys'),
    name: 'Arctic Monkeys',
    genreId: 'rock',
    subgenreId: 'rock-indie-rock',
    bio: 'Sheffield indie-rockers who evolved from Whatever People Say I Am… urgency into the sleek desert cool of AM and beyond.',
    tracks: [
      { title: 'Do I Wanna Know?', duration: '4:32' },
      { title: 'R U Mine?', duration: '3:21' },
      { title: 'I Bet You Look Good on the Dancefloor', duration: '2:54' },
      { title: 'Fluorescent Adolescent', duration: '2:57' },
      { title: '505', duration: '4:13' },
      { title: 'Why\'d You Only Call Me When You\'re High?', duration: '2:41' },
    ],
    offset: [-0.2, 0.45, -0.45],
  },
  {
    id: slug('Red Hot Chili Peppers'),
    name: 'Red Hot Chili Peppers',
    genreId: 'rock',
    subgenreId: 'rock-alternative',
    bio: 'L.A. funk-rock institution — Anthony Kiedis, Flea, and company — with Californication and Stadium Arcadium as stadium staples.',
    tracks: [
      { title: 'Californication', duration: '5:21' },
      { title: 'Under the Bridge', duration: '4:24' },
      { title: 'Can\'t Stop', duration: '4:29' },
      { title: 'Otherside', duration: '4:15' },
      { title: 'Dani California', duration: '4:42' },
      { title: 'Scar Tissue', duration: '3:37' },
    ],
    offset: [0.35, -0.4, -0.3],
  },
  {
    id: slug('Nirvana'),
    name: 'Nirvana',
    genreId: 'rock',
    subgenreId: 'rock-punk',
    bio: 'Aberdeen grunge trio led by Kurt Cobain; Nevermind and In Utero dragged alternative rock into the global mainstream overnight.',
    tracks: [
      { title: 'Smells Like Teen Spirit', duration: '5:01' },
      { title: 'Come as You Are', duration: '3:38' },
      { title: 'Lithium', duration: '4:17' },
      { title: 'Heart-Shaped Box', duration: '4:41' },
      { title: 'In Bloom', duration: '4:14' },
      { title: 'About a Girl', duration: '2:48' },
    ],
    offset: [-0.55, -0.1, 0.1],
  },
  {
    id: slug('The Rolling Stones'),
    name: 'The Rolling Stones',
    genreId: 'rock',
    subgenreId: 'rock-classic-rock',
    bio: 'Enduring British rock band whose blues-rooted swagger from Exile on Main St. to Sticky Fingers still defines rock \'n\' roll longevity.',
    tracks: [
      { title: '(I Can\'t Get No) Satisfaction', duration: '3:43' },
      { title: 'Paint It, Black', duration: '3:22' },
      { title: 'Gimme Shelter', duration: '4:30' },
      { title: 'Start Me Up', duration: '3:33' },
      { title: 'Sympathy for the Devil', duration: '6:18' },
      { title: 'Angie', duration: '4:33' },
    ],
    offset: [0.1, 0.55, 0.45],
  },

  // —— R&B / Soul ——
  {
    id: slug('Aretha Franklin'),
    name: 'Aretha Franklin',
    genreId: 'rnb',
    subgenreId: 'rnb-gospel-soul',
    bio: 'The Queen of Soul — Detroit\'s Aretha Franklin made Respect and I Never Loved a Man landmarks of American gospel-rooted R&B.',
    tracks: [
      { title: 'Respect', duration: '2:28' },
      { title: '(You Make Me Feel Like) A Natural Woman', duration: '2:45' },
      { title: 'I Say a Little Prayer', duration: '3:34' },
      { title: 'Think', duration: '2:19' },
      { title: 'Chain of Fools', duration: '2:47' },
      { title: 'Until You Come Back to Me', duration: '3:26' },
    ],
    offset: [0.05, 0.2, -0.1],
    size: 1.28,
  },
  {
    id: slug('Stevie Wonder'),
    name: 'Stevie Wonder',
    genreId: 'rnb',
    subgenreId: 'rnb-funk',
    bio: 'Motown genius whose 1970s classics — Innervisions, Songs in the Key of Life — fused soul, funk, and visionary songwriting.',
    tracks: [
      { title: 'Superstition', duration: '4:26' },
      { title: 'Isn\'t She Lovely', duration: '6:34' },
      { title: 'Signed, Sealed, Delivered', duration: '2:39' },
      { title: 'Sir Duke', duration: '3:52' },
      { title: 'Higher Ground', duration: '3:42' },
      { title: 'I Just Called to Say I Love You', duration: '4:21' },
    ],
    offset: [-0.4, 0.1, 0.4],
  },
  {
    id: slug('Frank Ocean'),
    name: 'Frank Ocean',
    genreId: 'rnb',
    subgenreId: 'rnb-neo-soul',
    bio: 'New Orleans auteur behind Channel Orange and Blonde — intimate, experimental R&B that rewrote the genre\'s emotional vocabulary.',
    tracks: [
      { title: 'Thinkin Bout You', duration: '3:20' },
      { title: 'Nights', duration: '5:07' },
      { title: 'Pink + White', duration: '3:04' },
      { title: 'Ivy', duration: '4:09' },
      { title: 'Pyramids', duration: '9:52' },
      { title: 'Self Control', duration: '4:09' },
    ],
    offset: [0.5, -0.25, 0.15],
  },
  {
    id: slug('SZA'),
    name: 'SZA',
    genreId: 'rnb',
    subgenreId: 'rnb-contemporary-r-b',
    alsoIn: [{ genreId: 'pop' as const, subgenreId: 'pop-art-pop' }],
    bio: 'Ctrl and SOS made Solána Rowe a defining voice of modern R&B — vulnerable writing over sleek, left-field production.',
    tracks: [
      { title: 'Kill Bill', duration: '2:33' },
      { title: 'Snooze', duration: '3:21' },
      { title: 'Good Days', duration: '4:39' },
      { title: 'The Weekend', duration: '4:32' },
      { title: 'Shirt', duration: '3:01' },
      { title: 'Nobody Gets Me', duration: '3:00' },
    ],
    offset: [-0.25, 0.45, -0.4],
  },
  {
    id: slug('Usher'),
    name: 'Usher',
    genreId: 'rnb',
    subgenreId: 'rnb-contemporary-r-b',
    bio: 'Atlanta R&B star whose Confessions era and dance-floor ballads made him one of the 2000s\' defining male vocalists.',
    tracks: [
      { title: 'Yeah!', duration: '4:10' },
      { title: 'Burn', duration: '3:51' },
      { title: 'U Got It Bad', duration: '4:07' },
      { title: 'OMG', duration: '4:29' },
      { title: 'Nice & Slow', duration: '3:48' },
      { title: 'Confessions Part II', duration: '3:31' },
    ],
    offset: [0.35, -0.35, -0.35],
  },
  {
    id: slug('Alicia Keys'),
    name: 'Alicia Keys',
    genreId: 'rnb',
    subgenreId: 'rnb-neo-soul',
    bio: 'Classically trained pianist-singer whose Songs in A Minor breakthrough and later albums kept soul piano front-and-center on the charts.',
    tracks: [
      { title: 'Fallin\'', duration: '3:30' },
      { title: 'If I Ain\'t Got You', duration: '3:48' },
      { title: 'No One', duration: '4:13' },
      { title: 'Girl on Fire', duration: '3:44' },
      { title: 'Empire State of Mind (Part II)', duration: '3:36' },
      { title: 'You Don\'t Know My Name', duration: '6:06' },
    ],
    offset: [-0.5, -0.15, 0.05],
  },
  {
    id: slug('Mary J. Blige'),
    name: 'Mary J. Blige',
    genreId: 'rnb',
    subgenreId: 'rnb-quiet-storm',
    bio: 'The Queen of Hip-Hop Soul — My Life and Share My World defined 1990s R&B vulnerability with street-edge grit.',
    tracks: [
      { title: 'Real Love', duration: '4:30' },
      { title: 'Family Affair', duration: '4:25' },
      { title: 'Not Gon\' Cry', duration: '4:55' },
      { title: 'Be Without You', duration: '4:09' },
      { title: 'No More Drama', duration: '4:26' },
      { title: 'I Can Love You', duration: '4:52' },
    ],
    offset: [0.2, 0.5, 0.45],
  },

  // —— Electronic ——
  {
    id: slug('Daft Punk'),
    name: 'Daft Punk',
    genreId: 'electronic',
    subgenreId: 'electronic-house',
    alsoIn: [{ genreId: 'pop' as const, subgenreId: 'pop-electropop' }],
    bio: 'French duo whose Discovery and Random Access Memories turned robot-helmed house into global pop culture.',
    tracks: [
      { title: 'Get Lucky', duration: '4:08' },
      { title: 'One More Time', duration: '5:20' },
      { title: 'Around the World', duration: '7:09' },
      { title: 'Harder, Better, Faster, Stronger', duration: '3:44' },
      { title: 'Instant Crush', duration: '5:37' },
      { title: 'Digital Love', duration: '4:58' },
    ],
    offset: [0.0, 0.15, -0.1],
    size: 1.3,
  },
  {
    id: slug('Calvin Harris'),
    name: 'Calvin Harris',
    genreId: 'electronic',
    subgenreId: 'electronic-house',
    alsoIn: [{ genreId: 'pop' as const, subgenreId: 'pop-dance-pop' }],
    bio: 'Scottish producer-DJ who took EDM into the pop mainstream with festival anthems and a string of collaborative chart toppers.',
    tracks: [
      { title: 'Summer', duration: '3:42' },
      { title: 'Feel So Close', duration: '3:26' },
      { title: 'This Is What You Came For', duration: '3:41' },
      { title: 'Outside', duration: '3:47' },
      { title: 'How Deep Is Your Love', duration: '3:32' },
      { title: 'Slide', duration: '3:50' },
    ],
    offset: [-0.45, 0.05, 0.4],
  },
  {
    id: slug('Skrillex'),
    name: 'Skrillex',
    genreId: 'electronic',
    subgenreId: 'electronic-drum-bass',
    bio: 'Sonny Moore\'s bass-heavy dubstep breakthrough (Scary Monsters and Nice Sprites) remade festival electronic for a new decade.',
    tracks: [
      { title: 'Bangarang', duration: '3:35' },
      { title: 'Scary Monsters and Nice Sprites', duration: '4:03' },
      { title: 'Where Are Ü Now', duration: '4:10' },
      { title: 'First of the Year (Equinox)', duration: '4:22' },
      { title: 'Purple Lamborghini', duration: '3:32' },
      { title: 'Rumble', duration: '2:26' },
    ],
    offset: [0.5, -0.3, 0.1],
  },
  {
    id: slug('Deadmau5'),
    name: 'deadmau5',
    genreId: 'electronic',
    subgenreId: 'electronic-techno',
    bio: 'Canadian progressive-house figurehead known for long-form builds, the mau5head mask, and tracks like Strobe and Ghosts \'n\' Stuff.',
    tracks: [
      { title: 'Strobe', duration: '10:37' },
      { title: 'Ghosts \'n\' Stuff', duration: '5:28' },
      { title: 'I Remember', duration: '9:07' },
      { title: 'The Veldt', duration: '8:43' },
      { title: 'Raise Your Weapon', duration: '8:18' },
      { title: 'Sofi Needs a Ladder', duration: '6:41' },
    ],
    offset: [-0.2, 0.4, -0.5],
  },
  {
    id: slug('Avicii'),
    name: 'Avicii',
    genreId: 'electronic',
    subgenreId: 'electronic-synthwave',
    bio: 'Swedish producer Tim Bergling whose folk-EDM hybrids (Levels, Wake Me Up) brought electronic music to radio worldwide.',
    tracks: [
      { title: 'Wake Me Up', duration: '4:09' },
      { title: 'Levels', duration: '3:19' },
      { title: 'Hey Brother', duration: '4:15' },
      { title: 'The Nights', duration: '2:56' },
      { title: 'Waiting for Love', duration: '3:50' },
      { title: 'Silhouettes', duration: '3:31' },
    ],
    offset: [0.35, -0.35, -0.35],
  },
  {
    id: slug('Disclosure'),
    name: 'Disclosure',
    genreId: 'electronic',
    subgenreId: 'electronic-house',
    bio: 'UK brothers Howard & Guy Lawrence revived UK garage and house for a new pop audience with Settle and later albums.',
    tracks: [
      { title: 'Latch', duration: '4:16' },
      { title: 'White Noise', duration: '4:38' },
      { title: 'You & Me', duration: '4:34' },
      { title: 'Omen', duration: '3:50' },
      { title: 'Magnets', duration: '3:05' },
      { title: 'Holding On', duration: '3:47' },
    ],
    offset: [-0.55, -0.1, 0.0],
  },
  {
    id: slug('Aphex Twin'),
    name: 'Aphex Twin',
    genreId: 'electronic',
    subgenreId: 'electronic-ambient',
    bio: 'Richard D. James — IDM pioneer behind Selected Ambient Works and Richard D. James Album — still the gold standard for experimental electronic.',
    tracks: [
      { title: 'Windowlicker', duration: '6:07' },
      { title: 'Avril 14th', duration: '2:05' },
      { title: 'Come to Daddy', duration: '4:22' },
      { title: 'Xtal', duration: '4:54' },
      { title: 'Pulsewidth', duration: '3:48' },
      { title: 'Alberto Balsalm', duration: '5:11' },
    ],
    offset: [0.15, 0.5, 0.5],
    edge: 0.82,
  },

  // —— Jazz ——
  {
    id: slug('Miles Davis'),
    name: 'Miles Davis',
    genreId: 'jazz',
    subgenreId: 'jazz-cool',
    bio: 'Trumpeter who reinvented jazz repeatedly — Kind of Blue, Bitches Brew, and beyond — anchoring cool jazz, modal, and fusion eras.',
    tracks: [
      { title: 'So What', duration: '9:22' },
      { title: 'Freddie Freeloader', duration: '9:46' },
      { title: 'All Blues', duration: '11:33' },
      { title: 'Blue in Green', duration: '5:37' },
      { title: 'Flamenco Sketches', duration: '9:26' },
      { title: 'Milestones', duration: '5:45' },
    ],
    offset: [0.05, 0.2, -0.1],
    size: 1.28,
  },
  {
    id: slug('John Coltrane'),
    name: 'John Coltrane',
    genreId: 'jazz',
    subgenreId: 'jazz-bebop',
    bio: 'Saxophone giant of Giant Steps and A Love Supreme — sheets of sound, spiritual intensity, and endless harmonic curiosity.',
    tracks: [
      { title: 'Giant Steps', duration: '4:43' },
      { title: 'Naima', duration: '4:21' },
      { title: 'My Favorite Things', duration: '13:41' },
      { title: 'Acknowledgement', duration: '7:47' },
      { title: 'Blue Train', duration: '10:43' },
      { title: 'Equinox', duration: '8:33' },
    ],
    offset: [-0.4, 0.1, 0.35],
  },
  {
    id: slug('Ella Fitzgerald'),
    name: 'Ella Fitzgerald',
    genreId: 'jazz',
    subgenreId: 'jazz-vocal-jazz',
    bio: 'First Lady of Song — unmatched scat, crystal diction, and the Songbook series that canonized the Great American Songbook.',
    tracks: [
      { title: 'Summertime', duration: '4:58' },
      { title: 'Dream a Little Dream of Me', duration: '3:14' },
      { title: 'Mack the Knife', duration: '4:41' },
      { title: 'A-Tisket, A-Tasket', duration: '2:37' },
      { title: 'Cheek to Cheek', duration: '5:52' },
      { title: 'How High the Moon', duration: '5:12' },
    ],
    offset: [0.5, -0.2, 0.15],
  },
  {
    id: slug('Herbie Hancock'),
    name: 'Herbie Hancock',
    genreId: 'jazz',
    subgenreId: 'jazz-fusion',
    bio: 'Pianist-composer spanning hard bop to electro-funk — Maiden Voyage, Head Hunters, and Rockit keep rewriting what jazz can do.',
    tracks: [
      { title: 'Chameleon', duration: '15:41' },
      { title: 'Cantaloupe Island', duration: '5:30' },
      { title: 'Watermelon Man', duration: '6:29' },
      { title: 'Rockit', duration: '5:25' },
      { title: 'Maiden Voyage', duration: '7:55' },
      { title: 'Actual Proof', duration: '5:12' },
    ],
    offset: [-0.25, 0.4, -0.45],
  },
  {
    id: slug('Kamasi Washington'),
    name: 'Kamasi Washington',
    genreId: 'jazz',
    subgenreId: 'jazz-contemporary',
    bio: 'L.A. saxophonist whose The Epic and Heaven and Earth brought orchestral spiritual jazz to a new generation of listeners.',
    tracks: [
      { title: 'The Rhythm Changes', duration: '7:44' },
      { title: 'Truth', duration: '13:18' },
      { title: 'Fists of Fury', duration: '9:42' },
      { title: 'Change of the Guard', duration: '12:16' },
      { title: 'Henrietta Our Hero', duration: '7:14' },
      { title: 'Street Fighter Mas', duration: '5:57' },
    ],
    offset: [0.35, -0.4, -0.3],
  },
  {
    id: slug('Norah Jones'),
    name: 'Norah Jones',
    genreId: 'jazz',
    subgenreId: 'jazz-vocal-jazz',
    bio: 'Grammy-sweeping vocalist-pianist whose Come Away with Me blended jazz, folk, and pop into early-2000s quiet-storm ubiquity.',
    tracks: [
      { title: 'Don\'t Know Why', duration: '3:06' },
      { title: 'Come Away with Me', duration: '3:18' },
      { title: 'Sunrise', duration: '3:20' },
      { title: 'Turn Me On', duration: '2:34' },
      { title: 'Those Sweet Words', duration: '3:22' },
      { title: 'Humble Me', duration: '4:14' },
    ],
    offset: [-0.5, -0.15, 0.1],
  },
  {
    id: slug('Louis Armstrong'),
    name: 'Louis Armstrong',
    genreId: 'jazz',
    subgenreId: 'jazz-cool',
    bio: 'Satchmo — New Orleans trumpet pioneer whose phrasing, scat, and charisma made jazz a worldwide language.',
    tracks: [
      { title: 'What a Wonderful World', duration: '2:21' },
      { title: 'Hello, Dolly!', duration: '2:27' },
      { title: 'La Vie En Rose', duration: '3:26' },
      { title: 'When the Saints Go Marching In', duration: '2:43' },
      { title: 'West End Blues', duration: '3:21' },
      { title: 'Stardust', duration: '3:35' },
    ],
    offset: [0.15, 0.5, 0.45],
  },

  // —— Latin ——
  {
    id: slug('Bad Bunny'),
    name: 'Bad Bunny',
    genreId: 'latin',
    subgenreId: 'latin-reggaeton',
    alsoIn: [{ genreId: 'hiphop' as const, subgenreId: 'hiphop-trap' }],
    bio: 'Puerto Rican star who took reggaeton and Latin trap global with YHLQMDLG, Un Verano Sin Ti, and stadium-scale cultural force.',
    tracks: [
      { title: 'Tití Me Preguntó', duration: '4:03' },
      { title: 'Me Porto Bonito', duration: '2:58' },
      { title: 'Moscow Mule', duration: '4:05' },
      { title: 'Yonaguni', duration: '3:26' },
      { title: 'Safaera', duration: '4:55' },
      { title: 'Ojitos Lindos', duration: '4:18' },
    ],
    offset: [0.05, 0.15, -0.1],
    size: 1.3,
  },
  {
    id: slug('Shakira'),
    name: 'Shakira',
    genreId: 'latin',
    subgenreId: 'latin-latin-pop',
    bio: 'Colombian singer-songwriter who crossed from Spanish-language rock/pop into global superstardom with Laundry Service and beyond.',
    tracks: [
      { title: 'Hips Don\'t Lie', duration: '3:38' },
      { title: 'Whenever, Wherever', duration: '3:16' },
      { title: 'Waka Waka', duration: '3:22' },
      { title: 'La Tortura', duration: '3:34' },
      { title: 'Objection (Tango)', duration: '3:42' },
      { title: 'She Wolf', duration: '3:08' },
    ],
    offset: [-0.4, 0.1, 0.4],
  },
  {
    id: slug('Daddy Yankee'),
    name: 'Daddy Yankee',
    genreId: 'latin',
    subgenreId: 'latin-reggaeton',
    bio: 'Reggaeton pioneer — Gasolina and later hits with Luis Fonsi and others helped export the genre worldwide from Puerto Rico.',
    tracks: [
      { title: 'Gasolina', duration: '3:12' },
      { title: 'Despacito', duration: '3:48' },
      { title: 'Con Calma', duration: '3:13' },
      { title: 'Limbo', duration: '3:44' },
      { title: 'Lo Que Pasó, Pasó', duration: '3:30' },
      { title: 'Dura', duration: '3:20' },
    ],
    offset: [0.5, -0.25, 0.15],
  },
  {
    id: slug('Celia Cruz'),
    name: 'Celia Cruz',
    genreId: 'latin',
    subgenreId: 'latin-salsa',
    bio: 'Queen of Salsa — Cuban powerhouse whose voice and ¡Azúcar! energy defined salsa\'s golden age across the Americas.',
    tracks: [
      { title: 'La Vida Es Un Carnaval', duration: '4:37' },
      { title: 'Quimbara', duration: '4:52' },
      { title: 'Guantanamera', duration: '4:10' },
      { title: 'La Negra Tiene Tumbao', duration: '4:15' },
      { title: 'Ríe y Llora', duration: '4:10' },
      { title: 'Yo Viviré', duration: '4:30' },
    ],
    offset: [-0.25, 0.4, -0.4],
  },
  {
    id: slug('J Balvin'),
    name: 'J Balvin',
    genreId: 'latin',
    subgenreId: 'latin-reggaeton',
    bio: 'Medellín artist who helped make urbano aesthetics fashion-forward and chart-topping across Latin America and beyond.',
    tracks: [
      { title: 'Mi Gente', duration: '3:04' },
      { title: 'Ginza', duration: '2:51' },
      { title: 'Safari', duration: '3:25' },
      { title: 'Ay Vamos', duration: '3:21' },
      { title: 'Verde', duration: '2:55' },
      { title: 'Qué Más Pues?', duration: '3:37' },
    ],
    offset: [0.35, -0.35, -0.35],
  },
  {
    id: slug('Rosalía'),
    name: 'Rosalía',
    genreId: 'latin',
    subgenreId: 'latin-latin-pop',
    alsoIn: [{ genreId: 'pop' as const, subgenreId: 'pop-art-pop' }],
    bio: 'Spanish artist fusing flamenco roots with experimental pop on El Mal Querer and Motomami — critically acclaimed and globally influential.',
    tracks: [
      { title: 'Malamente', duration: '2:29' },
      { title: 'Con Altura', duration: '2:41' },
      { title: 'Saoko', duration: '2:17' },
      { title: 'Bizcochito', duration: '1:49' },
      { title: 'TKN', duration: '2:09' },
      { title: 'Despechá', duration: '2:36' },
    ],
    offset: [-0.5, -0.15, 0.05],
  },
  {
    id: slug('Juanes'),
    name: 'Juanes',
    genreId: 'latin',
    subgenreId: 'latin-latin-pop',
    bio: 'Colombian rock-pop singer whose Un Día Normal and later work made Spanish-language rock a Latin Grammy fixture.',
    tracks: [
      { title: 'A Dios le Pido', duration: '3:26' },
      { title: 'La Camisa Negra', duration: '3:36' },
      { title: 'Es Por Ti', duration: '4:10' },
      { title: 'Fotografía', duration: '3:58' },
      { title: 'Me Enamora', duration: '3:13' },
      { title: 'Gotas de Agua Dulce', duration: '3:10' },
    ],
    offset: [0.2, 0.5, 0.45],
  },

  // —— Country ——
  {
    id: slug('Johnny Cash'),
    name: 'Johnny Cash',
    genreId: 'country',
    subgenreId: 'country-outlaw',
    bio: 'The Man in Black — American storytelling from Folsom Prison to American Recordings, bridging country, folk, and rock authenticity.',
    tracks: [
      { title: 'Ring of Fire', duration: '2:38' },
      { title: 'Folsom Prison Blues', duration: '2:50' },
      { title: 'I Walk the Line', duration: '2:45' },
      { title: 'Hurt', duration: '3:38' },
      { title: 'Jackson', duration: '2:46' },
      { title: 'Man in Black', duration: '2:52' },
    ],
    offset: [0.05, 0.15, -0.1],
    size: 1.28,
  },
  {
    id: slug('Dolly Parton'),
    name: 'Dolly Parton',
    genreId: 'country',
    subgenreId: 'country-country-pop',
    bio: 'Songwriting titan and cultural icon — Jolene, 9 to 5, and a career that spans Nashville stages to Hollywood and philanthropy.',
    tracks: [
      { title: 'Jolene', duration: '2:42' },
      { title: '9 to 5', duration: '2:43' },
      { title: 'I Will Always Love You', duration: '2:53' },
      { title: 'Coat of Many Colors', duration: '3:05' },
      { title: 'Here You Come Again', duration: '2:55' },
      { title: 'Islands in the Stream', duration: '4:09' },
    ],
    offset: [-0.4, 0.1, 0.35],
  },
  {
    id: slug('Luke Combs'),
    name: 'Luke Combs',
    genreId: 'country',
    subgenreId: 'country-contemporary',
    bio: 'North Carolina country star whose This One\'s for You and later albums delivered stadium-sized modern country anthems.',
    tracks: [
      { title: 'Beautiful Crazy', duration: '3:06' },
      { title: 'Hurricane', duration: '3:43' },
      { title: 'Beer Never Broke My Heart', duration: '3:07' },
      { title: 'When It Rains It Pours', duration: '4:02' },
      { title: 'Forever After All', duration: '3:52' },
      { title: 'She Got the Best of Me', duration: '3:17' },
    ],
    offset: [0.5, -0.25, 0.15],
  },
  {
    id: slug('Chris Stapleton'),
    name: 'Chris Stapleton',
    genreId: 'country',
    subgenreId: 'country-americana',
    bio: 'Kentucky singer-songwriter whose Traveller brought soulful, bluesy country back to the center of Nashville\'s mainstream.',
    tracks: [
      { title: 'Tennessee Whiskey', duration: '4:53' },
      { title: 'Starting Over', duration: '4:00' },
      { title: 'You Should Probably Leave', duration: '3:33' },
      { title: 'Broken Halos', duration: '3:01' },
      { title: 'White Horse', duration: '4:13' },
      { title: 'Parachute', duration: '4:13' },
    ],
    offset: [-0.25, 0.4, -0.4],
  },
  {
    id: slug('Shania Twain'),
    name: 'Shania Twain',
    genreId: 'country',
    subgenreId: 'country-country-pop',
    bio: 'Canadian country-pop trailblazer — Come On Over remains one of the best-selling albums ever, fusing Nashville with 1990s pop gloss.',
    tracks: [
      { title: 'Man! I Feel Like a Woman!', duration: '3:54' },
      { title: 'You\'re Still the One', duration: '3:33' },
      { title: 'That Don\'t Impress Me Much', duration: '3:38' },
      { title: 'From This Moment On', duration: '4:51' },
      { title: 'Any Man of Mine', duration: '4:06' },
      { title: 'Forever and for Always', duration: '4:03' },
    ],
    offset: [0.35, -0.35, -0.3],
  },
  {
    id: slug('Carrie Underwood'),
    name: 'Carrie Underwood',
    genreId: 'country',
    subgenreId: 'country-contemporary',
    bio: 'American Idol champion turned arena country powerhouse — Some Hearts launched a run of storytelling anthems and vocal fireworks.',
    tracks: [
      { title: 'Before He Cheats', duration: '3:19' },
      { title: 'Jesus, Take the Wheel', duration: '3:46' },
      { title: 'Cowboy Casanova', duration: '3:56' },
      { title: 'Blown Away', duration: '4:00' },
      { title: 'Church Bells', duration: '3:14' },
      { title: 'Undo It', duration: '2:57' },
    ],
    offset: [-0.5, -0.1, 0.05],
  },
  {
    id: slug('Willie Nelson'),
    name: 'Willie Nelson',
    genreId: 'country',
    subgenreId: 'country-outlaw',
    bio: 'Outlaw country architect — Red Headed Stranger, On the Road Again, and a career that made Texas songwriting a national language.',
    tracks: [
      { title: 'On the Road Again', duration: '2:33' },
      { title: 'Always on My Mind', duration: '3:33' },
      { title: 'Blue Eyes Crying in the Rain', duration: '2:21' },
      { title: 'Crazy', duration: '2:52' },
      { title: 'Mammas Don\'t Let Your Babies Grow Up to Be Cowboys', duration: '2:32' },
      { title: 'Angel Flying Too Close to the Ground', duration: '4:00' },
    ],
    offset: [0.15, 0.5, 0.45],
  },

  // —— Indie / Alt ——
  {
    id: slug('Radiohead'),
    name: 'Radiohead',
    genreId: 'indie',
    subgenreId: 'indie-post-punk',
    alsoIn: [{ genreId: 'rock' as const, subgenreId: 'rock-alternative' }],
    bio: 'Oxford experimentalists — OK Computer, Kid A, In Rainbows — who kept stretching alternative rock into electronic and art-rock frontiers.',
    tracks: [
      { title: 'Creep', duration: '3:58' },
      { title: 'Karma Police', duration: '4:21' },
      { title: 'Paranoid Android', duration: '6:23' },
      { title: 'No Surprises', duration: '3:48' },
      { title: 'Weird Fishes/Arpeggi', duration: '5:18' },
      { title: 'Everything in Its Right Place', duration: '4:11' },
    ],
    offset: [0.0, 0.2, -0.1],
    size: 1.28,
    edge: 0.66,
  },
  {
    id: slug('Tame Impala'),
    name: 'Tame Impala',
    genreId: 'indie',
    subgenreId: 'indie-dream-pop',
    alsoIn: [{ genreId: 'electronic' as const, subgenreId: 'electronic-synthwave' }],
    bio: 'Kevin Parker\'s psych-pop project from Australia — Currents and The Slow Rush brought lush, dance-leaning indie to festival main stages.',
    tracks: [
      { title: 'The Less I Know the Better', duration: '3:36' },
      { title: 'Borderline', duration: '3:57' },
      { title: 'Let It Happen', duration: '7:46' },
      { title: 'Elephant', duration: '3:31' },
      { title: 'Feels Like We Only Go Backwards', duration: '3:12' },
      { title: 'Lost in Yesterday', duration: '4:09' },
    ],
    offset: [-0.4, 0.05, 0.4],
  },
  {
    id: slug('Phoebe Bridgers'),
    name: 'Phoebe Bridgers',
    genreId: 'indie',
    subgenreId: 'indie-singer-songwriter',
    bio: 'L.A. indie songwriter whose Punisher and earlier Stranger in the Alps set a new bar for intimate, literate alternative folk-rock.',
    tracks: [
      { title: 'Motion Sickness', duration: '3:49' },
      { title: 'Kyoto', duration: '3:04' },
      { title: 'Funeral', duration: '3:43' },
      { title: 'Scott Street', duration: '5:05' },
      { title: 'I Know the End', duration: '5:44' },
      { title: 'Garden Song', duration: '3:39' },
    ],
    offset: [0.5, -0.25, 0.1],
  },
  {
    id: slug('The National'),
    name: 'The National',
    genreId: 'indie',
    subgenreId: 'indie-chamber',
    bio: 'Brooklyn (via Cincinnati) indie rock band — Boxer, High Violet, Trouble Will Find Me — known for baritone melancholy and orchestral builds.',
    tracks: [
      { title: 'Bloodbuzz Ohio', duration: '4:36' },
      { title: 'Fake Empire', duration: '3:25' },
      { title: 'I Need My Girl', duration: '4:05' },
      { title: 'About Today', duration: '4:10' },
      { title: 'The System Only Dreams in Total Darkness', duration: '3:56' },
      { title: 'Pink Rabbits', duration: '4:04' },
    ],
    offset: [-0.2, 0.45, -0.45],
  },
  {
    id: slug('Vampire Weekend'),
    name: 'Vampire Weekend',
    genreId: 'indie',
    subgenreId: 'indie-indie-pop',
    bio: 'Columbia-bred indie pop with African guitar colors — Vampire Weekend, Modern Vampires of the City, and Father of the Bride.',
    tracks: [
      { title: 'A-Punk', duration: '2:17' },
      { title: 'Harmony Hall', duration: '5:08' },
      { title: 'Oxford Comma', duration: '3:15' },
      { title: 'Diane Young', duration: '2:40' },
      { title: 'Step', duration: '4:11' },
      { title: 'Cape Cod Kwassa Kwassa', duration: '3:34' },
    ],
    offset: [0.35, -0.4, -0.3],
  },
  {
    id: slug('Lana Del Rey'),
    name: 'Lana Del Rey',
    genreId: 'indie',
    subgenreId: 'indie-dream-pop',
    bio: 'Cinematic Americana-pop auteur — Born to Die through Norman Fucking Rockwell! — shaping a generation\'s melancholic aesthetic.',
    tracks: [
      { title: 'Video Games', duration: '4:42' },
      { title: 'Summertime Sadness', duration: '4:25' },
      { title: 'Born to Die', duration: '4:46' },
      { title: 'Young and Beautiful', duration: '3:56' },
      { title: 'Brooklyn Baby', duration: '4:22' },
      { title: 'Say Yes to Heaven', duration: '3:29' },
    ],
    offset: [-0.5, -0.15, 0.05],
  },
  {
    id: slug('Bon Iver'),
    name: 'Bon Iver',
    genreId: 'indie',
    subgenreId: 'indie-singer-songwriter',
    bio: 'Justin Vernon\'s project — For Emma, Forever Ago to 22, A Million — turned cabin folk into genre-bending indie experimentation.',
    tracks: [
      { title: 'Skinny Love', duration: '3:58' },
      { title: 'Holocene', duration: '5:36' },
      { title: 'Hey, Ma', duration: '3:36' },
      { title: 'Blood Bank', duration: '4:45' },
      { title: '33 “GOD”', duration: '3:33' },
      { title: 'Wash.', duration: '4:58' },
    ],
    offset: [0.15, 0.5, 0.45],
  },

  // —— Metal ——
  {
    id: slug('Metallica'),
    name: 'Metallica',
    genreId: 'metal',
    subgenreId: 'metal-thrash',
    bio: 'Bay Area thrash titans — Master of Puppets, the Black Album — who took heavy metal from underground clubs to the world\'s biggest stages.',
    tracks: [
      { title: 'Enter Sandman', duration: '5:31' },
      { title: 'Master of Puppets', duration: '8:35' },
      { title: 'Nothing Else Matters', duration: '6:28' },
      { title: 'One', duration: '7:27' },
      { title: 'Seek & Destroy', duration: '6:55' },
      { title: 'Fade to Black', duration: '6:57' },
    ],
    offset: [0.0, 0.15, -0.1],
    size: 1.35,
  },
  {
    id: slug('Iron Maiden'),
    name: 'Iron Maiden',
    genreId: 'metal',
    subgenreId: 'metal-thrash',
    bio: 'British heavy metal institution — The Number of the Beast, Powerslave — twin-guitar gallop and Eddie mythology for generations.',
    tracks: [
      { title: 'The Trooper', duration: '4:11' },
      { title: 'Run to the Hills', duration: '3:54' },
      { title: 'Fear of the Dark', duration: '7:18' },
      { title: 'Hallowed Be Thy Name', duration: '7:12' },
      { title: 'Aces High', duration: '4:31' },
      { title: 'The Number of the Beast', duration: '4:50' },
    ],
    offset: [-0.45, 0.05, 0.35],
  },
  {
    id: slug('Black Sabbath'),
    name: 'Black Sabbath',
    genreId: 'metal',
    subgenreId: 'metal-doom',
    bio: 'Birmingham originators of heavy metal — Paranoid, Master of Reality — with Ozzy Osbourne\'s early years defining doom and riff culture.',
    tracks: [
      { title: 'Paranoid', duration: '2:48' },
      { title: 'Iron Man', duration: '5:56' },
      { title: 'War Pigs', duration: '7:57' },
      { title: 'N.I.B.', duration: '6:07' },
      { title: 'Children of the Grave', duration: '5:17' },
      { title: 'Sweet Leaf', duration: '5:05' },
    ],
    offset: [0.5, -0.25, 0.15],
  },
  {
    id: slug('Slipknot'),
    name: 'Slipknot',
    genreId: 'metal',
    subgenreId: 'metal-nu-metal',
    bio: 'Des Moines masked collective — Iowa and Vol. 3 — who brought nu-metal aggression and percussion chaos to mainstream rock radio.',
    tracks: [
      { title: 'Duality', duration: '4:12' },
      { title: 'Before I Forget', duration: '4:38' },
      { title: 'Psychosocial', duration: '4:44' },
      { title: 'Wait and Bleed', duration: '2:27' },
      { title: 'Snuff', duration: '4:36' },
      { title: 'The Devil in I', duration: '5:42' },
    ],
    offset: [-0.2, 0.4, -0.45],
  },
  {
    id: slug('System of a Down'),
    name: 'System of a Down',
    genreId: 'metal',
    subgenreId: 'metal-nu-metal',
    bio: 'Armenian-American alt-metal band — Toxicity, Mezmerize — mixing political fury, odd-time riffs, and Serj Tankian\'s wild vocal range.',
    tracks: [
      { title: 'Chop Suey!', duration: '3:30' },
      { title: 'Toxicity', duration: '3:38' },
      { title: 'Aerials', duration: '3:55' },
      { title: 'B.Y.O.B.', duration: '4:15' },
      { title: 'Lonely Day', duration: '2:47' },
      { title: 'Sugar', duration: '2:33' },
    ],
    offset: [0.35, -0.4, -0.3],
  },
  {
    id: slug('Tool'),
    name: 'Tool',
    genreId: 'metal',
    subgenreId: 'metal-prog-metal',
    bio: 'Progressive metal architects — Ænima, Lateralus, Fear Inoculum — known for polyrhythms, long-form compositions, and visual art synergy.',
    tracks: [
      { title: 'Schism', duration: '6:46' },
      { title: 'The Pot', duration: '6:21' },
      { title: 'Stinkfist', duration: '5:11' },
      { title: 'Forty Six & 2', duration: '6:04' },
      { title: 'Vicarious', duration: '7:06' },
      { title: 'Sober', duration: '5:06' },
    ],
    offset: [-0.5, -0.15, 0.05],
    edge: 0.78,
  },
  {
    id: slug('Rammstein'),
    name: 'Rammstein',
    genreId: 'metal',
    subgenreId: 'metal-industrial',
    bio: 'German industrial-metal titans — pyrotechnic live shows and Neue Deutsche Härte anthems from Herzeleid through Zeit.',
    tracks: [
      { title: 'Du Hast', duration: '3:55' },
      { title: 'Sonne', duration: '4:32' },
      { title: 'Engel', duration: '4:24' },
      { title: 'Ich Will', duration: '3:37' },
      { title: 'Feuer frei!', duration: '3:08' },
      { title: 'Deutschland', duration: '5:22' },
    ],
    offset: [0.2, 0.5, 0.45],
  },
]

/** Stable 0..1 hash from id (keeps layout deterministic across reloads). */
function hash01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

const NICHE_SUB_RE =
  /alternative|experimental|industrial|drill|synthwave|progressive|prog\b|ambient|doom|art[\s-]?pop|chamber|post[\s-]?punk|conscious|americana|fusion|nu[\s-]?metal|punk|dream[\s-]?pop|electropop|quiet[\s-]?storm|outlaw|bluegrass|brazilian|regional|bebop|techno|drum/
const CORE_SUB_RE =
  /teen[\s-]?pop|boom[\s-]?bap|classic[\s-]?rock|thrash|dance[\s-]?pop|house\b|gospel|cool\b|contemporary[\s-]?r|latin[\s-]?pop|country[\s-]?pop|indie[\s-]?pop|reggaeton|vocal[\s-]?jazz/

/**
 * How far from the genre center an artist should sit (0 = core/inward, 1 = niche/outer).
 * Prefer seed.edge override when automatic signals would mis-rank a flagship act.
 */
function computeEdgeFactor(
  seed: ArtistSeed,
  sub: Subgenre,
  isSecondary: boolean,
): number {
  if (typeof seed.edge === 'number' && Number.isFinite(seed.edge)) {
    return Math.max(0.04, Math.min(0.96, seed.edge))
  }

  let score = 0.34
  const alsoCount = (seed.alsoIn ?? []).length
  const size = seed.size ?? 0.95 + Math.abs(seed.offset[0] + seed.offset[1] + seed.offset[2]) * 0.15

  // Genre-bending: alsoIn tags push outward (dampened for oversized mainstream stars)
  let alsoBoost = Math.min(alsoCount, 3) * 0.14
  if (size >= 1.28) alsoBoost *= 0.32
  else if (size >= 1.12) alsoBoost *= 0.55
  score += alsoBoost

  // Open-catalog tag diversity → niche / cross-genre
  const tags = seed.open?.genreTags?.length ?? 0
  if (tags >= 4) score += 0.16
  else if (tags >= 3) score += 0.11
  else if (tags >= 2) score += 0.06
  if (seed.open) score += 0.08 // indie V4V catalog leans niche vs sample megastars

  // Larger stars ≈ more central / mainstream
  if (size >= 1.32) score -= 0.24
  else if (size >= 1.22) score -= 0.16
  else if (size >= 1.1) score -= 0.08
  else if (size <= 0.85) score += 0.1

  const subKey = `${sub.id} ${sub.name}`.toLowerCase()
  if (NICHE_SUB_RE.test(subKey)) score += 0.17
  if (CORE_SUB_RE.test(subKey)) score -= 0.13

  // Secondary alsoIn instances sit toward the rim of those clusters
  if (isSecondary) score += 0.18

  // Tiny hash jitter so artists don't collapse onto one ring
  score += (hash01(seed.id + (isSecondary ? ':sec' : '')) - 0.5) * 0.07

  return Math.max(0.05, Math.min(0.95, score))
}

function placeAtSubgenre(
  seed: ArtistSeed,
  sub: Subgenre,
  instanceId: string,
  alsoIn: ArtistAlsoIn[],
  isSecondary = false,
): Artist {
  const [ox, oy, oz] = seed.offset
  const parent = GENRE_BY_ID[sub.parentId]
  const edge = computeEdgeFactor(seed, sub, isSecondary)

  // Pull along genre→subgenre axis: core near genre center, niche near cluster fringe
  const pull = 0.22 + edge * 0.88 // ~0.22..1.10 of the way to (and past) the subgenre orbit
  const baseX = parent.center[0] + (sub.center[0] - parent.center[0]) * pull
  const baseY = parent.center[1] + (sub.center[1] - parent.center[1]) * pull
  const baseZ = parent.center[2] + (sub.center[2] - parent.center[2]) * pull

  // Keep local subgenre clustering; niche artists get a slightly wider local spread
  const localR = sub.radius * (0.38 + edge * 0.42)
  let x = baseX + ox * localR
  let y = baseY + oy * localR * 0.7
  let z = baseZ + oz * localR

  // Genre-benders: bias toward a neighboring alsoIn genre on the shell (border feel)
  const bendTargets = alsoIn.filter((a) => a.genreId !== sub.parentId)
  if (bendTargets.length > 0) {
    const other = GENRE_BY_ID[bendTargets[0].genreId]
    if (other) {
      const bias = (0.1 + edge * 0.12) * (isSecondary ? 0.55 : 1)
      x += (other.center[0] - parent.center[0]) * bias * 0.12
      y += (other.center[1] - parent.center[1]) * bias * 0.12
      z += (other.center[2] - parent.center[2]) * bias * 0.12
    }
  }

  // Soft clamp distance from genre center into [inner, outer] fringe band
  const dx = x - parent.center[0]
  const dy = y - parent.center[1]
  const dz = z - parent.center[2]
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  const minR = parent.radius * (0.18 + edge * 0.12)
  const maxR = parent.radius * (0.55 + edge * 0.42) // high edge → near GENRE_CLUSTER_RADIUS
  const targetR = Math.max(minR, Math.min(maxR, dist))
  // Blend toward targetR so we don't destroy local offsets entirely
  const scale = (dist * 0.35 + targetR * 0.65) / dist
  x = parent.center[0] + dx * scale
  y = parent.center[1] + dy * scale
  z = parent.center[2] + dz * scale

  return {
    id: instanceId,
    baseId: seed.id,
    name: seed.name,
    genre: parent.name,
    genreId: sub.parentId,
    subgenreId: sub.id,
    subgenre: sub.name,
    alsoIn,
    bio: seed.bio,
    tracks: seed.tracks,
    color: sub.color,
    size: seed.size ?? 0.95 + Math.abs(ox + oy + oz) * 0.15,
    offset: seed.offset,
    position: [x, y, z],
    audio: { ...sub.audio },
    open: seed.open,
    memorial: MEMORIALS[seed.id],
    showBalance: false,
    deceased: !!MEMORIALS[seed.id],
    deathYear: MEMORIALS[seed.id] ? Number(MEMORIALS[seed.id].diedOn.slice(0, 4)) : undefined,
    isNew: DEMO_NEW_ARTIST_IDS.has(seed.id),
    stage: MEMORIALS[seed.id] ? 'dead' : DEMO_NEW_ARTIST_IDS.has(seed.id) ? 'protostar' : 'star',
    remnant: MEMORIALS[seed.id] ? (SUPERNOVA_REMNANTS.has(seed.id) ? 'supernova' : 'nebula') : undefined,
  }
}

function expandSeeds(list: ArtistSeed[]): Artist[] {
  const out: Artist[] = []
  for (const seed of list) {
    const primary = SUBGENRE_BY_ID[seed.subgenreId]
    if (!primary) throw new Error(`Unknown subgenre ${seed.subgenreId} for ${seed.id}`)
    const alsoIn = seed.alsoIn ?? []
    out.push(placeAtSubgenre(seed, primary, seed.id, alsoIn, false))
    // Secondary star instances in other clusters — same profile (baseId), rim-biased
    for (const extra of alsoIn) {
      const sub = SUBGENRE_BY_ID[extra.subgenreId]
      if (!sub) throw new Error(`Unknown alsoIn subgenre ${extra.subgenreId} for ${seed.id}`)
      const nudged: ArtistSeed = {
        ...seed,
        // Drop primary edge override so secondary uses rim-biased auto score
        edge: seed.edge != null ? Math.min(0.92, Math.max(0.55, seed.edge + 0.25)) : undefined,
        offset: [
          seed.offset[0] * -0.7 + 0.15,
          seed.offset[1] * 0.6 - 0.1,
          seed.offset[2] * -0.55 + 0.2,
        ],
        size: (seed.size ?? 1) * 0.92,
      }
      out.push(placeAtSubgenre(nudged, sub, `${seed.id}__${extra.subgenreId}`, alsoIn, true))
    }
  }
  return out
}

type OpenCatalogArtist = {
  id: string
  name: string
  sources: CatalogSource[]
  genreId: GenreId
  subgenreId: string
  genreTags: string[]
  bio: string
  image: string
  links: { label: string; url: string }[]
  pay: PayInfo
  tracks: Track[]
  offset: [number, number, number]
}

export const OPEN_CATALOG_STATS = (openCatalog as unknown as { stats: Record<string, unknown> }).stats

function openSeeds(): ArtistSeed[] {
  const taken = new Set(seeds.map((s) => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '')))
  const out: ArtistSeed[] = []
  let newCount = 0
  for (const a of (openCatalog as unknown as { artists: OpenCatalogArtist[] }).artists) {
    if (!SUBGENRE_BY_ID[a.subgenreId]) continue
    if (taken.has(a.name.toLowerCase().replace(/[^a-z0-9]+/g, ''))) continue // dedupe vs built-in sample artists
    out.push({
      id: a.id,
      name: a.name,
      genreId: a.genreId,
      subgenreId: a.subgenreId,
      bio: a.bio,
      tracks: a.tracks,
      offset: a.offset,
      size: 0.75,
      open: { sources: a.sources, image: a.image, links: a.links, pay: a.pay, genreTags: a.genreTags },
    })
    // Demo: the first few indie catalog artists in different genres act as "just signed up" protostars.
    if (newCount < 5 && ![...DEMO_NEW_ARTIST_IDS].some((id) => out.find((o) => o.id === id)?.genreId === a.genreId)) {
      DEMO_NEW_ARTIST_IDS.add(a.id); newCount++
    }
  }
  return out
}

export const ARTISTS: Artist[] = expandSeeds([...(seeds as ArtistSeed[]), ...openSeeds()])

/** Unique profiles (primary instances only). */
export const ARTIST_PROFILES: Artist[] = ARTISTS.filter((a) => a.id === a.baseId)

const PROFILE_BY_BASE: Record<string, Artist> = Object.fromEntries(
  ARTIST_PROFILES.map((a) => [a.baseId, a]),
)

/** Resolve mesh/instance id → profile artist (strips `__subgenre` suffix). */
export function getArtistProfile(id: string): Artist {
  const base = id.includes('__') ? id.slice(0, id.indexOf('__')) : id
  const profile = PROFILE_BY_BASE[base]
  if (profile) return profile
  const hit = ARTISTS.find((a) => a.id === id || a.baseId === base)
  if (!hit) throw new Error(`Unknown artist ${id}`)
  return hit
}

export function baseArtistId(id: string): string {
  return id.includes('__') ? id.slice(0, id.indexOf('__')) : id
}

export const HEARING_RADIUS = 32
export const PICK_RADIUS = 2.4
export const GENRE_LABEL_RADIUS = 48
