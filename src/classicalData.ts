/**
 * Classical outer shell — a gigantic spherical layer of smoke/dust far beyond
 * every popular-genre nebula. Regions on the sphere = historical periods;
 * subgenres sit inside their period regions. Pure data (no three.js).
 */
import { fibonacciSphere } from './genreBall.ts'

/** Shell mid-radius (existing genre ball is r≈92, overview orbit ≈252). */
export const CLASSICAL_SHELL_RADIUS = 1400
/** Half thickness of the smoke band. */
export const CLASSICAL_SHELL_HALF = 140
/** Free-flight limit — open space beyond the shell. */
export const WORLD_MAX_RADIUS = 2700

export type ClassicalPeriod = {
  id: string
  name: string
  years: string
  color: number
  dir: [number, number, number]
}

const P = [
  ['medieval', 'Medieval', '500–1400', 0xc9a14a],
  ['renaissance', 'Renaissance', '1400–1600', 0x6fbf73],
  ['baroque', 'Baroque', '1600–1750', 0xe0663a],
  ['classical-era', 'Classical Era', '1750–1820', 0x7fb6ff],
  ['romantic', 'Romantic', '1820–1910', 0xd44c8a],
  ['modern', 'Modern / 20th c.', '1900–1975', 0x8a5cff],
  ['contemporary', 'Contemporary', '1975–now', 0x3fe0d0],
] as const

const DIRS = fibonacciSphere(P.length, 1)

export const CLASSICAL_PERIODS: ClassicalPeriod[] = P.map(([id, name, years, color], i) => ({
  id, name, years, color, dir: DIRS[i],
}))

export type ClassicalSub = { id: string; name: string; periodId: string; color: number; dir: [number, number, number] }

const SUBS: [string, string][] = [
  ['Gregorian Chant', 'medieval'], ['Troubadour & Ars Nova', 'medieval'],
  ['Choral Polyphony', 'renaissance'], ['Lute & Consort', 'renaissance'],
  ['Opera (Baroque)', 'baroque'], ['Concerto & Keyboard', 'baroque'],
  ['Symphonic', 'classical-era'], ['Chamber', 'classical-era'], ['Opera (Classical)', 'classical-era'],
  ['Solo Piano', 'romantic'], ['Romantic Symphonic', 'romantic'], ['Romantic Opera', 'romantic'], ['Ballet', 'romantic'],
  ['Impressionism', 'modern'], ['Modernism', 'modern'],
  ['Minimalism', 'contemporary'], ['Holy Minimalism', 'contemporary'], ['Film Score', 'contemporary'], ['Neo-Classical', 'contemporary'],
]

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
function h01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}
export { h01 as classicalHash }

export const CLASSICAL_SUBS: ClassicalSub[] = SUBS.map(([name, periodId]) => {
  const p = CLASSICAL_PERIODS.find((x) => x.id === periodId)!
  const id = 'classical-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
  // Jitter ~0.3 rad within the period region
  const j = (k: string) => (h01(id + k) - 0.5) * 0.6
  const dir = norm([p.dir[0] + j('x'), p.dir[1] + j('y'), p.dir[2] + j('z')])
  return { id, name, periodId, color: p.color, dir }
})

export type ComposerSeed = { name: string; sub: string; bio: string; works: string[]; size?: number; died?: number }

const s = (n: string) => 'classical-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')

export const COMPOSERS: ComposerSeed[] = [
  { name: 'Hildegard von Bingen', sub: s('Gregorian Chant'), died: 1179, bio: 'German abbess, mystic and composer whose soaring monophonic chants are among the earliest music by a named composer.', works: ['O vis aeternitatis', 'Ordo Virtutum', 'O frondens virga'] },
  { name: 'Guillaume de Machaut', sub: s('Troubadour & Ars Nova'), died: 1377, bio: 'Leading poet-composer of the French Ars Nova; his Messe de Nostre Dame is the first complete polyphonic Mass by one composer.', works: ['Messe de Nostre Dame', 'Ma fin est mon commencement', 'Douce dame jolie'] },
  { name: 'Pérotin', sub: s('Gregorian Chant'), died: 1238, bio: 'Notre-Dame school master who expanded organum into towering four-voice polyphony.', works: ['Viderunt omnes', 'Sederunt principes'] },
  { name: 'Giovanni Pierluigi da Palestrina', sub: s('Choral Polyphony'), died: 1594, size: 1.2, bio: 'Roman master of Renaissance sacred polyphony; his smooth counterpoint became the textbook model for centuries.', works: ['Missa Papae Marcelli', 'Sicut cervus', 'Stabat Mater'] },
  { name: 'Josquin des Prez', sub: s('Choral Polyphony'), died: 1521, bio: 'Franco-Flemish composer celebrated as the greatest of his age for expressive, imitative motets and masses.', works: ['Ave Maria… virgo serena', 'Missa Pange lingua', 'Mille regretz'] },
  { name: 'Thomas Tallis', sub: s('Choral Polyphony'), died: 1585, bio: 'English Tudor composer of the 40-voice motet Spem in alium.', works: ['Spem in alium', 'If ye love me', 'Lamentations of Jeremiah'] },
  { name: 'John Dowland', sub: s('Lute & Consort'), died: 1626, bio: 'English lutenist-songwriter of melancholy ayres.', works: ['Flow, my tears', 'Lachrimae', 'Come again'] },
  { name: 'Johann Sebastian Bach', sub: s('Concerto & Keyboard'), died: 1750, size: 1.45, bio: 'German Baroque giant of counterpoint — the Brandenburg Concertos, Well-Tempered Clavier, Mass in B minor and the Passions.', works: ['Brandenburg Concerto No. 3', 'Cello Suite No. 1', 'Toccata and Fugue in D minor', 'Goldberg Variations'] },
  { name: 'Antonio Vivaldi', sub: s('Concerto & Keyboard'), died: 1741, size: 1.3, bio: 'Venetian violinist-priest who defined the Baroque concerto; The Four Seasons is one of the most played works ever.', works: ['The Four Seasons: Spring', 'The Four Seasons: Winter', 'Gloria in D'] },
  { name: 'George Frideric Handel', sub: s('Opera (Baroque)'), died: 1759, size: 1.25, bio: 'German-British composer of Italian opera and English oratorio, from Messiah to Water Music.', works: ['Messiah: Hallelujah', 'Water Music', 'Lascia ch\'io pianga'] },
  { name: 'Claudio Monteverdi', sub: s('Opera (Baroque)'), died: 1643, bio: 'Bridge from Renaissance to Baroque whose L\'Orfeo is the earliest opera still regularly staged.', works: ['L\'Orfeo', 'Vespro della Beata Vergine', 'Lamento della ninfa'] },
  { name: 'Wolfgang Amadeus Mozart', sub: s('Opera (Classical)'), died: 1791, size: 1.45, bio: 'Salzburg prodigy who wrote 600+ works across opera, symphony, concerto and chamber music.', works: ['Eine kleine Nachtmusik', 'Symphony No. 40', 'The Magic Flute: Queen of the Night', 'Requiem: Lacrimosa'] },
  { name: 'Joseph Haydn', sub: s('Chamber'), died: 1809, size: 1.2, bio: '"Father of the symphony and string quartet," who shaped Classical-era forms at Esterháza.', works: ['Surprise Symphony', 'Emperor Quartet', 'The Creation'] },
  { name: 'Ludwig van Beethoven', sub: s('Symphonic'), died: 1827, size: 1.5, bio: 'Bonn-born composer who carried Classical form into the Romantic age; nine symphonies, 32 piano sonatas, deafness and defiance.', works: ['Symphony No. 5', 'Symphony No. 9: Ode to Joy', 'Moonlight Sonata', 'Für Elise'] },
  { name: 'Frédéric Chopin', sub: s('Solo Piano'), died: 1849, size: 1.3, bio: 'Polish-French poet of the piano — nocturnes, études, ballades and mazurkas.', works: ['Nocturne Op. 9 No. 2', 'Ballade No. 1', 'Revolutionary Étude'] },
  { name: 'Franz Liszt', sub: s('Solo Piano'), died: 1886, bio: 'Hungarian virtuoso who invented the solo recital and the symphonic poem.', works: ['Liebestraum No. 3', 'La Campanella', 'Hungarian Rhapsody No. 2'] },
  { name: 'Pyotr Ilyich Tchaikovsky', sub: s('Ballet'), died: 1893, size: 1.35, bio: 'Russian Romantic of sweeping melody: Swan Lake, The Nutcracker, the 1812 Overture.', works: ['Swan Lake', 'The Nutcracker: Dance of the Sugar Plum Fairy', '1812 Overture'] },
  { name: 'Johannes Brahms', sub: s('Romantic Symphonic'), died: 1897, bio: 'German Romantic who fused Classical structure with rich warmth.', works: ['Hungarian Dance No. 5', 'Symphony No. 4', 'Lullaby'] },
  { name: 'Giuseppe Verdi', sub: s('Romantic Opera'), died: 1901, size: 1.25, bio: 'Italian opera titan — La traviata, Rigoletto, Aida.', works: ['La donna è mobile', 'Va, pensiero', 'Aida: Triumphal March'] },
  { name: 'Richard Wagner', sub: s('Romantic Opera'), died: 1883, bio: 'German creator of the music drama and the four-opera Ring cycle.', works: ['Ride of the Valkyries', 'Tristan und Isolde: Prelude'] },
  { name: 'Claude Debussy', sub: s('Impressionism'), died: 1918, size: 1.3, bio: 'French composer of shimmering harmony and color.', works: ['Clair de lune', 'Prélude à l\'après-midi d\'un faune', 'La mer'] },
  { name: 'Maurice Ravel', sub: s('Impressionism'), died: 1937, bio: 'French master orchestrator of Boléro and Daphnis et Chloé.', works: ['Boléro', 'Pavane pour une infante défunte'] },
  { name: 'Igor Stravinsky', sub: s('Modernism'), died: 1971, size: 1.3, bio: 'Russian-born modernist whose Rite of Spring caused a riot in 1913.', works: ['The Rite of Spring', 'The Firebird', 'Petrushka'] },
  { name: 'Dmitri Shostakovich', sub: s('Modernism'), died: 1975, bio: 'Soviet symphonist whose music carries irony and grief under censorship.', works: ['Symphony No. 5', 'Waltz No. 2', 'String Quartet No. 8'] },
  { name: 'Philip Glass', sub: s('Minimalism'), size: 1.2, bio: 'American minimalist of repeating arpeggios, operas and film scores.', works: ['Metamorphosis One', 'Glassworks: Opening', 'Einstein on the Beach: Knee Play 1'] },
  { name: 'Steve Reich', sub: s('Minimalism'), bio: 'American pioneer of phasing and pulse.', works: ['Music for 18 Musicians', 'Clapping Music', 'Different Trains'] },
  { name: 'Arvo Pärt', sub: s('Holy Minimalism'), size: 1.15, bio: 'Estonian composer of luminous tintinnabuli stillness.', works: ['Spiegel im Spiegel', 'Fratres', 'Für Alina'] },
  { name: 'John Williams', sub: s('Film Score'), size: 1.25, bio: 'American composer of Star Wars, Jaws and Jurassic Park.', works: ['Star Wars Main Title', 'Jurassic Park Theme', 'Hedwig\'s Theme'] },
  { name: 'Hans Zimmer', sub: s('Film Score'), bio: 'German film composer of Interstellar, Inception and The Lion King.', works: ['Time', 'Cornfield Chase', 'Now We Are Free'] },
  { name: 'Ludovico Einaudi', sub: s('Neo-Classical'), bio: 'Italian pianist-composer of intimate neo-classical piano.', works: ['Nuvole Bianche', 'Experience', 'Una Mattina'] },
  { name: 'Max Richter', sub: s('Neo-Classical'), bio: 'German-British composer bridging minimalism and electronics.', works: ['On the Nature of Daylight', 'Recomposed: Spring 1', 'Sleep'] },
]
