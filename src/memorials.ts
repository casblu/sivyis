/**
 * Memorial stars — artists who have died in real life burn extra bright in the galaxy.
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
}

export function memorialYears(m: Memorial): string {
  return `${m.bornOn.slice(0, 4)}–${m.diedOn.slice(0, 4)}`
}
