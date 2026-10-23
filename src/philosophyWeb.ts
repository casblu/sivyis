/**
 * Philosophy Web — interactive graph, timeline, and 3D cosmos map
 * for the Cosmoly Philosophy tab. Mounted after static philosophy HTML.
 */
import * as THREE from 'three'
import {
  DIAGRAMS,
  ENTRY_VISUALS,
  figureHtml,
  portraitCardHtml,
  resolvePortrait,
} from './philosophyImages.ts'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type DeepEntry = {
  id: string
  kind: 'philosophy' | 'genre' | 'era' | 'theme'
  label: string
  subtitle: string
  color: string
  philosophers: string[]
  quotes: { text: string; by: string }[]
  genres: string[]
  eras: string[]
  related: string[]
  body: string
  genreApps?: { genre: string; note: string }[]
}

type GraphLink = { source: string; target: string }

type TimelineEra = {
  id: string
  label: string
  range: string
  color: string
  thoughts: string
  historical: string[]
  catalog: string[]
}

type SimNode = {
  id: string
  label: string
  color: string
  r: number
  x: number
  y: number
  vx: number
  vy: number
}

/* ─── Content ───────────────────────────────────────────────────────────── */

export const DEEP_ENTRIES: DeepEntry[] = [
  {
    id: 'pythagorean',
    kind: 'philosophy',
    label: 'Pythagorean',
    subtitle: 'Number, ratio, and the music of the spheres',
    color: '#7af0ff',
    philosophers: ['Pythagoras', 'Philolaus', 'Boethius (transmitter)'],
    quotes: [
      {
        text: 'There is geometry in the humming of the strings; there is music in the spacing of the spheres.',
        by: 'Attributed to Pythagorean tradition (paraphrase)',
      },
    ],
    genres: ['Classical', 'Electronic', 'Jazz', 'Metal'],
    eras: ['ancient', 'medieval', 'modern'],
    related: ['platonic', 'formalism', 'islamic-golden', 'electronic'],
    body: `<p>Pythagorean thought treated musical intervals as <strong>audible mathematics</strong>.
      The octave (2:1), fifth (3:2), and fourth (4:3) were not mere preferences but signs that the cosmos
      itself was ordered by number. Later Western theory inherited this through Boethius’s threefold
      division: <em>musica mundana</em> (cosmic), <em>humana</em> (body/soul), and <em>instrumentalis</em>
      (heard sound).</p>
      <p>Even when modern acoustics replaces myth with spectra and critical bands, the Pythagorean
      impulse remains: to hear structure in vibration, and to treat tuning systems as ethical-cosmological
      choices rather than neutral tools.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Just intonation debates, spectralism, and “pure” interval aesthetics.' },
      { genre: 'Electronic', note: 'Modular synths and microtonal plugins revive ratio-first tuning.' },
      { genre: 'Jazz', note: 'Extended harmony still orbits fifths/thirds as gravitational centers.' },
      { genre: 'Metal', note: 'Drop tunings and power-fifth riffs literalize the “perfect” fifth as force.' },
      { genre: 'Hip-Hop', note: 'Sample chopping as arithmetic of time — bars as measurable units.' },
      { genre: 'Folk', note: 'Drone traditions (bagpipe, tambura-adjacent) embody sustained ratio spaces.' },
    ],
  },
  {
    id: 'platonic',
    kind: 'philosophy',
    label: 'Platonic',
    subtitle: 'Modes, character, and the politics of harmony',
    color: '#a78bfa',
    philosophers: ['Plato', 'Aristotle (critical response)', 'Damon of Athens'],
    quotes: [
      {
        text: 'Musical training is a more potent instrument than any other, because rhythm and harmony find their way into the inward places of the soul.',
        by: 'Plato, Republic (tr. traditional)',
      },
    ],
    genres: ['Classical', 'Hip-Hop', 'Folk', 'Pop'],
    eras: ['ancient', 'common-practice', 'modern'],
    related: ['pythagorean', 'confucian', 'expressionism', 'adorno'],
    body: `<p>In the <em>Republic</em> and <em>Laws</em>, Plato links musical modes to civic character.
      Soft or “luxurious” modes risk softening guardians; austere modes train courage. Music is never
      only entertainment — it is <strong>paideia</strong>, education of desire.</p>
      <p>Aristotle softens the ban but keeps the ethical frame: music affords catharsis and leisure
      rightly ordered. The Platonic worry — that playlists shape souls — returns in every moral panic
      about a genre, from jazz to trap to hyperpop.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Ethos of modes lives on in film scoring “character keys.”' },
      { genre: 'Hip-Hop', note: 'Conscious vs. party tracks as rival educations of the street.' },
      { genre: 'Folk', note: 'Ballads as moral memory and communal instruction.' },
      { genre: 'Pop', note: 'Hook design as soft power over attention and mood.' },
      { genre: 'Metal', note: 'Controversy over aggression echoes Platonic fears of mimesis.' },
      { genre: 'Jazz', note: 'Improvisation as freedom within law — a civic metaphor.' },
    ],
  },
  {
    id: 'confucian',
    kind: 'philosophy',
    label: 'Confucian',
    subtitle: 'Ritual music (yue) and social harmony',
    color: '#fbbf24',
    philosophers: ['Confucius', 'Xunzi', 'authors of the Yueji'],
    quotes: [
      {
        text: 'It is by the Odes that the mind is aroused; by the rules of propriety that character is established; by music that character is completed.',
        by: 'Analects 8.8 (traditional rendering)',
      },
    ],
    genres: ['Classical', 'Folk', 'Pop', 'Jazz'],
    eras: ['ancient', 'medieval', 'modern'],
    related: ['platonic', 'phenomenology', 'embodied'],
    body: `<p>Classical Chinese thought pairs <em>li</em> (ritual propriety) with <em>yue</em> (music/arts).
      Correct music does not merely please; it <strong>aligns persons with cosmic and social pattern</strong>.
      Wrong music disorders the state. The <em>Yueji</em> elaborates how tones relate to seasons, organs,
      and virtues — a full psychosomatic cosmology of sound.</p>
      <p>Today this frame illuminates ceremony (national anthems, graduation marches), K-pop training
      discipline, and debates over “noise” in public space as questions of shared order.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Court and ritual repertoires as moral architecture.' },
      { genre: 'Folk', note: 'Festival and work songs coordinating collective feeling.' },
      { genre: 'Pop', note: 'Idol systems as intensive li-yue training of body and affect.' },
      { genre: 'Jazz', note: 'Ensemble etiquette — listening as ritual respect.' },
      { genre: 'Electronic', note: 'Club as temporary ritual space with DJ as master of ceremony.' },
      { genre: 'Hip-Hop', note: 'Cypher rules: turn-taking, respect, completion of character in performance.' },
    ],
  },
  {
    id: 'islamic-golden',
    kind: 'philosophy',
    label: 'Islamic Golden Age',
    subtitle: 'Maqām, mathematics, and healing tones',
    color: '#34d399',
    philosophers: ['al-Kindī', 'al-Fārābī', 'Ibn Sīnā (Avicenna)', 'Ṣafī al-Dīn al-Urmawī'],
    quotes: [
      {
        text: 'Music is a mathematical science… by which one learns the states of notes as regards concordance and dissonance.',
        by: 'al-Fārābī (paraphrase of Kitab al-Musiqi)',
      },
    ],
    genres: ['Classical', 'Folk', 'Jazz', 'Electronic'],
    eras: ['medieval', 'common-practice', 'modern'],
    related: ['pythagorean', 'phenomenology', 'formalism'],
    body: `<p>From Baghdad to Córdoba, scholars fused Greek inheritance with Persian-Arabic practice.
      Treatises on intervals, lute fretting, and <em>maqām</em> modal families treated music as science
      and medicine: tones could rebalance the humors. Al-Fārābī’s <em>Great Book of Music</em> remains
      a landmark of theory.</p>
      <p>The living arts of maqām, makam, and related modal worlds still train microtonal ear and
      improvisational ethics — a continuum Cosmoly hears whenever “classical” is widened beyond Europe.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Modal improvisation (taqsīm) as composed-in-the-moment form.' },
      { genre: 'Jazz', note: 'Shared DNA of mode, ornament, and call-response with maqām practice.' },
      { genre: 'Folk', note: 'Regional song families as living theory without staff notation.' },
      { genre: 'Electronic', note: 'Middle Eastern scales in global bass and ambient production.' },
      { genre: 'Hip-Hop', note: 'Sampling oud/ney lines into boom-bap and trap atmospheres.' },
      { genre: 'Metal', note: 'Orientalist and authentic maqām-metal crossovers in progressive scenes.' },
    ],
  },
  {
    id: 'schopenhauer',
    kind: 'philosophy',
    label: 'Schopenhauer / Nietzsche',
    subtitle: 'Will, Dionysus, and music as metaphysics',
    color: '#fb7185',
    philosophers: ['Arthur Schopenhauer', 'Friedrich Nietzsche', 'Richard Wagner (catalyst)'],
    quotes: [
      {
        text: 'Music is the copy of the will itself.',
        by: 'Schopenhauer, The World as Will and Representation',
      },
      {
        text: 'It is only as an aesthetic phenomenon that existence and the world are eternally justified.',
        by: 'Nietzsche, The Birth of Tragedy',
      },
    ],
    genres: ['Classical', 'Metal', 'Rock', 'Electronic'],
    eras: ['common-practice', 'modern'],
    related: ['expressionism', 'adorno', 'afrofuturism', 'metal'],
    body: `<p>For Schopenhauer, other arts copy Ideas; music copies the <strong>Will</strong> — blind striving
      beneath representation. That claim elevates absolute music to metaphysical revelation.</p>
      <p>Nietzsche’s early Apollo/Dionysus pair (form vs. intoxicated unity) and later critique of Wagner
      keep music at the center of cultural diagnosis: Is art life-affirming or decadent? Contemporary
      extreme metal, noise, and rave culture often stage Dionysian excess with Apollonian craft.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Romantic absolute music and Wagnerian Gesamtkunstwerk debates.' },
      { genre: 'Metal', note: 'Will-to-power aesthetics, sublimity, and tragic affirmation.' },
      { genre: 'Rock', note: 'Virtuosity and ecstasy as twin Apollonian/Dionysian poles.' },
      { genre: 'Electronic', note: 'Rave as temporary Dionysian community under pulse.' },
      { genre: 'Jazz', note: 'Solo flight as will speaking through form.' },
      { genre: 'Indie / Alt', note: 'Confessional song as will made intimate rather than cosmic.' },
    ],
  },
  {
    id: 'formalism',
    kind: 'philosophy',
    label: 'Formalism',
    subtitle: 'Music as sounding form, not story',
    color: '#60a5fa',
    philosophers: ['Eduard Hanslick', 'Igor Stravinsky (allied remarks)', 'Peter Kivy (modern)'],
    quotes: [
      {
        text: 'The content of music is tonally moving forms.',
        by: 'Eduard Hanslick, On the Musically Beautiful',
      },
    ],
    genres: ['Classical', 'Electronic', 'Jazz', 'Metal'],
    eras: ['common-practice', 'modern'],
    related: ['pythagorean', 'expressionism', 'adorno', 'electronic'],
    body: `<p>Hanslick’s formalism denies that music’s beauty consists in depicting feelings. Feelings may
      accompany listening, but the artwork’s essence is <strong>form in motion</strong> — theme, development,
      proportion. Twentieth-century absolute music and much IDM inherit this pride in structure.</p>
      <p>Formalism is never pure: even “abstract” tracks carry cultural codes. Still, it remains a sharp
      tool against reductive program notes and against assuming every beat “means” a narrative.</p>`,
    genreApps: [
      { genre: 'Classical', note: 'Absolute music, serial craft, formal analysis classrooms.' },
      { genre: 'Electronic', note: 'Sound design and arrangement as primary “content.”' },
      { genre: 'Jazz', note: 'Head-solo-head as form; changes as architecture.' },
      { genre: 'Metal', note: 'Prog and math-metal as formal athleticism.' },
      { genre: 'Hip-Hop', note: 'Beat architecture and rhyme schemes as audible form.' },
      { genre: 'Pop', note: 'Pre-chorus engineering — form as emotional technology.' },
    ],
  },
  {
    id: 'expressionism',
    kind: 'philosophy',
    label: 'Expressionism',
    subtitle: 'Music as utterance of inner life',
    color: '#f472b6',
    philosophers: ['Susanne Langer', 'R.G. Collingwood', 'Jenefer Robinson'],
    quotes: [
      {
        text: 'Music is a tonal analogue of emotive life.',
        by: 'Susanne Langer, Philosophy in a New Key',
      },
    ],
    genres: ['Classical', 'R&B / Soul', 'Indie / Alt', 'Hip-Hop'],
    eras: ['common-practice', 'modern'],
    related: ['schopenhauer', 'formalism', 'phenomenology', 'embodied'],
    body: `<p>Expression theories ask how music can be sad without being a person. Langer’s answer:
      music presents the <strong>logical form of feeling</strong> — tension, release, growth — without
      naming objects. Other views say music arouses emotion, or that we imagine a persona who feels.</p>
      <p>Song genres make expression explicit via lyrics; instrumental traditions keep the puzzle vivid.
      Either way, listeners treat tracks as companions in mood — a core Cosmoly discovery pattern.</p>`,
    genreApps: [
      { genre: 'R&B / Soul', note: 'Voice as direct line to vulnerability and power.' },
      { genre: 'Indie / Alt', note: 'Understatement and timbre as emotional precision.' },
      { genre: 'Classical', note: 'Romantic persona and modernist “inner scream.”' },
      { genre: 'Hip-Hop', note: 'Autobiographical bars vs. character fiction.' },
      { genre: 'Country', note: 'Story-song as public feeling shared in plain speech.' },
      { genre: 'Jazz', note: 'Ballad improvisation as breath-shaped feeling.' },
    ],
  },
  {
    id: 'adorno',
    kind: 'philosophy',
    label: 'Adorno / Critical Theory',
    subtitle: 'Culture industry, standardization, and listening',
    color: '#c084fc',
    philosophers: ['Theodor W. Adorno', 'Max Horkheimer', 'Jacques Attali (adjacent)'],
    quotes: [
      {
        text: 'The culture industry perpetually cheats its consumers of what it perpetually promises.',
        by: 'Horkheimer & Adorno, Dialectic of Enlightenment',
      },
    ],
    genres: ['Pop', 'Hip-Hop', 'Electronic', 'Classical'],
    eras: ['modern'],
    related: ['formalism', 'platonic', 'afrofuturism', 'pop'],
    body: `<p>Adorno heard popular hits as standardized schemas that train <strong>regressive listening</strong> —
      recognition without autonomy. He praised difficult modernism as resistance. His tone is harsh, and
      later critics note blind spots around jazz, Black music, and pleasure.</p>
      <p>Still, the toolkit survives: ask who owns distribution, how hooks are A/B tested, whether
      playlists flatten difference. Cosmoly’s galaxy is partly an answer — affinity space instead of chart
      list — while remaining inside platform logics we should still interrogate.</p>`,
    genreApps: [
      { genre: 'Pop', note: 'Hook factories and attention metrics as culture industry 2.0.' },
      { genre: 'Hip-Hop', note: 'Major-label capture vs. underground autonomy — and mixtape gray zones.' },
      { genre: 'Electronic', note: 'Sample packs and preset culture vs. DIY synthesis.' },
      { genre: 'Classical', note: 'Canon formation as institutional power.' },
      { genre: 'Rock', note: 'Authenticity myths sold as anti-commercial product.' },
      { genre: 'Latin', note: 'Global streaming’s uneven royalties and language markets.' },
    ],
  },
  {
    id: 'phenomenology',
    kind: 'philosophy',
    label: 'Phenomenology',
    subtitle: 'Lived listening, time-consciousness, and presence',
    color: '#2dd4bf',
    philosophers: ['Edmund Husserl', 'Maurice Merleau-Ponty', 'Thomas Clifton', 'Don Ihde'],
    quotes: [
      {
        text: 'The melody is not a sum of tones; it is a temporal gestalt in which past and future are retained and protended.',
        by: 'Phenomenological paraphrase of Husserl on time-consciousness',
      },
    ],
    genres: ['Jazz', 'Ambient/Electronic', 'Classical', 'Folk'],
    eras: ['modern'],
    related: ['embodied', 'expressionism', 'confucian', 'electronic'],
    body: `<p>Phenomenology brackets abstract “works” to describe <strong>how listening is lived</strong>:
      retention of the just-heard, protention of the about-to-sound, the way a groove inhabits the body
      before analysis arrives. Merleau-Ponty helps us see listening as embodied perception, not data
      processing.</p>
      <p>In Cosmoly flight, proximity audio is already phenomenological design — music intensifies as you
      near a star, coupling space and hearing.</p>`,
    genreApps: [
      { genre: 'Jazz', note: 'Swing feel as bodily time, not metronome points.' },
      { genre: 'Electronic', note: 'Ambient and drone as laboratories of temporal horizon.' },
      { genre: 'Classical', note: 'Attentive concert listening as cultivated presence.' },
      { genre: 'Folk', note: 'Communal song as shared now.' },
      { genre: 'Metal', note: 'Breakdowns as visceral time-cuts in the body.' },
      { genre: 'R&B / Soul', note: 'Pocket and behind-the-beat singing as micro-phenomenology.' },
    ],
  },
  {
    id: 'embodied',
    kind: 'philosophy',
    label: 'Embodied Cognition',
    subtitle: 'Groove, mirror systems, and music in the flesh',
    color: '#f59e0b',
    philosophers: ['Marc Leman', 'Vijay Iyer', 'Lawrence Barsalou (broader cognition)', 'Arnie Cox'],
    quotes: [
      {
        text: 'We understand music by covertly simulating the actions and energetic shapes we hear.',
        by: 'Embodied music cognition (synthesis of Cox / Leman traditions)',
      },
    ],
    genres: ['Hip-Hop', 'Electronic', 'Jazz', 'Latin'],
    eras: ['modern'],
    related: ['phenomenology', 'expressionism', 'afrofuturism', 'hip-hop'],
    body: `<p>Embodied approaches argue that musical meaning is grounded in <strong>action, breath, and
      motor imagery</strong>. Syncopation invites prediction-error pleasure; bass couples to vestibular
      and tactile systems; dancers complete the track.</p>
      <p>This reframes “passive listening” as rare. Even still listeners micromove. Genres optimized for
      the club or the cypher are philosophies of the body written in BPM.</p>`,
    genreApps: [
      { genre: 'Hip-Hop', note: 'Head-nod as unit of understanding; MPC as prosthetic body.' },
      { genre: 'Latin', note: 'Clave and dance as inseparable cognition.' },
      { genre: 'Electronic', note: 'Four-on-the-floor as collective motor coupling.' },
      { genre: 'Jazz', note: 'Comp and solo as turn-taking motor dialogue.' },
      { genre: 'Metal', note: 'Moshing and air-drumming as extreme embodiment.' },
      { genre: 'Pop', note: 'Choreography-first singles train mirror participation.' },
    ],
  },
  {
    id: 'afrofuturism',
    kind: 'philosophy',
    label: 'Afrofuturism',
    subtitle: 'Speculative sound, diaspora time, and cosmic Black aesthetics',
    color: '#818cf8',
    philosophers: ['Sun Ra (artist-philosopher)', 'Kodwo Eshun', 'Alondra Nelson', 'Ytasha Womack'],
    quotes: [
      {
        text: 'Space is the place.',
        by: 'Sun Ra',
      },
      {
        text: 'The history of Black music is a history of the future.',
        by: 'Kodwo Eshun (paraphrase of More Brilliant Than the Sun)',
      },
    ],
    genres: ['Jazz', 'Hip-Hop', 'Electronic', 'R&B / Soul'],
    eras: ['modern'],
    related: ['schopenhauer', 'embodied', 'adorno', 'jazz'],
    body: `<p>Afrofuturism uses science-fiction imagery, technology, and myth to reimagine Black life beyond
      realist confinement. In sound: Sun Ra’s Arkestra, Parliament-Funkadelic motherships, Detroit techno’s
      android myths, Outkast and Janelle Monáe’s concept worlds, and countless producers treating the
      studio as a <strong>time machine</strong>.</p>
      <p>Cosmoly’s galaxy metaphor resonates here — stars, nebulas, flight — while Afrofuturism insists
      the cosmos is already peopled by diasporic invention, not empty frontier.</p>`,
    genreApps: [
      { genre: 'Jazz', note: 'Cosmic big-band and free jazz as liberation technologies.' },
      { genre: 'Hip-Hop', note: 'Sample collage as alternate timeline editing.' },
      { genre: 'Electronic', note: 'Techno/electro myths of the posthuman dancer.' },
      { genre: 'R&B / Soul', note: 'Futurist vocal production and visual albums.' },
      { genre: 'Metal', note: 'Speculative Black metal-adjacent and experimental crossovers.' },
      { genre: 'Pop', note: 'Concept-era worldbuilding as mainstream Afrofuturist craft.' },
    ],
  },
  /* Genre nodes for the 3D map */
  {
    id: 'hip-hop',
    kind: 'genre',
    label: 'Hip-Hop',
    subtitle: 'Sample, flow, and the ethics of the break',
    color: '#ff6ad5',
    philosophers: ['Tricia Rose', 'Paul D. Miller (DJ Spooky)', 'embodied & critical theorists'],
    quotes: [
      { text: 'Rap music is a black cultural expression that prioritizes black voices from the margins of urban America.', by: 'Tricia Rose, Black Noise' },
    ],
    genres: ['Hip-Hop'],
    eras: ['modern'],
    related: ['embodied', 'adorno', 'afrofuturism', 'expressionism'],
    body: `<p>Hip-hop philosophy centers the breakbeat, the cipher, and technological reuse. Sampling
      raises questions of authorship Adorno never imagined; battle culture stages Platonic agon; the
      head-nod is embodied truth. Catalog stars like Kendrick Lamar, Jay-Z, Missy Elliott, and Travis Scott
      map different ethical-aesthetic programs inside one nebula.</p>`,
  },
  {
    id: 'jazz',
    kind: 'genre',
    label: 'Jazz',
    subtitle: 'Improvisation as freedom within form',
    color: '#7af0ff',
    philosophers: ['Albert Murray', 'Amiri Baraka', 'phenomenologists of swing'],
    quotes: [
      { text: 'Improvisation is the courage to compose in public.', by: 'Jazz aesthetic proverb (educational paraphrase)' },
    ],
    genres: ['Jazz'],
    eras: ['modern'],
    related: ['phenomenology', 'afrofuturism', 'islamic-golden', 'embodied'],
    body: `<p>Jazz theorizes democracy in sound: individual voice inside ensemble law. From Armstrong’s
      swing to Coltrane’s sheets of sound to Kamasi Washington’s cosmic suites, the tradition keeps
      renegotiating what “freedom” means when everyone must still listen.</p>`,
  },
  {
    id: 'electronic',
    kind: 'genre',
    label: 'Electronic',
    subtitle: 'Studio-as-instrument and machine groove',
    color: '#60a5fa',
    philosophers: ['Kodwo Eshun', 'formalists of sound design'],
    quotes: [
      { text: 'The synthesizer is a philosophy of possible worlds made audible.', by: 'Cosmoly educational gloss' },
    ],
    genres: ['Electronic'],
    eras: ['modern'],
    related: ['formalism', 'pythagorean', 'afrofuturism', 'embodied'],
    body: `<p>Electronic music makes production choices — clock, filter, spatialization — into primary
      composition. From Daft Punk’s robot lore to Aphex Twin’s abstraction, the genre stages relations
      between human and machine that critical theory and Afrofuturism both track.</p>`,
  },
  {
    id: 'classical',
    kind: 'genre',
    label: 'Classical',
    subtitle: 'Notation, canon, and absolute music',
    color: '#e2e8f0',
    philosophers: ['Hanslick', 'Adorno', 'Pythagorean transmitters'],
    quotes: [
      { text: 'The score is a map; the performance is the territory — and neither is the listening.', by: 'Cosmoly educational gloss' },
    ],
    genres: ['Classical'],
    eras: ['ancient', 'medieval', 'common-practice', 'modern'],
    related: ['formalism', 'pythagorean', 'platonic', 'adorno'],
    body: `<p>“Classical” in Cosmoly shorthand covers notated art-music lineages and their global kin.
      Philosophy here wrestles with canon power, concert ritual, and whether beauty is form, expression,
      or social institution.</p>`,
  },
  {
    id: 'metal',
    kind: 'genre',
    label: 'Metal',
    subtitle: 'Sublime force, craft, and Dionysian noise',
    color: '#f87171',
    philosophers: ['Nietzschean readers of metal', 'formalists of riff'],
    quotes: [
      { text: 'The riff is a will that walks.', by: 'Cosmoly educational gloss' },
    ],
    genres: ['Metal'],
    eras: ['modern'],
    related: ['schopenhauer', 'formalism', 'embodied', 'platonic'],
    body: `<p>Metal intensifies volume, distortion, and technical discipline. Philosophically it courts
      the sublime and the Dionysian while obsessing over Apollonian virtuosity — a live debate Nietzsche
      would recognize. Catalog nodes include Metallica, Black Sabbath, Tool, and Rammstein.</p>`,
  },
  {
    id: 'folk',
    kind: 'genre',
    label: 'Folk / Vernacular',
    subtitle: 'Memory, oral theory, and communal time',
    color: '#86efac',
    philosophers: ['Ethnomusicological traditions', 'Confucian ritual parallels'],
    quotes: [
      { text: 'A folk song is a philosophy that survived without a footnote.', by: 'Cosmoly educational gloss' },
    ],
    genres: ['Folk', 'Country'],
    eras: ['ancient', 'medieval', 'common-practice', 'modern'],
    related: ['confucian', 'phenomenology', 'expressionism'],
    body: `<p>Vernacular traditions carry theory in practice: modes, stories, dance steps. Country and
      folk-adjacent catalog artists (Johnny Cash, Dolly Parton, Willie Nelson) show how plain speech
      and narrative remain philosophical vehicles.</p>`,
  },
  {
    id: 'pop',
    kind: 'genre',
    label: 'Pop',
    subtitle: 'Hook, surface, and soft power',
    color: '#f9a8d4',
    philosophers: ['Adorno (critique)', 'surface aesthetic defenders'],
    quotes: [
      { text: 'A chorus is a public contract about feeling.', by: 'Cosmoly educational gloss' },
    ],
    genres: ['Pop'],
    eras: ['modern'],
    related: ['adorno', 'platonic', 'expressionism', 'formalism'],
    body: `<p>Pop crystallizes attention. Its philosophy is often dismissed as shallow; better to ask how
      surfaces engineer solidarity and desire. Taylor Swift, Beyoncé, Billie Eilish, and The Weeknd
      offer rival theses on intimacy, spectacle, and authorship under capital.</p>`,
  },
]

export const DEEP_BY_ID: Record<string, DeepEntry> = Object.fromEntries(
  DEEP_ENTRIES.map((e) => [e.id, e]),
)

const GRAPH_PHILOSOPHY_IDS = [
  'pythagorean',
  'platonic',
  'confucian',
  'islamic-golden',
  'schopenhauer',
  'formalism',
  'expressionism',
  'adorno',
  'phenomenology',
  'embodied',
  'afrofuturism',
] as const

const GRAPH_LINKS: GraphLink[] = [
  { source: 'pythagorean', target: 'platonic' },
  { source: 'pythagorean', target: 'islamic-golden' },
  { source: 'pythagorean', target: 'formalism' },
  { source: 'platonic', target: 'confucian' },
  { source: 'platonic', target: 'adorno' },
  { source: 'platonic', target: 'expressionism' },
  { source: 'confucian', target: 'phenomenology' },
  { source: 'islamic-golden', target: 'formalism' },
  { source: 'islamic-golden', target: 'phenomenology' },
  { source: 'schopenhauer', target: 'expressionism' },
  { source: 'schopenhauer', target: 'adorno' },
  { source: 'schopenhauer', target: 'afrofuturism' },
  { source: 'formalism', target: 'expressionism' },
  { source: 'formalism', target: 'adorno' },
  { source: 'expressionism', target: 'phenomenology' },
  { source: 'expressionism', target: 'embodied' },
  { source: 'phenomenology', target: 'embodied' },
  { source: 'embodied', target: 'afrofuturism' },
  { source: 'adorno', target: 'afrofuturism' },
  { source: 'embodied', target: 'platonic' },
]

export const TIMELINE_ERAS: TimelineEra[] = [
  {
    id: 'paleolithic',
    label: 'Deep Antiquity',
    range: '~40,000 BCE → 3000 BCE',
    color: '#94a3b8',
    thoughts:
      'Music as ritual technology: bone flutes, drums, and voice coordinated hunt, mourning, and sacred time. Philosophy was enacted, not written — sound marked the boundary between human and spirit worlds.',
    historical: ['Anonymous ritual ensembles', 'Upper Paleolithic flutists (archaeological)'],
    catalog: [],
  },
  {
    id: 'ancient-axial',
    label: 'Axial & Classical',
    range: '~800 BCE → 400 CE',
    color: '#7af0ff',
    thoughts:
      'Greece links intervals to cosmos and character (Pythagoras, Plato, Aristotle). China theorizes yue as moral order. India develops rasa and disciplined listening. Music becomes explicit philosophy.',
    historical: ['Pythagoras', 'Plato', 'Confucius', 'Vedic and early raga lineages'],
    catalog: [],
  },
  {
    id: 'medieval',
    label: 'Medieval Worlds',
    range: '~400 → 1400',
    color: '#34d399',
    thoughts:
      'Chant and emerging polyphony in Europe; maqām science in Islamic courts; African polyrhythm and call-response as sophisticated oral theory. Treatises multiply; notation begins to freeze time.',
    historical: ['Guido of Arezzo', 'al-Fārābī', 'Léonin & Pérotin', 'Hildegard of Bingen'],
    catalog: [],
  },
  {
    id: 'renaissance',
    label: 'Renaissance',
    range: '~1400 → 1600',
    color: '#a78bfa',
    thoughts:
      'Humanism meets counterpoint: text expression, printing, and balanced polyphony. Music still sacred and courtly, but literacy widens who can theorize and compose.',
    historical: ['Josquin', 'Palestrina', 'Byrd', 'Zarlino'],
    catalog: [],
  },
  {
    id: 'baroque-classical',
    label: 'Baroque → Classical',
    range: '~1600 → 1820',
    color: '#60a5fa',
    thoughts:
      'Tonality consolidates; affect theory and then enlightened form. Public concerts rise. Absolute music begins to claim autonomy from word and church.',
    historical: ['Bach', 'Handel', 'Haydn', 'Mozart', 'early Beethoven'],
    catalog: [],
  },
  {
    id: 'romantic',
    label: 'Romantic',
    range: '~1820 → 1900',
    color: '#fb7185',
    thoughts:
      'Composer-genius, nationalism, expanded harmony. Schopenhauer and later Nietzsche make music metaphysical. Folk collection feeds art music even as vernacular streams stay independent.',
    historical: ['Wagner', 'Chopin', 'Liszt', 'Schopenhauer', 'Nietzsche'],
    catalog: ['Johnny Cash', 'Willie Nelson'],
  },
  {
    id: 'early-modern',
    label: 'Early Modernisms',
    range: '~1900 → 1945',
    color: '#f472b6',
    thoughts:
      'Tonality cracks; jazz becomes a major art of the Atlantic world; recording invents the reproducible work. Adorno begins diagnosing the culture industry as radio spreads.',
    historical: ['Schoenberg', 'Stravinsky', 'Louis Armstrong', 'Bessie Smith', 'Duke Ellington'],
    catalog: ['Louis Armstrong', 'The Rolling Stones'],
  },
  {
    id: 'postwar',
    label: 'Postwar Explosion',
    range: '~1945 → 1980',
    color: '#fbbf24',
    thoughts:
      'Rock, soul, free jazz, disco, reggae, electronic studios. Embodied youth cultures rewrite listening. Sun Ra and others seed Afrofuturist cosmologies. Formalism and expressionism duel in academia.',
    historical: ['John Coltrane', 'Aretha Franklin', 'The Beatles', 'Black Sabbath', 'Kraftwerk'],
    catalog: [
      'The Beatles',
      'Aretha Franklin',
      'Stevie Wonder',
      'Miles Davis',
      'John Coltrane',
      'Black Sabbath',
      'Queen',
      'Nirvana',
    ],
  },
  {
    id: 'digital',
    label: 'Hip-Hop & Digital',
    range: '~1980 → 2005',
    color: '#ff6ad5',
    thoughts:
      'Sampling ethics, MTV spectacle, rave embodiment, global pop pipelines. Critical theory meets turntablism. The studio laptop democratizes production while majors reconsolidate.',
    historical: ['Grandmaster Flash', 'Public Enemy', 'Madonna', 'Aphex Twin', 'Missy Elliott'],
    catalog: [
      'Missy Elliott',
      'Jay-Z',
      'Daft Punk',
      'Aphex Twin',
      'Metallica',
      'Radiohead',
      'Celia Cruz',
    ],
  },
  {
    id: 'streaming',
    label: 'Streaming Present',
    range: '~2005 → now',
    color: '#7af0ff',
    thoughts:
      'Playlists as soft canons; TikTok micro-forms; spatial audio; AI assists. Phenomenology of infinite scroll meets culture-industry metrics. Cosmoly proposes galaxy flight as an alternate map of curiosity.',
    historical: ['Platform-era producers worldwide', 'Bedroom polymaths', 'Global bass networks'],
    catalog: [
      'Kendrick Lamar',
      'Beyoncé',
      'Taylor Swift',
      'Billie Eilish',
      'Bad Bunny',
      'SZA',
      'Tame Impala',
      'Rosalía',
      'Travis Scott',
      'Phoebe Bridgers',
    ],
  },
]

/* ─── Public API ────────────────────────────────────────────────────────── */

export type PhilosophyWebHandle = {
  activate: () => void
  deactivate: () => void
  dispose: () => void
}

export function philosophyWebSectionHtml(): string {
  return `
  <section class="phil-section phil-web-block" id="phil-web">
    <p class="kicker">SIVYIS Corp · Interactive</p>
    <h2>Philosophy Web</h2>
    <p class="phil-lead" style="margin-bottom:18px">A living map of ideas about music: click nodes in the
      web or cosmos for deep reads; scrub eras to hear how thought and artists shift across time.
      Educational overview — links between schools and genres are interpretive, not dogma.</p>

    <div class="pweb-subnav" role="tablist" aria-label="Philosophy Web views">
      <button type="button" class="pweb-tab active" data-pweb="graph" role="tab" aria-selected="true">Philosophy Web</button>
      <button type="button" class="pweb-tab" data-pweb="timeline" role="tab" aria-selected="false">Timeline</button>
      <button type="button" class="pweb-tab" data-pweb="cosmos" role="tab" aria-selected="false">3D Music Map</button>
    </div>

    <div class="pweb-panels">
      <div class="pweb-panel active" data-panel="graph" role="tabpanel">
        <p class="pweb-hint">Drag the web lightly · tap a school for genre applications &amp; deep read</p>
        <div class="pweb-graph-wrap">
          <canvas id="pweb-graph" width="800" height="520" aria-label="Music philosophy force graph"></canvas>
        </div>
        <div id="pweb-graph-legend" class="pweb-legend"></div>
      </div>

      <div class="pweb-panel" data-panel="timeline" role="tabpanel" hidden>
        <p class="pweb-hint">Scroll or tap an era · expands thoughts &amp; artists</p>
        <div class="pweb-timeline-scroll" id="pweb-timeline-track"></div>
        <div id="pweb-timeline-detail" class="pweb-timeline-detail"></div>
      </div>

      <div class="pweb-panel" data-panel="cosmos" role="tabpanel" hidden>
        <p class="pweb-hint">Drag to orbit · pinch/scroll to zoom · tap a node for deep read</p>
        <div class="pweb-cosmos-wrap" id="pweb-cosmos-wrap">
          <canvas id="pweb-cosmos" aria-label="3D music philosophy cosmos"></canvas>
        </div>
      </div>
    </div>
  </section>

  <aside id="pweb-deep" class="pweb-deep" aria-hidden="true" hidden>
    <div class="pweb-deep-inner">
      <button type="button" class="pweb-deep-close" id="pweb-deep-close" aria-label="Close deep read">← Back</button>
      <div id="pweb-deep-body"></div>
    </div>
  </aside>
  `
}

export function mountPhilosophyWeb(philRoot: HTMLElement): PhilosophyWebHandle {
  const graphCanvas = philRoot.querySelector<HTMLCanvasElement>('#pweb-graph')
  const cosmosCanvas = philRoot.querySelector<HTMLCanvasElement>('#pweb-cosmos')
  const cosmosWrap = philRoot.querySelector<HTMLElement>('#pweb-cosmos-wrap')
  const deepEl = philRoot.querySelector<HTMLElement>('#pweb-deep')
  const deepBody = philRoot.querySelector<HTMLElement>('#pweb-deep-body')
  const deepClose = philRoot.querySelector<HTMLButtonElement>('#pweb-deep-close')
  const timelineTrack = philRoot.querySelector<HTMLElement>('#pweb-timeline-track')
  const timelineDetail = philRoot.querySelector<HTMLElement>('#pweb-timeline-detail')
  const legend = philRoot.querySelector<HTMLElement>('#pweb-graph-legend')

  if (!graphCanvas || !cosmosCanvas || !cosmosWrap || !deepEl || !deepBody || !deepClose || !timelineTrack || !timelineDetail) {
    return { activate() {}, deactivate() {}, dispose() {} }
  }

  let active = false
  let disposed = false
  let currentPanel: 'graph' | 'timeline' | 'cosmos' = 'graph'

  /* —— Deep read —— */
  const openDeep = (id: string) => {
    const entry = DEEP_BY_ID[id]
    if (!entry) return
    deepBody.innerHTML = renderDeep(entry)
    deepEl.hidden = false
    deepEl.setAttribute('aria-hidden', 'false')
    deepEl.classList.add('open')
    deepBody.querySelectorAll<HTMLElement>('[data-deep-link]').forEach((a) => {
      a.addEventListener('click', () => openDeep(a.dataset.deepLink!))
    })
  }

  const closeDeep = () => {
    deepEl.classList.remove('open')
    deepEl.setAttribute('aria-hidden', 'true')
    deepEl.hidden = true
  }
  deepClose.addEventListener('click', closeDeep)

  /* —— Tabs —— */
  const tabs = philRoot.querySelectorAll<HTMLButtonElement>('.pweb-tab')
  const panels = philRoot.querySelectorAll<HTMLElement>('.pweb-panel')
  const setPanel = (name: 'graph' | 'timeline' | 'cosmos') => {
    currentPanel = name
    tabs.forEach((t) => {
      const on = t.dataset.pweb === name
      t.classList.toggle('active', on)
      t.setAttribute('aria-selected', String(on))
    })
    panels.forEach((p) => {
      const on = p.dataset.panel === name
      p.classList.toggle('active', on)
      p.hidden = !on
    })
    if (name === 'cosmos' && active) cosmos.start()
    else {
      cosmos.stop()
      cosmos.release()
    }
    if (name === 'graph' && active) graph.start()
    else if (name !== 'graph') graph.stop()
  }
  tabs.forEach((t) => {
    t.addEventListener('click', () => setPanel(t.dataset.pweb as typeof currentPanel))
  })

  /* —— Graph —— */
  const graph = createForceGraph(graphCanvas, {
    onSelect: openDeep,
    legendEl: legend,
  })

  /* —— Timeline —— */
  buildTimeline(timelineTrack, timelineDetail, openDeep)

  /* —— Cosmos —— */
  const cosmos = createCosmosMap(cosmosCanvas, cosmosWrap, { onSelect: openDeep })

  const onResize = () => {
    graph.resize()
    if (currentPanel === 'cosmos') cosmos.resize()
  }
  window.addEventListener('resize', onResize)

  return {
    activate() {
      if (disposed) return
      active = true
      if (currentPanel === 'graph') graph.start()
      if (currentPanel === 'cosmos') cosmos.start()
    },
    deactivate() {
      active = false
      graph.stop()
      cosmos.stop()
      cosmos.release()
      closeDeep()
    },
    dispose() {
      disposed = true
      active = false
      graph.dispose()
      cosmos.dispose()
      closeDeep()
      window.removeEventListener('resize', onResize)
    },
  }
}

/* ─── Deep read HTML ────────────────────────────────────────────────────── */

function renderDeep(entry: DeepEntry): string {
  const quotes = entry.quotes
    .map(
      (q) => `<blockquote class="pweb-quote"><p>“${escapeHtml(q.text)}”</p><cite>— ${escapeHtml(q.by)}</cite></blockquote>`,
    )
    .join('')
  const philosophers = entry.philosophers.map((p) => `<li>${escapeHtml(p)}</li>`).join('')
  const genres = entry.genres.map((g) => `<span class="pweb-chip">${escapeHtml(g)}</span>`).join('')
  const eras = entry.eras.map((e) => `<span class="pweb-chip muted">${escapeHtml(e)}</span>`).join('')
  const related = entry.related
    .filter((id) => DEEP_BY_ID[id])
    .map(
      (id) =>
        `<button type="button" class="pweb-chip link" data-deep-link="${id}">${escapeHtml(DEEP_BY_ID[id].label)}</button>`,
    )
    .join('')
  const apps = (entry.genreApps ?? [])
    .map(
      (a) =>
        `<div class="pweb-app"><strong>${escapeHtml(a.genre)}</strong><span>${escapeHtml(a.note)}</span></div>`,
    )
    .join('')

  const vis = ENTRY_VISUALS[entry.id]
  const portraitNames = vis?.portraits ?? entry.philosophers
  const portraitCards = portraitNames
    .map((name) => {
      const img = resolvePortrait(name)
      return img ? portraitCardHtml(name, img) : ''
    })
    .filter(Boolean)
    .join('')
  const portraitBlock = portraitCards
    ? `<div class="phil-portrait-row">${portraitCards}</div>`
    : ''
  const diagramBlock =
    vis?.diagram && DIAGRAMS[vis.diagram]
      ? figureHtml(DIAGRAMS[vis.diagram], 'phil-figure--deep')
      : ''

  return `
    <p class="kicker">${escapeHtml(entry.kind)} · Cosmoly</p>
    <div class="pweb-deep-head">
      ${portraitBlock}
      <div class="pweb-deep-titles">
        <h2>${escapeHtml(entry.label)}</h2>
        <p class="pweb-sub">${escapeHtml(entry.subtitle)}</p>
      </div>
    </div>
    ${diagramBlock}
    <div class="pweb-deep-prose">${entry.body}</div>
    ${apps ? `<h3>Across genres</h3><div class="pweb-apps">${apps}</div>` : ''}
    <h3>Associated thinkers</h3>
    <ul class="pweb-plist">${philosophers}</ul>
    ${quotes ? `<h3>Sayings on music</h3>${quotes}` : ''}
    <h3>Related</h3>
    <div class="pweb-chip-row">${genres}${eras}${related}</div>
    <p class="pweb-fine">Educational paraphrase · verify primary texts for scholarship</p>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ─── 2D Force graph ────────────────────────────────────────────────────── */

function createForceGraph(
  canvas: HTMLCanvasElement,
  opts: { onSelect: (id: string) => void; legendEl: HTMLElement | null },
) {
  const ctx = canvas.getContext('2d')!
  const nodes: SimNode[] = GRAPH_PHILOSOPHY_IDS.map((id, i) => {
    const e = DEEP_BY_ID[id]
    const ang = (i / GRAPH_PHILOSOPHY_IDS.length) * Math.PI * 2 - Math.PI / 2
    return {
      id,
      label: e.label,
      color: e.color,
      r: 22,
      x: Math.cos(ang) * 140,
      y: Math.sin(ang) * 110,
      vx: 0,
      vy: 0,
    }
  })
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const links = GRAPH_LINKS.filter((l) => byId[l.source] && byId[l.target])

  if (opts.legendEl) {
    opts.legendEl.innerHTML = nodes
      .map((n) => {
        const vis = ENTRY_VISUALS[n.id]
        const first = vis?.portraits?.[0]
        const img = first ? resolvePortrait(first) : undefined
        const thumb = img
          ? `<img class="pweb-legend-thumb" src="${img.src}" alt="" loading="lazy" decoding="async" />`
          : `<i style="background:${n.color}"></i>`
        return `<button type="button" class="pweb-legend-item" data-id="${n.id}">${thumb}${escapeHtml(n.label)}</button>`
      })
      .join('')
    opts.legendEl.querySelectorAll<HTMLElement>('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => opts.onSelect(btn.dataset.id!))
    })
  }

  let raf = 0
  let running = false
  let dragging: SimNode | null = null
  let moved = false
  let ox = 0
  let oy = 0
  let dpr = 1
  let w = 0
  let h = 0

  const resize = () => {
    const wrap = canvas.parentElement
    const cssW = wrap?.clientWidth || 360
    const cssH = Math.max(320, Math.min(520, Math.round(cssW * 0.72)))
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = cssW
    h = cssH
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const sim = () => {
    const cx = w / 2
    const cy = h / 2
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.0008
      n.vy += (cy - n.y) * 0.0008
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy) || 0.01
        const min = a.r + b.r + 36
        if (dist < min) {
          const push = ((min - dist) / dist) * 0.04
          dx *= push
          dy *= push
          a.vx -= dx
          a.vy -= dy
          b.vx += dx
          b.vy += dy
        } else {
          const soft = 12 / (dist * dist)
          a.vx -= dx * soft
          a.vy -= dy * soft
          b.vx += dx * soft
          b.vy += dy * soft
        }
      }
    }
    for (const l of links) {
      const a = byId[l.source]
      const b = byId[l.target]
      let dx = b.x - a.x
      let dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.01
      const target = 118
      const pull = ((dist - target) / dist) * 0.012
      dx *= pull
      dy *= pull
      a.vx += dx
      a.vy += dy
      b.vx -= dx
      b.vy -= dy
    }
    for (const n of nodes) {
      if (n === dragging) continue
      n.vx *= 0.86
      n.vy *= 0.86
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(n.r + 8, Math.min(w - n.r - 8, n.x))
      n.y = Math.max(n.r + 8, Math.min(h - n.r - 8, n.y))
    }
  }

  const draw = () => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.55)
    g.addColorStop(0, 'rgba(90,40,160,0.18)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    ctx.lineWidth = 1.2
    for (const l of links) {
      const a = byId[l.source]
      const b = byId[l.target]
      ctx.strokeStyle = 'rgba(122,240,255,0.22)'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    for (const n of nodes) {
      ctx.beginPath()
      ctx.fillStyle = n.color
      ctx.globalAlpha = 0.95
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.stroke()
      ctx.fillStyle = '#0a0618'
      ctx.font = '600 10px "Exo 2", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const parts = n.label.split(' ')
      if (parts.length > 1 && n.label.length > 10) {
        ctx.fillText(parts[0], n.x, n.y - 5)
        ctx.fillText(parts.slice(1).join(' '), n.x, n.y + 7)
      } else {
        ctx.fillText(n.label.length > 12 ? n.label.slice(0, 11) + '…' : n.label, n.x, n.y)
      }
    }
  }

  const tick = () => {
    if (!running) return
    sim()
    draw()
    raf = requestAnimationFrame(tick)
  }

  const pick = (x: number, y: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (Math.hypot(n.x - x, n.y - y) <= n.r + 4) return n
    }
    return null
  }

  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = (e: PointerEvent) => {
    const p = local(e)
    const hit = pick(p.x, p.y)
    if (!hit) return
    dragging = hit
    moved = false
    ox = p.x - hit.x
    oy = p.y - hit.y
    hit.vx = 0
    hit.vy = 0
    canvas.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    const p = local(e)
    const nx = p.x - ox
    const ny = p.y - oy
    if (Math.hypot(nx - dragging.x, ny - dragging.y) > 3) moved = true
    dragging.x = nx
    dragging.y = ny
  }
  const onUp = (e: PointerEvent) => {
    if (!dragging) return
    const id = dragging.id
    dragging = null
    if (!moved) opts.onSelect(id)
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.style.touchAction = 'none'

  // Offset initial positions into canvas space after first resize
  const boot = () => {
    resize()
    for (const n of nodes) {
      n.x += w / 2
      n.y += h / 2
    }
    draw()
  }
  boot()

  return {
    start() {
      if (running) return
      running = true
      resize()
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    resize() {
      const prevW = w
      const prevH = h
      resize()
      if (prevW && prevH) {
        const sx = w / prevW
        const sy = h / prevH
        for (const n of nodes) {
          n.x *= sx
          n.y *= sy
        }
      }
      draw()
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    },
  }
}

/* ─── Timeline ──────────────────────────────────────────────────────────── */

function buildTimeline(
  track: HTMLElement,
  detail: HTMLElement,
  onOpenDeep: (id: string) => void,
) {
  track.innerHTML = TIMELINE_ERAS.map(
    (era, i) => `
    <button type="button" class="pweb-era${i === TIMELINE_ERAS.length - 1 ? ' active' : ''}" data-era="${era.id}" style="--era:${era.color}">
      <span class="pweb-era-range">${escapeHtml(era.range)}</span>
      <span class="pweb-era-label">${escapeHtml(era.label)}</span>
    </button>`,
  ).join('')

  const show = (id: string) => {
    const era = TIMELINE_ERAS.find((e) => e.id === id)
    if (!era) return
    track.querySelectorAll('.pweb-era').forEach((el) => {
      el.classList.toggle('active', (el as HTMLElement).dataset.era === id)
    })
    const hist = era.historical.map((n) => `<li>${escapeHtml(n)}</li>`).join('')
    const cat = era.catalog
      .map((n) => `<li><span class="pweb-cat">${escapeHtml(n)}</span> <em>in Cosmoly catalog</em></li>`)
      .join('')
    const philHints = DEEP_ENTRIES.filter(
      (e) => e.kind === 'philosophy' && e.eras.some((x) => eraFits(x, era.id)),
    )
      .slice(0, 4)
      .map(
        (e) =>
          `<button type="button" class="pweb-chip link" data-deep-link="${e.id}">${escapeHtml(e.label)}</button>`,
      )
      .join('')

    detail.innerHTML = `
      <div class="pweb-td-card" style="--era:${era.color}">
        <p class="kicker">${escapeHtml(era.range)}</p>
        <h3>${escapeHtml(era.label)}</h3>
        <p>${escapeHtml(era.thoughts)}</p>
        <h4>Thinkers &amp; figures of the era</h4>
        <ul>${hist || '<li>Oral / anonymous traditions</li>'}</ul>
        ${cat ? `<h4>Cosmoly catalog artists (era affinity)</h4><ul>${cat}</ul>` : ''}
        ${philHints ? `<h4>Related philosophies</h4><div class="pweb-chip-row">${philHints}</div>` : ''}
      </div>
    `
    detail.querySelectorAll<HTMLElement>('[data-deep-link]').forEach((btn) => {
      btn.addEventListener('click', () => onOpenDeep(btn.dataset.deepLink!))
    })
  }

  track.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((btn) => {
    btn.addEventListener('click', () => show(btn.dataset.era!))
  })
  show(TIMELINE_ERAS[TIMELINE_ERAS.length - 1].id)
}

function eraFits(entryEra: string, timelineId: string): boolean {
  const map: Record<string, string[]> = {
    ancient: ['paleolithic', 'ancient-axial'],
    medieval: ['medieval', 'renaissance'],
    'common-practice': ['baroque-classical', 'romantic'],
    modern: ['early-modern', 'postwar', 'digital', 'streaming'],
  }
  return (map[entryEra] ?? []).includes(timelineId)
}

/* ─── 3D Cosmos map ─────────────────────────────────────────────────────── */

function createCosmosMap(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  opts: { onSelect: (id: string) => void },
) {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let controls: OrbitControls | null = null
  let raf = 0
  let running = false
  let nodeMeshes: THREE.Mesh[] = []
  let linkLines: THREE.LineSegments | null = null
  let stars: THREE.Points | null = null
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let linkMat: THREE.LineBasicMaterial | null = null

  const mapIds = [
    ...GRAPH_PHILOSOPHY_IDS,
    'hip-hop',
    'jazz',
    'electronic',
    'classical',
    'metal',
    'folk',
    'pop',
  ]

  const ensure = () => {
    if (renderer) return
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    camera.position.set(0, 2.2, 11)
    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 5
    controls.maxDistance = 22
    controls.enablePan = false
    controls.rotateSpeed = 0.85
    canvas.style.touchAction = 'none'

    scene.add(new THREE.AmbientLight(0x6688ff, 0.55))
    const key = new THREE.PointLight(0x7af0ff, 1.2, 40)
    key.position.set(4, 6, 8)
    scene.add(key)
    const rim = new THREE.PointLight(0xff6ad5, 0.7, 40)
    rim.position.set(-6, -2, -4)
    scene.add(rim)

    // starfield
    const starCount = 400
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 28
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
      starPos[i * 3 + 2] = r * Math.cos(ph)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xb8c8ff, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.7 }),
    )
    scene.add(stars)

    const golden = Math.PI * (3 - Math.sqrt(5))
    nodeMeshes = []
    const positions = new Map<string, THREE.Vector3>()
    mapIds.forEach((id, i) => {
      const entry = DEEP_BY_ID[id]
      if (!entry) return
      const y = 1 - (i / (mapIds.length - 1)) * 2
      const radius = Math.sqrt(1 - y * y) * 4.2
      const theta = golden * i
      const pos = new THREE.Vector3(Math.cos(theta) * radius, y * 3.2, Math.sin(theta) * radius)
      positions.set(id, pos)
      const isPhil = entry.kind === 'philosophy'
      const geo = new THREE.SphereGeometry(isPhil ? 0.28 : 0.22, 20, 20)
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(entry.color),
        emissive: new THREE.Color(entry.color),
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.35,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.userData.id = id
      scene!.add(mesh)
      nodeMeshes.push(mesh)

      // sprite label
      const label = makeLabelSprite(entry.label, entry.color)
      label.position.copy(pos).add(new THREE.Vector3(0, isPhil ? 0.45 : 0.38, 0))
      label.userData.id = id
      scene!.add(label)
    })

    const segs: number[] = []
    const addLink = (a: string, b: string) => {
      const pa = positions.get(a)
      const pb = positions.get(b)
      if (!pa || !pb) return
      segs.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
    }
    for (const l of GRAPH_LINKS) addLink(l.source, l.target)
    // genre bridges (interpretive)
    const bridges: GraphLink[] = [
      { source: 'embodied', target: 'hip-hop' },
      { source: 'afrofuturism', target: 'jazz' },
      { source: 'afrofuturism', target: 'electronic' },
      { source: 'formalism', target: 'classical' },
      { source: 'schopenhauer', target: 'metal' },
      { source: 'adorno', target: 'pop' },
      { source: 'confucian', target: 'folk' },
      { source: 'expressionism', target: 'hip-hop' },
      { source: 'pythagorean', target: 'electronic' },
      { source: 'phenomenology', target: 'jazz' },
    ]
    for (const l of bridges) addLink(l.source, l.target)

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3))
    linkMat = new THREE.LineBasicMaterial({ color: 0x7af0ff, transparent: true, opacity: 0.28 })
    linkLines = new THREE.LineSegments(lineGeo, linkMat)
    scene.add(linkLines)

    resize()
  }

  const makeLabelSprite = (text: string, color: string) => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const cctx = c.getContext('2d')!
    cctx.clearRect(0, 0, 256, 64)
    cctx.fillStyle = 'rgba(8,6,24,0.72)'
    cctx.beginPath()
    const x = 8, y = 12, rw = 240, rh = 40, r = 12
    cctx.moveTo(x + r, y)
    cctx.arcTo(x + rw, y, x + rw, y + rh, r)
    cctx.arcTo(x + rw, y + rh, x, y + rh, r)
    cctx.arcTo(x, y + rh, x, y, r)
    cctx.arcTo(x, y, x + rw, y, r)
    cctx.closePath()
    cctx.fill()
    cctx.strokeStyle = color
    cctx.lineWidth = 2
    cctx.stroke()
    cctx.fillStyle = '#eef3ff'
    cctx.font = '600 22px "Exo 2", sans-serif'
    cctx.textAlign = 'center'
    cctx.textBaseline = 'middle'
    cctx.fillText(text.length > 18 ? text.slice(0, 17) + '…' : text, 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(1.8, 0.45, 1)
    return spr
  }

  const resize = () => {
    if (!renderer || !camera) return
    const cssW = wrap.clientWidth || 360
    const cssH = Math.max(280, Math.min(480, Math.round(cssW * 0.85)))
    wrap.style.height = `${cssH}px`
    renderer.setSize(cssW, cssH, false)
    camera.aspect = cssW / cssH
    camera.updateProjectionMatrix()
  }

  const tick = () => {
    if (!running || !renderer || !scene || !camera || !controls) return
    controls.update()
    if (stars) stars.rotation.y += 0.00035
    if (linkMat) linkMat.opacity = 0.22 + Math.sin(performance.now() * 0.0015) * 0.06
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }

  let ptrDown = { x: 0, y: 0, t: 0 }
  const onPointerDown = (e: PointerEvent) => {
    ptrDown = { x: e.clientX, y: e.clientY, t: performance.now() }
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!camera || !scene) return
    const dist = Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y)
    if (dist > 8 || performance.now() - ptrDown.t > 500) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(nodeMeshes, false)
    if (hits[0]) {
      const id = hits[0].object.userData.id as string
      if (id) opts.onSelect(id)
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)

  const releaseGpu = () => {
      running = false
      cancelAnimationFrame(raf)
      controls?.dispose()
      controls = null
      if (scene) {
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite) {
            obj.geometry?.dispose()
            const m = obj.material
            if (Array.isArray(m)) m.forEach((x) => disposeMat(x))
            else if (m) disposeMat(m)
          }
        })
        scene.clear()
      }
      renderer?.dispose()
      renderer = null
      scene = null
      camera = null
      nodeMeshes = []
      linkLines = null
      stars = null
      linkMat = null
    }

  return {
    start() {
      if (running) return
      ensure()
      resize()
      running = true
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    release() {
      releaseGpu()
    },
    resize,
    dispose() {
      releaseGpu()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
    },
  }
}

function disposeMat(m: THREE.Material) {
  const mat = m as THREE.MeshStandardMaterial & { map?: THREE.Texture | null }
  mat.map?.dispose()
  m.dispose()
}
