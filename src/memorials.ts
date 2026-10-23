/**
 * Memorial stars — artists who have died in real life render as dead stars (planetary nebula / supernova remnant).
 * To add one: append an entry keyed by the artist's id (slug of their name, e.g. 'dolly-parton').
 * Always cite at least one reliable source (official site / AP / Reuters).
 */
export type Memorial = {
  /** ISO date YYYY-MM-DD */
  bornOn: string
  /** ISO date YYYY-MM-DD */
  diedOn: string
  place?: string
  sources: { label: string; url: string }[]
}

export const MEMORIALS: Record<string, Memorial> = {
  'dolly-parton': {
    bornOn: '1946-01-19',
    diedOn: '2026-08-25',
    place: 'Nashville, Tennessee',
    sources: [
      { label: 'dollyparton.com official announcement', url: 'https://www.dollyparton.com/news/official-announcement-dolly-parton-passes-away-at-80' },
      { label: 'AP News', url: 'https://apnews.com/article/dolly-parton-death-country-icon-87156f3e6a1547b88bf414529b644ad3' },
    ],
  },
  'aretha-franklin': {
    bornOn: '1942-03-25',
    diedOn: '2018-08-16',
    sources: [{ label: 'Wikidata Q125121 (date of death)', url: 'https://www.wikidata.org/wiki/Q125121' }],
  },
  'avicii': {
    bornOn: '1989-09-08',
    diedOn: '2018-04-20',
    sources: [{ label: 'Wikidata Q505476 (date of death)', url: 'https://www.wikidata.org/wiki/Q505476' }],
  },
  'miles-davis': {
    bornOn: '1926-05-26',
    diedOn: '1991-09-28',
    sources: [{ label: 'Wikidata Q93341 (date of death)', url: 'https://www.wikidata.org/wiki/Q93341' }],
  },
  'john-coltrane': {
    bornOn: '1926-09-23',
    diedOn: '1967-07-17',
    sources: [{ label: 'Wikidata Q7346 (date of death)', url: 'https://www.wikidata.org/wiki/Q7346' }],
  },
  'ella-fitzgerald': {
    bornOn: '1917-04-25',
    diedOn: '1996-06-15',
    sources: [{ label: 'Wikidata Q1768 (date of death)', url: 'https://www.wikidata.org/wiki/Q1768' }],
  },
  'louis-armstrong': {
    bornOn: '1901-08-04',
    diedOn: '1971-07-06',
    sources: [{ label: 'Wikidata Q1779 (date of death)', url: 'https://www.wikidata.org/wiki/Q1779' }],
  },
  'celia-cruz': {
    bornOn: '1925-10-21',
    diedOn: '2003-07-16',
    sources: [{ label: 'Wikidata Q474045 (date of death)', url: 'https://www.wikidata.org/wiki/Q474045' }],
  },
  'johnny-cash': {
    bornOn: '1932-02-26',
    diedOn: '2003-09-12',
    sources: [{ label: 'Wikidata Q42775 (date of death)', url: 'https://www.wikidata.org/wiki/Q42775' }],
  },
}

/** Very influential deceased artists render as supernova remnants (Crab-like) instead of planetary nebulae. */
export const SUPERNOVA_REMNANTS = new Set(['miles-davis', 'john-coltrane', 'louis-armstrong', 'johnny-cash'])

export function memorialYears(m: Memorial): string {
  return `${m.bornOn.slice(0, 4)}–${m.diedOn.slice(0, 4)}`
}
