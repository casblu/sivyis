/**
 * Music History — chronological story + philosophy notes + artists + factual media.
 * Separate from Philosophy Web (theory/graph); this is a scrubbable timeline for the History tab.
 */

export type MediaKind = 'release' | 'news' | 'broadcast' | 'publication'

export type HistoryArtist = {
  name: string
  role: string
  /** Galaxy star id when the artist exists in ARTISTS */
  artistId?: string
}

export type HistoryMediaRef = {
  year: string
  title: string
  kind: MediaKind
  summary: string
  url?: string
}

export type HistoryEra = {
  id: string
  title: string
  years: string
  /** Approximate midpoint for scrubber (negative = BCE) */
  yearMid: number
  color: string
  narrative: string[]
  philosophyNotes: string[]
  /** Optional Philosophy Web node ids for soft links */
  philosophyNodeIds?: string[]
  artists: HistoryArtist[]
  mediaRefs: HistoryMediaRef[]
  keyThemes: string[]
}

/** ~14 eras from deep antiquity through the 2020s. */
export const HISTORY_ERAS: HistoryEra[] = [
  {
    id: 'deep-antiquity',
    title: 'Deep Antiquity',
    years: '~40,000 – 3000 BCE',
    yearMid: -20000,
    color: '#94a3b8',
    narrative: [
      'Long before markets or notation, sound was a social technology. Bone flutes from the Upper Paleolithic, possible ritual percussion, and group chant helped coordinate hunts, mark mourning, and draw a line between ordinary time and sacred time.',
      'Archaeology cannot recover melodies, but it shows that pitch and pulse were already human tools. Music lived in bodies and places — caves, camps, temples — not on shelves.',
      'These practices feed every later genre cluster in the Cosmoly galaxy: rhythm as group glue, voice as presence, and the idea that organized vibration means something beyond entertainment.',
    ],
    philosophyNotes: [
      'Sound as ritual boundary between human and spirit worlds — philosophy enacted, not written.',
      'Collective timekeeping: pulse as social contract before theory.',
    ],
    philosophyNodeIds: ['pythagoras', 'embodiment'],
    artists: [
      { name: 'Anonymous ritual ensembles', role: 'Communal voice & drum' },
      { name: 'Upper Paleolithic flutists', role: 'Early pitched instruments (archaeological)' },
    ],
    mediaRefs: [
      {
        year: '~35,000 BCE',
        title: 'Hohle Fels / Geißenklösterle flutes (Germany)',
        kind: 'publication',
        summary: 'Aurignacian bone and ivory flutes among the earliest secure musical instruments.',
        url: 'https://en.wikipedia.org/wiki/Paleolithic_flutes',
      },
      {
        year: '~2000 BCE',
        title: 'Hurrian Hymn No. 6 (Ugarit)',
        kind: 'publication',
        summary: 'Among the oldest substantially preserved notated songs, from Late Bronze Age Syria.',
        url: 'https://en.wikipedia.org/wiki/Hurrian_songs',
      },
    ],
    keyThemes: ['Ritual', 'Communal pulse', 'Pre-notation craft'],
  },
  {
    id: 'axial-classical',
    title: 'Axial & Classical',
    years: '~800 BCE – 400 CE',
    yearMid: -200,
    color: '#7af0ff',
    narrative: [
      'Across the Mediterranean, South Asia, and East Asia, thinkers made music explicit philosophy. Greece linked intervals to number and character; China treated yue as moral and civic order; India developed rasa — cultivated emotional color — inside disciplined modal practice.',
      'Public drama, temple liturgy, and court ensembles turned listening into education and power. Modes were not just scales; they were ethical weather systems.',
      'The galaxy’s Jazz / Classical adjacency and every “theory first” debate still echoes this era’s claim: sound structures soul and cosmos.',
    ],
    philosophyNotes: [
      'Pythagoras: interval ratios as cosmic order (octave 2:1, fifth 3:2).',
      'Plato & Aristotle: modes shape ethos; music as catharsis and training.',
      'Confucian and early Indian frameworks: music as moral / rasa technology.',
    ],
    philosophyNodeIds: ['pythagoras', 'ethos', 'rasa'],
    artists: [
      { name: 'Pythagoras (tradition)', role: 'Interval–cosmos link' },
      { name: 'Vedic & early raga lineages', role: 'Modal discipline' },
      { name: 'Court & temple ensembles', role: 'Civic / sacred performance' },
    ],
    mediaRefs: [
      {
        year: '~500 BCE',
        title: 'Pythagorean acoustics in Greek thought',
        kind: 'publication',
        summary: 'Classical sources preserve the tradition linking consonant intervals to simple ratios.',
        url: 'https://en.wikipedia.org/wiki/Pythagorean_tuning',
      },
      {
        year: '4th c. BCE',
        title: 'Aristotle, Politics (music & education)',
        kind: 'publication',
        summary: 'Argues music’s role in character formation and leisure within the polis.',
        url: 'https://en.wikipedia.org/wiki/Politics_(Aristotle)',
      },
    ],
    keyThemes: ['Ethos', 'Cosmos & number', 'Modal systems'],
  },
  {
    id: 'medieval',
    title: 'Medieval Worlds',
    years: '~400 – 1400',
    yearMid: 900,
    color: '#34d399',
    narrative: [
      'Christian chant, emerging European polyphony, Islamic maqām science, and African polyrhythm / call-and-response traditions ran as parallel high arts — some oral, some treatise-rich.',
      'Guido of Arezzo’s staff and solmization made pitch teachable at scale. Notation began to freeze time even as oral masters kept living systems flexible.',
      'Today’s sacred-to-secular tensions, and the distinction between written “works” and living practices, start here.',
    ],
    philosophyNotes: [
      'Music as path to the divine vs. music as measured craft (musica speculativa / practica).',
      'Oral polyrhythm as sophisticated theory without European notation.',
    ],
    philosophyNodeIds: ['sacred', 'polyphony'],
    artists: [
      { name: 'Hildegard of Bingen', role: 'Visionary chant & theology' },
      { name: 'Léonin & Pérotin', role: 'Notre Dame polyphony' },
      { name: 'al-Fārābī', role: 'Islamic music science' },
      { name: 'Guido of Arezzo', role: 'Pedagogy & staff notation' },
    ],
    mediaRefs: [
      {
        year: '~1025',
        title: 'Guido of Arezzo — Micrologus / staff pedagogy',
        kind: 'publication',
        summary: 'Landmark medieval teaching of pitch reading that reshaped European literacy.',
        url: 'https://en.wikipedia.org/wiki/Guido_of_Arezzo',
      },
      {
        year: '12th–13th c.',
        title: 'Notre Dame school polyphony',
        kind: 'release',
        summary: 'Organum and early measured polyphony in Paris become a reference for Western counterpoint.',
        url: 'https://en.wikipedia.org/wiki/Notre_Dame_school',
      },
    ],
    keyThemes: ['Chant', 'Polyphony', 'Notation literacy', 'Oral theory'],
  },
  {
    id: 'renaissance',
    title: 'Renaissance',
    years: '~1400 – 1600',
    yearMid: 1500,
    color: '#a78bfa',
    narrative: [
      'Humanism pushed text expression; printing spread partbooks; balanced polyphony refined the “perfect” sacred style even as courts and streets hummed other songs.',
      'Zarlino and others theorized harmony in print. Who could compose and argue about music widened — still elite, but larger than monastery walls alone.',
      'The idea of a portable, reproducible musical text — ancestor of the recorded “track” — accelerates here.',
    ],
    philosophyNotes: [
      'Word painting & musica reservata: text meaning should shape sound.',
      'Printed theory as public argument, not only cloistered craft.',
    ],
    philosophyNodeIds: ['expression', 'harmony'],
    artists: [
      { name: 'Josquin des Prez', role: 'Imitative polyphony' },
      { name: 'Palestrina', role: 'Counter-Reformation ideal style' },
      { name: 'William Byrd', role: 'English sacred & consort' },
      { name: 'Gioseffo Zarlino', role: 'Harmonic theory in print' },
    ],
    mediaRefs: [
      {
        year: '1501',
        title: 'Petrucci’s first polyphonic prints (Venice)',
        kind: 'publication',
        summary: 'Movable-type music printing commercializes partbooks across Europe.',
        url: 'https://en.wikipedia.org/wiki/Ottaviano_Petrucci',
      },
      {
        year: '1558',
        title: 'Zarlino — Le istitutioni harmoniche',
        kind: 'publication',
        summary: 'Major Renaissance treatise on intervals, modes, and compositional practice.',
        url: 'https://en.wikipedia.org/wiki/Gioseffo_Zarlino',
      },
    ],
    keyThemes: ['Printing', 'Text expression', 'Court & chapel'],
  },
  {
    id: 'baroque-classical',
    title: 'Baroque → Classical',
    years: '~1600 – 1820',
    yearMid: 1710,
    color: '#60a5fa',
    narrative: [
      'Opera, continuo, and major–minor tonality consolidate a grammar that still underpins most pop, rock, country, and film music in the galaxy.',
      'Public concerts and subscription culture grow. Absolute instrumental music claims autonomy from church and word — a new prestige for “pure” form.',
      'Affect theory (Baroque) yields to enlightened clarity and sonata drama (Classical). Power shifts from court patronage toward mixed public markets.',
    ],
    philosophyNotes: [
      'Doctrine of the affections → expressive codes for keys and gestures.',
      'Rise of absolute music and the public concert as social form.',
    ],
    philosophyNodeIds: ['tonality', 'absolute-music'],
    artists: [
      { name: 'J.S. Bach', role: 'Contrapuntal summit' },
      { name: 'G.F. Handel', role: 'Oratorio & public spectacle' },
      { name: 'Joseph Haydn', role: 'Symphony / string quartet craft' },
      { name: 'W.A. Mozart', role: 'Opera & classical form' },
      { name: 'Early Beethoven', role: 'Bridge to Romantic heroism' },
    ],
    mediaRefs: [
      {
        year: '1607',
        title: 'Monteverdi — L’Orfeo',
        kind: 'release',
        summary: 'Early opera landmark showing dramatic continuous music for the stage.',
        url: 'https://en.wikipedia.org/wiki/L%27Orfeo',
      },
      {
        year: '1721 / 1741',
        title: 'Bach Brandenburg Concertos · Handel Messiah',
        kind: 'release',
        summary: 'Instrumental concerto grosso ideal and English oratorio megahit reshape public taste.',
        url: 'https://en.wikipedia.org/wiki/Messiah_(Handel)',
      },
    ],
    keyThemes: ['Tonality', 'Opera', 'Public concert', 'Form'],
  },
  {
    id: 'romantic',
    title: 'Romantic Century',
    years: '~1820 – 1900',
    yearMid: 1860,
    color: '#fb7185',
    narrative: [
      'The composer-genius, national schools, expanded harmony, and program music dominate art-music prestige. Folk collection feeds art music while vernacular streams stay fiercely independent.',
      'Schopenhauer cast music as direct will; Nietzsche later wrestled Apollonian / Dionysian forces — metaphysics that still color rock mythology and “authentic” singer-songwriter lore.',
      'Industrial cities, sheet-music markets, and touring virtuosi invent modern celebrity. Galaxy Country / Folk / Metal myths of outlaw and titan both borrow Romantic poses.',
    ],
    philosophyNotes: [
      'Music as metaphysics (Schopenhauer) and cultural force (Nietzsche).',
      'Nationalism vs. universalist “absolute” ideals.',
    ],
    philosophyNodeIds: ['expression', 'genius'],
    artists: [
      { name: 'Richard Wagner', role: 'Music drama & leitmotif' },
      { name: 'Frédéric Chopin', role: 'Poetic piano nationalism' },
      { name: 'Franz Liszt', role: 'Virtuoso & symphonic poem' },
      { name: 'Johnny Cash', role: 'Later outlaw echo of Romantic persona', artistId: 'johnny-cash' },
      { name: 'Willie Nelson', role: 'Americana continuity', artistId: 'willie-nelson' },
    ],
    mediaRefs: [
      {
        year: '1844 / 1870s',
        title: 'Schopenhauer & Nietzsche on music',
        kind: 'publication',
        summary: 'Philosophical bestsellers shape how Europe hears music as truth beyond representation.',
        url: 'https://en.wikipedia.org/wiki/The_World_as_Will_and_Representation',
      },
      {
        year: '1876',
        title: 'Bayreuth Festival opens',
        kind: 'news',
        summary: 'Wagner’s purpose-built festival models cultic modern art-music pilgrimage.',
        url: 'https://en.wikipedia.org/wiki/Bayreuth_Festival',
      },
    ],
    keyThemes: ['Genius myth', 'Nation', 'Expanded harmony', 'Celebrity'],
  },
  {
    id: 'early-recording',
    title: 'Recording & Jazz Dawn',
    years: '~1900 – 1945',
    yearMid: 1925,
    color: '#f472b6',
    narrative: [
      'Phonograph, radio, and cinema invent the reproducible hit. Jazz becomes a major Atlantic art; blues and country enter mass markets; European modernism cracks tonality in parallel.',
      'The “work” is increasingly a take on disc, not only a score. Improvisation and groove claim high-art seriousness against racist and class hierarchies.',
      'Adorno’s culture-industry diagnosis and swing’s joy both belong here — critique and dance in the same decades. Galaxy Jazz, Blues-rooted Rock, and Pop all inherit this media shift.',
    ],
    philosophyNotes: [
      'Recording as new ontology of the musical work.',
      'Jazz as democratic modernism vs. culture-industry standardization debates.',
    ],
    philosophyNodeIds: ['modernism', 'embodiment'],
    artists: [
      { name: 'Louis Armstrong', role: 'Solo improvisation as star craft', artistId: 'louis-armstrong' },
      { name: 'Ella Fitzgerald', role: 'Swing-to-bop vocal virtuosity', artistId: 'ella-fitzgerald' },
      { name: 'Bessie Smith', role: 'Classic blues empress' },
      { name: 'Duke Ellington', role: 'Orchestra as composition' },
      { name: 'The Rolling Stones', role: 'Later blues-rock heirs', artistId: 'the-rolling-stones' },
    ],
    mediaRefs: [
      {
        year: '1925–27',
        title: 'Electrical recording & network radio boom',
        kind: 'broadcast',
        summary: 'Improved disc fidelity and national radio turn songs into simultaneous mass events.',
        url: 'https://en.wikipedia.org/wiki/Electrical_transcription',
      },
      {
        year: '1939',
        title: 'Billie Holiday records “Strange Fruit”',
        kind: 'release',
        summary: 'Anti-lynching protest song becomes a landmark of political popular music in the U.S.',
        url: 'https://en.wikipedia.org/wiki/Strange_Fruit',
      },
    ],
    keyThemes: ['Phonograph', 'Radio', 'Jazz modernism', 'Mass hit'],
  },
  {
    id: 'postwar',
    title: 'Postwar Explosion',
    years: '~1945 – 1965',
    yearMid: 1955,
    color: '#fbbf24',
    narrative: [
      'Rock & roll, modern jazz, electric blues, mambo/early Latin crossovers, and studio pop explode with youth markets, TV, and the LP.',
      'Civil-rights struggle and Cold War soft power make music a battlefield of dignity and diplomacy. Independent labels and transistor radios decentralize taste.',
      'Galaxy Rock, R&B, Jazz, Latin, and Pop clusters densify here — the “classic” mid-century map still audible in every fly-through.',
    ],
    philosophyNotes: [
      'Youth culture as aesthetic and political force.',
      'Authenticity debates: folk purity vs. electrified pop.',
    ],
    philosophyNodeIds: ['embodiment', 'culture-industry'],
    artists: [
      { name: 'Miles Davis', role: 'Bebop → cool → modal turns', artistId: 'miles-davis' },
      { name: 'Chuck Berry / early rock architects', role: 'Guitar-as-narrative pop' },
      { name: 'Celia Cruz', role: 'Salsa & Afro-Caribbean stardom', artistId: 'celia-cruz' },
      { name: 'Johnny Cash', role: 'Country television & prison concerts', artistId: 'johnny-cash' },
    ],
    mediaRefs: [
      {
        year: '1954–56',
        title: 'Rock & roll crosses into U.S. pop charts / TV',
        kind: 'broadcast',
        summary: 'Elvis, Berry, and peers hit national TV and Billboard, alarming and exciting mass media.',
        url: 'https://en.wikipedia.org/wiki/Rock_and_roll',
      },
      {
        year: '1959',
        title: 'Miles Davis — Kind of Blue',
        kind: 'release',
        summary: 'Modal jazz landmark; among the best-selling jazz albums in history.',
        url: 'https://en.wikipedia.org/wiki/Kind_of_Blue',
      },
    ],
    keyThemes: ['Youth market', 'TV', 'Civil rights soundtrack', 'LP'],
  },
  {
    id: 'counterculture',
    title: 'Counterculture & Soul Power',
    years: '~1965 – 1979',
    yearMid: 1972,
    color: '#fb923c',
    narrative: [
      'Albums as statements, festivals as temporary cities, soul and funk as liberation technologies, reggae’s global bass, and early electronic studios rewrite production.',
      'Free jazz, progressive rock, disco floors, and metal’s birth (Black Sabbath) splinter “rock” into many galaxies at once. FM radio and hi-fi culture deepen listening.',
      'Philosophy of the era: authenticity, utopia, and the body on the dance floor — all still contested in Indie, Metal, R&B, and Electronic clusters.',
    ],
    philosophyNotes: [
      'Afrofuturist cosmologies (Sun Ra and heirs) vs. rock authenticity myths.',
      'Dance floor as political and erotic public.',
    ],
    philosophyNodeIds: ['afrofuturism', 'embodiment'],
    artists: [
      { name: 'The Beatles', role: 'Studio-as-instrument pop', artistId: 'the-beatles' },
      { name: 'Aretha Franklin', role: 'Soul sovereignty', artistId: 'aretha-franklin' },
      { name: 'Stevie Wonder', role: 'Synthesized soul albums', artistId: 'stevie-wonder' },
      { name: 'John Coltrane', role: 'Spiritual free modality', artistId: 'john-coltrane' },
      { name: 'Black Sabbath', role: 'Heavy metal origin myth', artistId: 'black-sabbath' },
      { name: 'Queen', role: 'Theatrical stadium rock', artistId: 'queen' },
      { name: 'Miles Davis', role: 'Electric / fusion turn', artistId: 'miles-davis' },
    ],
    mediaRefs: [
      {
        year: '1969',
        title: 'Woodstock Festival',
        kind: 'news',
        summary: 'Mass counterculture festival becomes a global media emblem of youth music politics.',
        url: 'https://en.wikipedia.org/wiki/Woodstock',
      },
      {
        year: '1971',
        title: 'Marvin Gaye — What’s Going On',
        kind: 'release',
        summary: 'Soul concept album addressing war, ecology, and injustice enters the pop mainstream.',
        url: 'https://en.wikipedia.org/wiki/What%27s_Going_On_(Marvin_Gaye_album)',
      },
      {
        year: '1977',
        title: 'Saturday Night Fever & disco peak',
        kind: 'broadcast',
        summary: 'Film/soundtrack synergy pushes disco to global chart dominance — and backlash.',
        url: 'https://en.wikipedia.org/wiki/Saturday_Night_Fever',
      },
    ],
    keyThemes: ['Album era', 'Festivals', 'Soul/funk', 'Metal birth', 'Disco'],
  },
  {
    id: 'mtv-digital',
    title: 'MTV, Hip-Hop & Digital',
    years: '~1980 – 1999',
    yearMid: 1990,
    color: '#ff6ad5',
    narrative: [
      'Music video makes image co-equal with sound. Hip-hop’s sampling ethics, turntablism, and street reportage become a global lingua franca. Metal goes mainstream; electronic dance culture builds parallel cities.',
      'CDs, MIDI, and early DAWs democratize production while majors reconsolidate. Global pop pipelines (and Latin crossover waves) thicken.',
      'Critical theory meets the breakbeat: who owns a sample, who owns a face on MTV, who owns the nightclub. Galaxy Hip-Hop, Electronic, Pop, and Metal stars densify here.',
    ],
    philosophyNotes: [
      'Sampling as citation vs. theft — new authorship ethics.',
      'Spectacle (MTV) and rave embodiment as twin late-20th-century aesthetics.',
    ],
    philosophyNodeIds: ['sampling', 'culture-industry'],
    artists: [
      { name: 'Missy Elliott', role: 'Visionary hip-hop / video futurism', artistId: 'missy-elliott' },
      { name: 'Jay-Z', role: 'Rap enterprise & lyric craft', artistId: 'jay-z' },
      { name: 'Metallica', role: 'Metal into stadium mainstream', artistId: 'metallica' },
      { name: 'Daft Punk', role: 'French house into global pop', artistId: 'daft-punk' },
      { name: 'Aphex Twin', role: 'IDM / electronic auteur', artistId: 'aphex-twin' },
      { name: 'Radiohead', role: 'Alt-rock into digital anxiety', artistId: 'radiohead' },
      { name: 'Celia Cruz', role: 'Salsa’s global elder stateswoman', artistId: 'celia-cruz' },
      { name: 'Nirvana', role: 'Alt-rock chart rupture', artistId: 'nirvana' },
    ],
    mediaRefs: [
      {
        year: '1981',
        title: 'MTV launches (U.S.)',
        kind: 'broadcast',
        summary: '24-hour music television rewires promotion, fashion, and racial gatekeeping battles on cable.',
        url: 'https://en.wikipedia.org/wiki/MTV',
      },
      {
        year: '1988–89',
        title: 'Public Enemy — It Takes a Nation… / Fight the Power moment',
        kind: 'release',
        summary: 'Dense sample-collage political hip-hop becomes a reference for sound-as-critique.',
        url: 'https://en.wikipedia.org/wiki/It_Takes_a_Nation_of_Millions_to_Hold_Us_Back',
      },
      {
        year: '1991',
        title: 'Nirvana — Nevermind / “Smells Like Teen Spirit”',
        kind: 'release',
        summary: 'Alt-rock breaks deep into Billboard, shifting major-label taste maps.',
        url: 'https://en.wikipedia.org/wiki/Nevermind',
      },
    ],
    keyThemes: ['Music video', 'Sampling', 'Global pop', 'Rave', 'CD'],
  },
  {
    id: 'internet-rise',
    title: 'Internet & Global Bass',
    years: '~2000 – 2010',
    yearMid: 2005,
    color: '#22d3ee',
    narrative: [
      'Napster-to-iTunes shocks the industry; blogs, MySpace, and YouTube invent new discovery paths. Auto-Tune becomes an aesthetic, not only a fix.',
      'Crunk, reggaeton, indie digital, and EDM festival culture redraw center/periphery maps. “World music” marketing yields to artist-led global crossovers.',
      'The hollow genre ball’s later clusters — Latin trap-adjacent, Indie, Electronic — inherit these pipeline wars.',
    ],
    philosophyNotes: [
      'File-sharing as crisis of the commodity form of music.',
      'Platform discovery vs. label gatekeeping.',
    ],
    philosophyNodeIds: ['culture-industry', 'digital'],
    artists: [
      { name: 'Missy Elliott', role: '2000s video & beat futurism', artistId: 'missy-elliott' },
      { name: 'Daddy Yankee', role: 'Reggaeton global breakout', artistId: 'daddy-yankee' },
      { name: 'Outkast / Southern rap wave', role: 'Regional → global hip-hop' },
      { name: 'Radiohead', role: 'Pay-what-you-want digital release experiments', artistId: 'radiohead' },
      { name: 'Daft Punk', role: 'Alive 2007 stadium electronic', artistId: 'daft-punk' },
    ],
    mediaRefs: [
      {
        year: '2001–03',
        title: 'iTunes Store & early legal download economy',
        kind: 'news',
        summary: 'À-la-carte tracks challenge the album as default commercial unit.',
        url: 'https://en.wikipedia.org/wiki/iTunes_Store',
      },
      {
        year: '2004–05',
        title: 'Daddy Yankee — Barrio Fino / “Gasolina”',
        kind: 'release',
        summary: 'Reggaeton crosses decisively into global pop consciousness.',
        url: 'https://en.wikipedia.org/wiki/Barrio_Fino',
      },
      {
        year: '2007',
        title: 'Radiohead — In Rainbows (pay-what-you-want)',
        kind: 'news',
        summary: 'Major act tests direct digital pricing outside traditional label windows.',
        url: 'https://en.wikipedia.org/wiki/In_Rainbows',
      },
    ],
    keyThemes: ['Piracy & downloads', 'YouTube', 'Reggaeton rise', 'EDM festivals'],
  },
  {
    id: 'streaming-teens',
    title: 'Streaming Ascendant',
    years: '~2011 – 2019',
    yearMid: 2015,
    color: '#c084fc',
    narrative: [
      'Spotify-era playlists become soft canons. Hip-hop becomes the U.S. streaming center; Latin urban and K-pop prove global pipelines without Anglo permission structures.',
      'Bedroom production, SoundCloud waves, and aesthetic micro-genres (emo-rap, alt-R&B, hyperpop seeds) thrive beside stadium pop. Visual albums and prestige video reclaim spectacle.',
      'Cosmoly’s galaxy metaphor answers playlist flatness: fly space instead of infinite scroll.',
    ],
    philosophyNotes: [
      'Playlist as algorithmic canon — phenomenology of ambient choice.',
      'Visual album / auteur pop as resistance to shuffle culture.',
    ],
    philosophyNodeIds: ['digital', 'afrofuturism'],
    artists: [
      { name: 'Beyoncé', role: 'Visual album auteur pop', artistId: 'beyonc' },
      { name: 'Kendrick Lamar', role: 'Streaming-era lyric monument', artistId: 'kendrick-lamar' },
      { name: 'Drake', role: 'Melodic rap as default pop', artistId: 'drake' },
      { name: 'Bad Bunny', role: 'Latin urban global center', artistId: 'bad-bunny' },
      { name: 'Frank Ocean', role: 'Alt-R&B auteur release tactics', artistId: 'frank-ocean' },
      { name: 'Daft Punk', role: 'Random Access Memories farewell peak', artistId: 'daft-punk' },
      { name: 'Taylor Swift', role: 'Pop authorship & fan publics', artistId: 'taylor-swift' },
    ],
    mediaRefs: [
      {
        year: '2013',
        title: 'Beyoncé surprise visual album',
        kind: 'release',
        summary: 'Full album drop without traditional singles cycle resets major-pop release strategy.',
        url: 'https://en.wikipedia.org/wiki/Beyonc%C3%A9_(album)',
      },
      {
        year: '2016',
        title: 'Lemonade (Beyoncé) & civil-rights–era visual storytelling',
        kind: 'release',
        summary: 'Premiere event blends film, Black Southern history, and pop authorship.',
        url: 'https://en.wikipedia.org/wiki/Lemonade_(Beyonc%C3%A9_album)',
      },
      {
        year: '2017–18',
        title: 'Hip-hop becomes top U.S. streamed genre (RIAA / industry reports)',
        kind: 'news',
        summary: 'Industry data confirms hip-hop/R&B’s streaming-era centrality in the U.S. market.',
        url: 'https://en.wikipedia.org/wiki/Hip_hop_music',
      },
    ],
    keyThemes: ['Playlists', 'Visual albums', 'Global urban pop', 'SoundCloud'],
  },
  {
    id: 'twenties',
    title: '2020s Now',
    years: '2020 – present',
    yearMid: 2023,
    color: '#7af0ff',
    narrative: [
      'Pandemic lockdowns accelerated livestream concerts, TikTok micro-forms, and bedroom polymath careers. Short-form video can mint a hit from a 15-second hook.',
      'AI-assisted production, spatial audio, and catalog economics (re-records, heritage touring) reshape labor and ownership fights. Genre labels blur while identity and place still matter.',
      'Cosmoly proposes an alternate map: a hollow ball of genres you fly from the inside — curiosity as navigation, not only metrics.',
    ],
    philosophyNotes: [
      'Attention economy vs. deep listening — can interfaces restore wonder?',
      'AI co-creation: tool, threat, or new folk practice?',
    ],
    philosophyNodeIds: ['digital', 'embodiment'],
    artists: [
      { name: 'Billie Eilish', role: 'Whisper-pop auteur → arena scale', artistId: 'billie-eilish' },
      { name: 'Bad Bunny', role: 'Spanish-language streaming dominance', artistId: 'bad-bunny' },
      { name: 'Taylor Swift', role: 'Eras touring & re-record strategy', artistId: 'taylor-swift' },
      { name: 'SZA', role: 'Confessional R&B chart force', artistId: 'sza' },
      { name: 'Rosalía', role: 'Flamenco–pop–global experimental', artistId: 'rosal-a' },
      { name: 'Tame Impala', role: 'Psych-pop into dance-leaning 2020s', artistId: 'tame-impala' },
      { name: 'Phoebe Bridgers', role: 'Indie intimacy at scale', artistId: 'phoebe-bridgers' },
      { name: 'Travis Scott', role: 'Festival / virtual-concert spectacle', artistId: 'travis-scott' },
    ],
    mediaRefs: [
      {
        year: '2020',
        title: 'COVID-19 livestream concert wave',
        kind: 'broadcast',
        summary: 'Artists and platforms improvise remote performance economies during lockdowns.',
        url: 'https://en.wikipedia.org/wiki/Impact_of_the_COVID-19_pandemic_on_the_music_industry',
      },
      {
        year: '2021–23',
        title: 'TikTok-driven chart mechanics mainstreamed',
        kind: 'news',
        summary: 'Short-form virality routinely shapes Billboard / global chart entries and release edits.',
        url: 'https://en.wikipedia.org/wiki/TikTok',
      },
      {
        year: '2023–24',
        title: 'AI music tools enter consumer DAWs & headlines',
        kind: 'news',
        summary: 'Public debate over voice clones, training data, and credit accompanies rapid tool adoption.',
        url: 'https://en.wikipedia.org/wiki/Music_and_artificial_intelligence',
      },
    ],
    keyThemes: ['TikTok form', 'Livestream', 'AI tools', 'Catalog power', 'Galaxy navigation'],
  },
]

export type MusicHistoryHandle = {
  activate: () => void
  deactivate: () => void
  dispose: () => void
  selectEra: (id: string) => void
}

export type MusicHistoryOpts = {
  onOpenArtist?: (artistId: string) => void
  onOpenPhilosophyNode?: (nodeId: string) => void
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function kindLabel(k: MediaKind): string {
  switch (k) {
    case 'release':
      return 'Release'
    case 'news':
      return 'News'
    case 'broadcast':
      return 'Broadcast'
    case 'publication':
      return 'Publication'
  }
}

export function musicHistoryPageHtml(): string {
  return `
  <div class="hist-root">
    <header class="hist-hero">
      <p class="kicker">Cosmoly · SIVYIS Corp · Chronology</p>
      <h1>Music History</h1>
      <p class="phil-lead">Scrub eras to hear how sound, power, and media shifted — narrative, philosophy of the time,
        artists, and documented releases &amp; news. Distinct from Philosophy (theory web): this is the timeline story.</p>
    </header>

    <div class="hist-scrub" aria-label="Era scrubber">
      <div class="hist-scrub-top">
        <button type="button" class="hist-chip" id="hist-prev" aria-label="Previous era">← Prev</button>
        <div class="hist-era-year" id="hist-era-year"></div>
        <button type="button" class="hist-chip" id="hist-next" aria-label="Next era">Next →</button>
      </div>
      <input id="hist-range" type="range" min="0" max="${HISTORY_ERAS.length - 1}" value="0" step="1" aria-label="Slide across music history eras" />
      <div class="hist-ticks" id="hist-ticks" role="list"></div>
    </div>

    <article class="hist-detail" id="hist-detail" aria-live="polite"></article>
  </div>
  `
}

function renderDetail(era: HistoryEra): string {
  const narrative = era.narrative.map((p) => `<p>${esc(p)}</p>`).join('')
  const phil = era.philosophyNotes.map((n) => `<li>${esc(n)}</li>`).join('')
  const themes = era.keyThemes.map((t) => `<span class="hist-theme">${esc(t)}</span>`).join('')
  const artists = era.artists
    .map((a) => {
      const gal = a.artistId
        ? `<button type="button" class="hist-artist-btn" data-artist="${esc(a.artistId)}">In galaxy · fly</button>`
        : `<span class="hist-artist-tag">Historical</span>`
      return `<li class="hist-artist">
        <div><strong>${esc(a.name)}</strong><em>${esc(a.role)}</em></div>
        ${gal}
      </li>`
    })
    .join('')
  const media = era.mediaRefs
    .map((m) => {
      const link = m.url
        ? `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Source</a>`
        : ''
      return `<li class="hist-media">
        <div class="hist-media-meta">
          <span class="hist-media-year">${esc(m.year)}</span>
          <span class="hist-media-kind">${kindLabel(m.kind)}</span>
        </div>
        <strong>${esc(m.title)}</strong>
        <p>${esc(m.summary)}</p>
        ${link}
      </li>`
    })
    .join('')
  const philLinks = (era.philosophyNodeIds ?? [])
    .map(
      (id) =>
        `<button type="button" class="hist-phil-link" data-phil-node="${esc(id)}">${esc(id)}</button>`,
    )
    .join('')

  return `
    <div class="hist-detail-head" style="--hc:${esc(era.color)}">
      <p class="kicker">${esc(era.years)}</p>
      <h2>${esc(era.title)}</h2>
      <div class="hist-themes">${themes}</div>
    </div>

    <section class="hist-block">
      <h3>Narrative</h3>
      ${narrative}
    </section>

    <section class="hist-block">
      <h3>Music philosophy of the time</h3>
      <ul>${phil}</ul>
      ${philLinks ? `<div class="hist-phil-links"><span class="kicker">Related ideas</span>${philLinks}</div>` : ''}
    </section>

    <section class="hist-block">
      <h3>Artists of the era</h3>
      <ul class="hist-artist-list">${artists}</ul>
    </section>

    <section class="hist-block">
      <h3>Factual media &amp; news</h3>
      <ul class="hist-media-list">${media}</ul>
    </section>
  `
}

export function mountMusicHistory(
  root: HTMLElement,
  opts: MusicHistoryOpts = {},
): MusicHistoryHandle {
  root.innerHTML = musicHistoryPageHtml()
  const range = root.querySelector<HTMLInputElement>('#hist-range')!
  const detail = root.querySelector<HTMLElement>('#hist-detail')!
  const yearEl = root.querySelector<HTMLElement>('#hist-era-year')!
  const ticks = root.querySelector<HTMLElement>('#hist-ticks')!
  const prev = root.querySelector<HTMLButtonElement>('#hist-prev')!
  const next = root.querySelector<HTMLButtonElement>('#hist-next')!

  ticks.innerHTML = HISTORY_ERAS.map(
    (e, i) =>
      `<button type="button" class="hist-tick" data-i="${i}" role="listitem" style="--hc:${esc(e.color)}" title="${esc(e.title)}"><span>${esc(e.years.split('–')[0]?.trim() || e.years)}</span></button>`,
  ).join('')

  let index = Math.max(0, HISTORY_ERAS.findIndex((e) => e.id === 'postwar'))
  if (index < 0) index = Math.floor(HISTORY_ERAS.length / 2)

  const paint = () => {
    const era = HISTORY_ERAS[index]!
    range.value = String(index)
    yearEl.innerHTML = `<strong>${esc(era.title)}</strong><span>${esc(era.years)}</span>`
    yearEl.style.setProperty('--hc', era.color)
    detail.innerHTML = renderDetail(era)
    ticks.querySelectorAll('.hist-tick').forEach((el, i) => {
      el.classList.toggle('active', i === index)
    })
    prev.disabled = index <= 0
    next.disabled = index >= HISTORY_ERAS.length - 1

    detail.querySelectorAll<HTMLButtonElement>('[data-artist]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.artist
        if (id) opts.onOpenArtist?.(id)
      })
    })
    detail.querySelectorAll<HTMLButtonElement>('[data-phil-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.philNode
        if (id) opts.onOpenPhilosophyNode?.(id)
      })
    })
  }

  const setIndex = (i: number) => {
    index = Math.max(0, Math.min(HISTORY_ERAS.length - 1, i))
    paint()
  }

  range.addEventListener('input', () => setIndex(Number(range.value)))
  prev.addEventListener('click', () => setIndex(index - 1))
  next.addEventListener('click', () => setIndex(index + 1))
  ticks.querySelectorAll<HTMLButtonElement>('.hist-tick').forEach((btn) => {
    btn.addEventListener('click', () => setIndex(Number(btn.dataset.i)))
  })

  // Swipe on scrubber row for phones
  let swipeX0 = 0
  const scrub = root.querySelector('.hist-scrub')!
  scrub.addEventListener(
    'touchstart',
    (e: Event) => {
      const te = e as TouchEvent
      swipeX0 = te.changedTouches[0]?.clientX ?? 0
    },
    { passive: true },
  )
  scrub.addEventListener(
    'touchend',
    (e: Event) => {
      const te = e as TouchEvent
      const x1 = te.changedTouches[0]?.clientX ?? swipeX0
      const dx = x1 - swipeX0
      if (Math.abs(dx) > 48) setIndex(index + (dx < 0 ? 1 : -1))
    },
    { passive: true },
  )

  paint()

  return {
    activate: () => {
      root.classList.remove('hist-inactive')
    },
    deactivate: () => {
      root.classList.add('hist-inactive')
    },
    dispose: () => {
      root.innerHTML = ''
    },
    selectEra: (id: string) => {
      const i = HISTORY_ERAS.findIndex((e) => e.id === id)
      if (i >= 0) setIndex(i)
    },
  }
}
