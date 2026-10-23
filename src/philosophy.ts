/** Music Philosophy & Theory — educational content for the Philosophy tab. */

import { philosophyWebSectionHtml } from './philosophyWeb.ts'
import { DIAGRAMS, figureHtml } from './philosophyImages.ts'

export type PhilSection = {
  id: string
  title: string
  kicker: string
  html: string
}

export const PHILOSOPHY_INTRO = `
  <p class="phil-lead">Music is one of humanity’s oldest technologies of meaning: vibration organized in time,
  shared across bodies, cultures, and eras. This guide walks from deep antiquity to the present —
  history, perception, philosophy, and theory — so that flying the Cosmoly galaxy is not only
  discovery of artists, but a deeper hearing of why music moves us.</p>
`

export const PHILOSOPHY_SECTIONS: PhilSection[] = [
  {
    id: 'ancient',
    kicker: 'Origins',
    title: 'Ancient times: ritual, cosmos, and the first scales',
    html: `
      <p>Long before notation or markets, music lived in <strong>ritual and work</strong>: chant around fire,
      drum for dance and war, voice for mourning and birth. Archaeological finds — bone flutes from the
      Upper Paleolithic, Sumerian hymn tablets, Egyptian temple ensembles — suggest that pitch and rhythm
      were already tools for coordinating groups and marking sacred time.</p>
      <p>In Mesopotamia and Egypt, musicians held priestly or court status. In China, the
      <em>Yueji</em> and later Confucian thought treated music as a moral force that could order society
      when modes and ceremonies were right. In India, the Vedic tradition fused mantra, meter, and
      cosmology; later <em>raga</em> and <em>tala</em> systems framed music as a path of disciplined
      listening and emotional color (<em>rasa</em>).</p>
      <p>The ancient Greeks made music a pillar of education and metaphysics. Pythagoras linked intervals
      to numerical ratios (octave 2:1, fifth 3:2), casting harmony as a window onto cosmic order —
      the “music of the spheres.” Plato warned that modes shape character; Aristotle treated music as
      catharsis and ethical training. These ideas — that <strong>sound structures soul and world</strong> —
      echo through Western philosophy of art to this day.</p>
      ${figureHtml(DIAGRAMS['pythagorean-ratios'], 'phil-figure--inline')}
      ${figureHtml(DIAGRAMS.tetrachord, 'phil-figure--inline')}
      <ul>
        <li><strong>~40,000 BCE+</strong> — Early flutes and possible ritual percussion</li>
        <li><strong>~2000 BCE</strong> — Hurrian hymns (Ugarit); early notated song</li>
        <li><strong>~500 BCE</strong> — Pythagorean acoustics; Chinese and Indian modal systems mature</li>
        <li><strong>Classical Greece & Rome</strong> — Ethos of modes; music in drama and civic life</li>
      </ul>
    `,
  },
  {
    id: 'medieval',
    kicker: 'Middle ages → Renaissance',
    title: 'Sacred lines, polyphony, and the birth of theory books',
    html: `
      <p>Medieval Europe’s plainchant organized worship in monophonic lines; Guido of Arezzo’s staff and
      solmization made teaching scalable. As organum grew into Notre Dame polyphony (Léonin, Pérotin),
      <strong>vertical harmony</strong> became a craft: independent voices coordinated in time.</p>
      <p>The Ars Nova (14th c.) refined mensural rhythm; the Renaissance (Josquin, Palestrina, Byrd)
      prized balance, imitation, and text expression. Parallel traditions flourished elsewhere: Persian
      and Arabic maqam, Ottoman court music, African polyrhythm and call-and-response, East Asian court
      and folk repertoires — each with deep oral-theoretical lineages.</p>
      <p>Theory crystallized into treatises: intervals, modes/scales, counterpoint rules. Music remained
      tied to the divine and the court, yet printing and trade began to widen who could learn and hear.</p>
      ${figureHtml(DIAGRAMS.hexachord, 'phil-figure--inline')}
      <ul>
        <li><strong>9th–13th c.</strong> — Chant, organum, early polyphony</li>
        <li><strong>14th c.</strong> — Ars Nova rhythmic notation</li>
        <li><strong>15th–16th c.</strong> — Renaissance polyphony; music printing</li>
      </ul>
    `,
  },
  {
    id: 'common-practice',
    kicker: '1600–1900',
    title: 'Tonality, the concert, and the romantic self',
    html: `
      <p>The Baroque era established major/minor tonality, basso continuo, and affective rhetoric
      (Bach, Handel, Vivaldi). The Classical style (Haydn, Mozart, early Beethoven) clarified form —
      sonata, symphony, string quartet — and the public concert as a social institution.</p>
      ${figureHtml(DIAGRAMS['circle-of-fifths'], 'phil-figure--inline')}
      <p>Romanticism intensified subjectivity: the composer-genius, expanded harmony, program music,
      national schools, and the piano as domestic and virtuosic center. Opera and lieder made narrative
      and personal emotion central. By the late 19th century, chromaticism strained tonal gravity
      (Wagner, Liszt, late Chopin), preparing the ruptures of modernism.</p>
      <p>Meanwhile, folk and vernacular streams — blues ancestors, European dance forms, Latin American
      syncretisms, African diasporic practices — carried rhythmic and melodic knowledge that would
      remake popular music in the 20th century.</p>
      <ul>
        <li><strong>Baroque</strong> — Tonality, counterpoint, affect</li>
        <li><strong>Classical</strong> — Form, balance, public concert life</li>
        <li><strong>Romantic</strong> — Expression, nationalism, expanded harmony</li>
      </ul>
    `,
  },
  {
    id: 'modern',
    kicker: '1900–present',
    title: 'Modernisms, recording, and the global now',
    html: `
      <p>The 20th century shattered and rebuilt listening. Debussy’s color, Stravinsky’s rhythm,
      Schoenberg’s twelve-tone method, jazz improvisation, blues → R&B → rock, electronic studios,
      hip-hop’s sampling culture, and digital distribution each redefined authorship, ownership, and
      what counts as a “work.”</p>
      <p>Recording made music a reproducible object and a spatial art (stereo, multitrack, spatial audio).
      Radio, vinyl, cassette, CD, streaming, and live-coded performance changed how genres form and
      travel. Globalization and the internet densified influence: a nebula of styles can appear overnight.</p>
      <p>Cosmoly’s galaxy metaphor fits this era: artists as stars in genre nebulas, discovery as flight,
      listening as proximity. Theory today includes acoustics, cognition, ethnomusicology, media studies,
      and the ethics of platforms and payment — including experiments like peer-to-peer tips in Bitcoin.</p>
      <ul>
        <li><strong>Early 1900s</strong> — Modernist rupture; jazz as major art</li>
        <li><strong>Mid-century</strong> — Rock, soul, electronic, studio-as-instrument</li>
        <li><strong>Late 20th → now</strong> — Hip-hop, global pop, digital production & streaming</li>
      </ul>
    `,
  },
  {
    id: 'perception',
    kicker: 'Mind & body',
    title: 'Philosophy and perception: how music is heard',
    html: `
      <p><strong>Acoustics</strong> gives us frequency, amplitude, spectrum, and envelope. But hearing is not
      a microphone: the ear’s nonlinear mechanics, auditory scene analysis, and cultural training shape
      what we group as “a note,” “a beat,” or “a voice in noise.”</p>
      <p><strong>Consonance and dissonance</strong> sit between physics (harmonicity, roughness) and culture
      (learned expectations). Absolute pitch is rare; relative pitch and contour are nearly universal
      skills. Rhythm entrainment — locking movement and attention to a pulse — is a powerful social glue.</p>
      ${figureHtml(DIAGRAMS['overtone-series'], 'phil-figure--inline')}
      <p>Philosophers ask: Is music representational or pure form? Does it express emotions, arouse them,
      or afford them? Susanne Langer spoke of music as the logical expression of feeling’s forms;
      others emphasize embodied cognition — we hear with muscles and breath as much as with ears.</p>
      <p>Memory and expectation (schemata for cadence, groove, drop) create pleasure in confirmation
      and surprise. Silence, timbre, and space matter as much as pitch class. Listening is an ethical
      act too: attention given to another’s time.</p>
    `,
  },
  {
    id: 'theory-basics',
    kicker: 'Toolkit',
    title: 'Core theory concepts (a practical map)',
    html: `
      <p>Use these as ears, not exams — labels that help you notice structure while flying the catalog.</p>
      <dl class="phil-dl">
        <dt>Pitch & interval</dt>
        <dd>Distance between tones; building blocks of melody and harmony.</dd>
        <dt>Scale / mode / raga</dt>
        <dd>Collections and behaviors of pitches; cultural “grammars” of melody.</dd>
        <dt>Rhythm & meter</dt>
        <dd>Pulse, grouping, syncopation, polyrhythm; the body’s clock.</dd>
        <dt>Harmony & progression</dt>
        <dd>Simultaneous tones and their motion through tension and release.</dd>
        <dt>Form</dt>
        <dd>How sections relate over time: verse/chorus, sonata, through-composed, loop-based.</dd>
        <dt>Timbre & texture</dt>
        <dd>Tone color and layering — sparse, dense, call-and-response, wall of sound.</dd>
        <dt>Dynamics & articulation</dt>
        <dd>Loud/soft, attack/decay — the expressive surface of performance.</dd>
      </dl>
      ${figureHtml(DIAGRAMS.modes, 'phil-figure--inline')}
      <p>Genre nebulas in Cosmoly cluster artists by shared practices of these parameters — not rigid
      boxes, but neighborhoods of listening habits.</p>
    `,
  },
  {
    id: 'why-sivyis',
    kicker: 'SIVYIS Corp',
    title: 'Why a galaxy for music?',
    html: `
      <p>Maps shape curiosity. A list sorts by chart position; a galaxy sorts by <strong>affinity and
      atmosphere</strong>. Flying among stars mirrors how we actually discover: proximity, accident,
      return visits, following a glowing cluster into a new taste.</p>
      <p>Philosophy here is not a classroom aside — it is the reason the interface exists: to make
      listening spatial, playful, and reflective. Profiles connect art to livelihood (store, merch,
      tips). The demo Bitcoin wallet sketches a future where support can move as directly as attention.</p>
      <p>Keep exploring: open Philosophy when you want depth; open Galaxy when you want wonder.
      Both are part of the same instrument.</p>
    `,
  },
]

export function philosophyPageHtml(): string {
  const sections = PHILOSOPHY_SECTIONS.map(
    (s) => `
    <section class="phil-section" id="phil-${s.id}">
      <p class="kicker">${s.kicker}</p>
      <h2>${s.title}</h2>
      ${s.html}
    </section>`,
  ).join('')

  const toc = PHILOSOPHY_SECTIONS.map(
    (s) => `<a href="#phil-${s.id}">${s.title.split(':')[0]}</a>`,
  ).join('')

  return `
    <div class="phil-hero">
      <p class="kicker">SIVYIS Corp · Education</p>
      <h1>Music Philosophy &amp; Theory</h1>
      ${PHILOSOPHY_INTRO}
    </div>
    <nav class="phil-toc" aria-label="Philosophy sections">${toc}<a href="#phil-web">Philosophy Web</a></nav>
    ${sections}
    ${philosophyWebSectionHtml()}
    <p class="phil-foot">Educational overview · SIVYIS Corp · Not a substitute for formal study</p>
  `
}
