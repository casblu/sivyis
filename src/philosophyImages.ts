/** Philosophy visuals — local public/philosophy assets (PD portraits + Cosmoly diagrams). */

export type PhilImage = {
  src: string
  alt: string
  credit: string
}

/** Portraits keyed by display name fragment used in DEEP_ENTRIES.philosophers */
export const PORTRAIT_BY_NAME: Record<string, PhilImage> = {
  Pythagoras: {
    src: './philosophy/portraits/pythagoras.jpg',
    alt: 'Pythagoras (detail from Raphael, School of Athens)',
    credit: 'Public domain — Wikimedia (Raphael detail)',
  },
  Plato: {
    src: './philosophy/portraits/plato.svg',
    alt: 'Bust of Plato, Capitoline Museums',
    credit: 'Placeholder — portrait pending license check',
  },
  Aristotle: {
    src: './philosophy/portraits/aristotle.svg',
    alt: 'Bust of Aristotle, Palazzo Altemps',
    credit: 'Placeholder — portrait pending license check',
  },
  Confucius: {
    src: './philosophy/portraits/confucius.svg',
    alt: 'Confucius, Tang Dynasty portrait tradition',
    credit: 'Placeholder — portrait pending license check',
  },
  'al-Fārābī': {
    src: './philosophy/portraits/farabi.svg',
    alt: 'Depiction of al-Fārābī',
    credit: 'Placeholder — portrait pending license check',
  },
  'al-Farabi': {
    src: './philosophy/portraits/farabi.svg',
    alt: 'Depiction of al-Fārābī',
    credit: 'Placeholder — portrait pending license check',
  },
  'Arthur Schopenhauer': {
    src: './philosophy/portraits/schopenhauer.svg',
    alt: 'Portrait of Arthur Schopenhauer',
    credit: 'Placeholder — portrait pending license check',
  },
  Schopenhauer: {
    src: './philosophy/portraits/schopenhauer.svg',
    alt: 'Portrait of Arthur Schopenhauer',
    credit: 'Placeholder — portrait pending license check',
  },
  'Friedrich Nietzsche': {
    src: './philosophy/portraits/nietzsche.svg',
    alt: 'Portrait of Friedrich Nietzsche',
    credit: 'Placeholder — portrait pending license check',
  },
  Nietzsche: {
    src: './philosophy/portraits/nietzsche.svg',
    alt: 'Portrait of Friedrich Nietzsche',
    credit: 'Placeholder — portrait pending license check',
  },
  Boethius: {
    src: './philosophy/portraits/boethius.svg',
    alt: 'Medieval illumination of Boethius',
    credit: 'Placeholder — portrait pending license check',
  },
  'Eduard Hanslick': {
    src: './philosophy/portraits/hanslick.svg',
    alt: 'Stylized illustration of Eduard Hanslick',
    credit: 'Cosmoly stylized illustration',
  },
  Hanslick: {
    src: './philosophy/portraits/hanslick.svg',
    alt: 'Stylized illustration of Eduard Hanslick',
    credit: 'Cosmoly stylized illustration',
  },
  'Susanne Langer': {
    src: './philosophy/portraits/langer.svg',
    alt: 'Stylized illustration of Susanne Langer',
    credit: 'Cosmoly stylized illustration',
  },
  'Theodor W. Adorno': {
    src: './philosophy/portraits/adorno.svg',
    alt: 'Stylized illustration of Theodor Adorno',
    credit: 'Cosmoly stylized illustration',
  },
  Adorno: {
    src: './philosophy/portraits/adorno.svg',
    alt: 'Stylized illustration of Theodor Adorno',
    credit: 'Cosmoly stylized illustration',
  },
  'Maurice Merleau-Ponty': {
    src: './philosophy/portraits/merleau-ponty.svg',
    alt: 'Stylized illustration of Merleau-Ponty',
    credit: 'Cosmoly stylized illustration',
  },
  'Sun Ra (artist-philosopher)': {
    src: './philosophy/portraits/sun-ra.svg',
    alt: 'Stylized illustration of Sun Ra',
    credit: 'Cosmoly stylized illustration',
  },
  'Sun Ra': {
    src: './philosophy/portraits/sun-ra.svg',
    alt: 'Stylized illustration of Sun Ra',
    credit: 'Cosmoly stylized illustration',
  },
  'Marc Leman': {
    src: './philosophy/portraits/leman.svg',
    alt: 'Stylized illustration of Marc Leman',
    credit: 'Cosmoly stylized illustration',
  },
}

export const DIAGRAMS: Record<string, PhilImage> = {
  modes: {
    src: './philosophy/diagrams/modes.svg',
    alt: 'Chart of seven Western modes from Ionian to Locrian',
    credit: 'Cosmoly diagram',
  },
  'circle-of-fifths': {
    src: './philosophy/diagrams/circle-of-fifths.svg',
    alt: 'Circle of fifths with major and relative minor keys',
    credit: 'Cosmoly diagram',
  },
  'pythagorean-ratios': {
    src: './philosophy/diagrams/pythagorean-ratios.svg',
    alt: 'Monochord showing Pythagorean interval ratios',
    credit: 'Cosmoly diagram',
  },
  tetrachord: {
    src: './philosophy/diagrams/tetrachord.svg',
    alt: 'Tetrachord structure and conjunct octave',
    credit: 'Cosmoly diagram',
  },
  'overtone-series': {
    src: './philosophy/diagrams/overtone-series.svg',
    alt: 'Overtone / harmonic series partials',
    credit: 'Cosmoly diagram',
  },
  hexachord: {
    src: './philosophy/diagrams/hexachord.svg',
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
