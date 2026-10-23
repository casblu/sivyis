/** Philosophy visuals — local public/philosophy assets (PD portraits + Cosmoly diagrams). */

export type PhilImage = {
  src: string
  alt: string
  credit: string
}

/** Portraits keyed by display name fragment used in DEEP_ENTRIES.philosophers */
export const PORTRAIT_BY_NAME: Record<string, PhilImage> = {
  Pythagoras: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/pythagoras.jpg',
    alt: 'Pythagoras (detail from Raphael, School of Athens)',
    credit: 'Public domain — Wikimedia (Raphael detail)',
  },
  Plato: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/plato.jpg',
    alt: 'Bust of Plato, Capitoline Museums',
    credit: 'Public domain — Wikimedia',
  },
  Aristotle: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/aristotle.jpg',
    alt: 'Bust of Aristotle, Palazzo Altemps',
    credit: 'Public domain — Wikimedia',
  },
  Confucius: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/confucius.jpg',
    alt: 'Confucius, Tang Dynasty portrait tradition',
    credit: 'Public domain — Wikimedia',
  },
  'al-Fārābī': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/farabi.jpg',
    alt: 'Depiction of al-Fārābī',
    credit: 'Public domain — Wikimedia',
  },
  'al-Farabi': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/farabi.jpg',
    alt: 'Depiction of al-Fārābī',
    credit: 'Public domain — Wikimedia',
  },
  'Arthur Schopenhauer': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/schopenhauer.jpg',
    alt: 'Portrait of Arthur Schopenhauer',
    credit: 'Public domain — Wikimedia',
  },
  Schopenhauer: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/schopenhauer.jpg',
    alt: 'Portrait of Arthur Schopenhauer',
    credit: 'Public domain — Wikimedia',
  },
  'Friedrich Nietzsche': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/nietzsche.jpg',
    alt: 'Portrait of Friedrich Nietzsche',
    credit: 'Public domain — Wikimedia',
  },
  Nietzsche: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/nietzsche.jpg',
    alt: 'Portrait of Friedrich Nietzsche',
    credit: 'Public domain — Wikimedia',
  },
  Boethius: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/boethius.jpg',
    alt: 'Medieval illumination of Boethius',
    credit: 'Public domain — Wikimedia',
  },
  'Eduard Hanslick': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/hanslick.svg',
    alt: 'Stylized illustration of Eduard Hanslick',
    credit: 'Cosmoly stylized illustration',
  },
  Hanslick: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/hanslick.svg',
    alt: 'Stylized illustration of Eduard Hanslick',
    credit: 'Cosmoly stylized illustration',
  },
  'Susanne Langer': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/langer.svg',
    alt: 'Stylized illustration of Susanne Langer',
    credit: 'Cosmoly stylized illustration',
  },
  'Theodor W. Adorno': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/adorno.svg',
    alt: 'Stylized illustration of Theodor Adorno',
    credit: 'Cosmoly stylized illustration',
  },
  Adorno: {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/adorno.svg',
    alt: 'Stylized illustration of Theodor Adorno',
    credit: 'Cosmoly stylized illustration',
  },
  'Maurice Merleau-Ponty': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/merleau-ponty.svg',
    alt: 'Stylized illustration of Merleau-Ponty',
    credit: 'Cosmoly stylized illustration',
  },
  'Sun Ra (artist-philosopher)': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/sun-ra.svg',
    alt: 'Stylized illustration of Sun Ra',
    credit: 'Cosmoly stylized illustration',
  },
  'Sun Ra': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/sun-ra.svg',
    alt: 'Stylized illustration of Sun Ra',
    credit: 'Cosmoly stylized illustration',
  },
  'Marc Leman': {
    src: import.meta.env.BASE_URL + 'philosophy/portraits/leman.svg',
    alt: 'Stylized illustration of Marc Leman',
    credit: 'Cosmoly stylized illustration',
  },
}

export const DIAGRAMS: Record<string, PhilImage> = {
  modes: {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/modes.svg',
    alt: 'Chart of seven Western modes from Ionian to Locrian',
    credit: 'Cosmoly diagram',
  },
  'circle-of-fifths': {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/circle-of-fifths.svg',
    alt: 'Circle of fifths with major and relative minor keys',
    credit: 'Cosmoly diagram',
  },
  'pythagorean-ratios': {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/pythagorean-ratios.svg',
    alt: 'Monochord showing Pythagorean interval ratios',
    credit: 'Cosmoly diagram',
  },
  tetrachord: {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/tetrachord.svg',
    alt: 'Tetrachord structure and conjunct octave',
    credit: 'Cosmoly diagram',
  },
  'overtone-series': {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/overtone-series.svg',
    alt: 'Overtone / harmonic series partials',
    credit: 'Cosmoly diagram',
  },
  hexachord: {
    src: import.meta.env.BASE_URL + 'philosophy/diagrams/hexachord.svg',
    alt: 'Guidonian hexachord solmization syllables',
    credit: 'Cosmoly diagram',
  },
}

/** Primary portrait + optional diagram for each Philosophy Web deep-entry id */
export const ENTRY_VISUALS: Record<
  string,
  { portraits: string[]; diagram?: keyof typeof DIAGRAMS }
> = {
  pythagorean: { portraits: ['Pythagoras', 'Boethius'], diagram: 'pythagorean-ratios' },
  platonic: { portraits: ['Plato', 'Aristotle'], diagram: 'modes' },
  confucian: { portraits: ['Confucius'] },
  'islamic-golden': { portraits: ['al-Fārābī'] },
  schopenhauer: { portraits: ['Arthur Schopenhauer', 'Friedrich Nietzsche'] },
  formalism: { portraits: ['Eduard Hanslick'], diagram: 'circle-of-fifths' },
  expressionism: { portraits: ['Susanne Langer'] },
  adorno: { portraits: ['Theodor W. Adorno'] },
  phenomenology: { portraits: ['Maurice Merleau-Ponty'] },
  embodied: { portraits: ['Marc Leman'], diagram: 'overtone-series' },
  afrofuturism: { portraits: ['Sun Ra'] },
}

export function resolvePortrait(name: string): PhilImage | undefined {
  if (PORTRAIT_BY_NAME[name]) return PORTRAIT_BY_NAME[name]
  // fuzzy: match if name starts with a known key or contains it
  for (const [key, img] of Object.entries(PORTRAIT_BY_NAME)) {
    if (name.startsWith(key) || name.includes(key)) return img
  }
  return undefined
}

export function figureHtml(img: PhilImage, extraClass = ''): string {
  return `<figure class="phil-figure ${extraClass}">
    <img src="${img.src}" alt="${escapeAttr(img.alt)}" loading="lazy" decoding="async" />
    <figcaption>${escapeAttr(img.credit)}</figcaption>
  </figure>`
}

export function portraitCardHtml(name: string, img: PhilImage): string {
  return `<figure class="phil-portrait">
    <img src="${img.src}" alt="${escapeAttr(img.alt)}" loading="lazy" decoding="async" />
    <figcaption><strong>${escapeAttr(name)}</strong><span>${escapeAttr(img.credit)}</span></figcaption>
  </figure>`
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
