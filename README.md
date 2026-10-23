# Galaxy Artists

A 3D outer-space galaxy you explore like **Google Earth on a phone**. Space is divided into colorful **genre nebulas** — Hip-Hop, Pop, Rock, R&B/Soul, Electronic, Jazz, Latin, Country, Indie/Alt, and Metal. Each glowing star inside a cluster is a **real, well-known music artist**. Approach a star to hear a short royalty-safe demo cue; tap a star to open their profile and track list.

Inspired by patterns from Music Galaxy–style explorers (orbit overview → fly, search look-at/fly-to, connection filaments, spatial audio) — this app is **not** Spotifytrack and does not use their assets.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default **http://localhost:5173**). For phone testing, use a tunnel (Cloudflare, etc.) — `allowedHosts: true` is enabled.

Production build:

```bash
npm run build
npm run preview
```

## Modes: Overview ↔ Fly

| Mode | Feel |
| --- | --- |
| **Overview** (default) | Gentle auto-orbit of the whole galaxy. Genre landmark labels stay visible. Drag still steers the orbit. |
| **Fly** | Free exploration with phone Earth-style gestures + desktop WASD / mouse look. |

**HUD:** tap **Enter Fly** / **Overview** (bottom-right on phone; under Nearby on desktop). Desktop shortcut: **O** toggles modes. Returning to Overview uses a smooth ~2.8s Bézier home flight.

Search is the onboarding bridge into Fly: pick an artist → **Look At** or **Fly To**.

## Search → Look At / Fly To

Top-center search filters the current catalog (~72 artists).

| Action | Behavior |
| --- | --- |
| **Look At** | Eases the camera to face the artist (~1.15s). Enters Fly if you were in Overview. |
| **Fly To** | Cubic Bézier path (~1.5–3.5s by distance), then opens the artist profile. |
| **Enter** in the search field | Same as Fly To on the selected hit. |

## Controls

### Phone (Google Earth–style) — Fly mode

| Gesture | Action |
| --- | --- |
| **One-finger drag** | Orbit / look (yaw + pitch, inverted as shipped) with inertia |
| **Pinch** | Zoom — dolly toward / away (clamped) |
| **Two-finger drag** | **Lateral pan** in the view plane |
| **Single tap** star | Open artist profile (bottom sheet) |
| **Double-tap** star | Smooth zoom toward that star |
| **Double-tap** empty space | Zoom toward nearest star |
| Swipe down on sheet handle | Dismiss profile |

### Desktop — Fly mode

| Input | Action |
| --- | --- |
| Click **Enter the galaxy** | Start audio (Overview begins) |
| **Enter Fly** then click canvas | Capture mouse look |
| **WASD** | Fly forward / left / back / right |
| **Q** / **E** (or Ctrl / Space) | Down / up |
| **Shift** | Boost (also widens spatial audio rolloff) |
| **Mouse** | Look (pointer lock) |
| **Scroll** (while locked) | Adjust cruise speed |
| **Scroll** (unlocked) | Dolly zoom |
| **Click a star** | Open profile |
| **Esc** | Release mouse / close panel |
| **M** | Mute demo audio |
| **O** | Toggle Overview ↔ Fly |

## Visual / audio upgrades

- **Connection filaments** — ultra-transparent additive `LineSegments` between nearby same-genre artists (k-NN, long edges culled, ~3–5 links per star). Bloom makes them read as galaxy structure.
- **Spatial audio** — each demo voice uses a `PannerNode`; listener follows the camera. Soft crossfades; Shift boost lowers rolloff.
- **Sticky now-playing** — nearest/playing artist label clamps to the screen edge when off-FOV; playing star pulses slightly with amplitude.
- **Quality tier** — if FPS dips on phone, filament density / bloom / pixel ratio step down automatically.

## Demo audio

All sound is generated in the browser with the **Web Audio API** (procedural pads, arpeggios, and one-shot flourishes). Volume **crossfades by distance** and prefers the **nearest artist star**. When you fly deep into a nebula, the ambient bed tints slightly toward that genre’s timbre.

These are labeled **demo cues**, not commercial recordings. There is **no copyrighted streaming**. Song/album titles in profiles are factual references only — clicking a track plays a short generated flourish for that artist.

## Project

- Vite + TypeScript + vanilla Three.js
- Phone-first UX: safe-area insets, ≥44px targets, bottom-sheet profiles
- **10 genre nebulas** with ~72 real artists (~7–8 per genre)
- Per-genre particle clouds, glow planes, floating genre labels, and neighbor filaments
- Bloom, fog, and a background starfield
- `vite` `allowedHosts: true` for tunnel-friendly phone testing

## Visuals / nebulae

Genre regions use NASA/ESA public-domain nebula photography (`public/nebulae/`, see `CREDITS.txt`).
Renderer pixel ratio scales with quality tier (HD up to `devicePixelRatio` capped at 3); bloom runs at full canvas resolution.
