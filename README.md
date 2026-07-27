# Breathing Room

A paced-breathing trainer. Pick a pattern, press play, and follow a dot around
a loop while audio marks each phase.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm start       # serve the production build
npm run lint
```

## Deploying

Everything is prerendered — there is no server logic, no API route, no
database, and no environment variable to set. `next build` reports all three
routes as static:

```
┌ ○ /
├ ○ /_not-found
├ ○ /icon.svg
└ ○ /patterns
```

So any host that can run `npm run build && npm start` will serve it, and
Vercel needs no configuration at all. Sound is synthesised in the browser and
preferences live in localStorage, so there is nothing to provision.

If you would rather drop it on a purely static host (GitHub Pages, S3, a
Netlify drag-and-drop), add `output: "export"` to `next.config.ts` and
`next build` will emit a self-contained `out/` directory. That trades away the
ability to add server rendering later, which is why it isn't the default here.

One caveat wherever it lands: **browsers only allow audio after a user
gesture.** The AudioContext is created inside the play button's click handler
for exactly this reason. Autoplaying a session on page load will not work, and
that is a browser rule rather than something to configure around.

## The loop is the pattern

The centrepiece isn't a decorative circle — it's a plot of the pattern. Every
side of the closed loop is one phase of the breath, and each phase owns a share
of the loop proportional to its duration. Square breathing comes out a square;
4-7-8 comes out a lopsided triangle leaning into its long exhale; 6-3 comes out
a wide dome, the 6s inhale arcing over the top and the 3s exhale cutting back
underneath.

`src/lib/geometry.ts` builds it. Vertices go on a circle at angles proportional
to cumulative duration, then consecutive vertices are joined by a circular arc
bulging outward. Each arc's central angle is a fraction of the angle it spans
on that circle: at fraction 1 the arc *is* the circle and the shape is round
with no visible corners; below 1 the tangents break at each vertex and a corner
opens up. The fraction is picked per edge so every vertex bends by about the
same visible amount (`HALF_BEND`) no matter how lopsided the pattern — one knob
controls how polygonal everything reads.

Because the whole silhouette is generated, the list icons on `/patterns` are the
same function at a smaller radius. Add a pattern to `PATTERNS` and it gets a
shape, an icon, and a beat grid with no extra work.

Arcs are also cheap to walk: within one edge the radius is constant, so
advancing the angle linearly moves the marker at a genuinely constant speed —
no arc-length lookup table.

## Audio

Everything is synthesised at runtime through the Web Audio API
(`src/lib/audio.ts`), so a pattern of any shape gets a beat grid that fits it
exactly. No sample files.

- **Bells** — one strike per phase change, with a *different voice per phase*
  rather than one bell at four pitches: a bright high bell on the inhale (A5,
  2.3s tail), a short muted wooden tap on a hold (E5, 0.5s), a low warm gong on
  the exhale (D4, 3.7s), and that same tap a fourth down for the hold after an
  exhale (A4). They differ in register, partial structure and ring-out length at
  once, so the two holds in square breathing don't blur together.
- **MIDI** — an accent on each phase, then a beat for every second inside it.
  The run is one musical gesture: the inhale climbs a minor pentatonic from its
  root, the exhale falls back onto its root, a hold sits still. You can follow
  the breath by ear with the screen off.
- **Trek** — one note of a rising fanfare per phase, held for the phase's full
  length and ringing past each boundary so consecutive notes overlap. An
  additive stack of exact harmonics, played into a synthesised room; patterns
  with fewer phases use fewer notes. Three things stop it reading as a synth
  patch: the upper harmonics overshoot on the attack and settle back (brass is
  brightest as it starts), a short band-passed noise burst gives the entry the
  scrape of air starting to move, and a convolution reverb puts it in a space
  instead of a vacuum. All three are one-off or static — none of them puts
  anything into periodic motion.
- **Crescendo** — a sustained chord whose level tracks the breath: swelling on
  the inhale, flat through a hold, subsiding on the exhale. The levels are
  deliberately continuous across boundaries, so loudness gives nothing away and
  the phase change is marked only by the chord moving — one fixed root with the
  top voice walking C5 → B4 → A4 → G4 down the cycle.
- **Ocean** — the same contour rendered as surf: pink-ish noise through a
  low-pass where loudness and brightness swell and subside together, so the
  breath is legible on two axes at once. Being noise, it has no partials, which
  makes it the one pack that cannot be made to sound synthetic by mistuning.
- **Glide** — carries the breath in *pitch* rather than loudness, climbing a
  fifth on the inhale and falling back on the exhale, which leaves loudness
  free to stay constant. The ramp is exponential because pitch is heard
  logarithmically. Harmonics are integer multiples so the whole tone glides as
  one, and phase endpoints meet exactly, making a cycle one unbroken line.
- **Voice (female / male)** — a spoken cue at each change of phase.

### The voice clips

These are the only recorded audio in the project, and the only thing that
isn't synthesised at runtime. They live in `public/voice/<name>/` as
`in.wav`, `hold.wav` and `out.wav` — three files per voice, since both holds
share a cue.

They were generated locally with [Piper](https://github.com/OHF-Voice/piper1-gpl)
(`en_US-amy-medium` for the female voice, `en_US-joe-medium` for the male),
then trimmed to the speech, faded 6ms at each edge and peak-normalised to
-2.9 dBFS. Piper's `en_US-ryan-medium` was tried first and rejected: it
compresses single words to around 0.15s regardless of the length scale, which
is far too clipped to breathe to.

WAV, not MP3, on purpose — every MP3 encoder prepends a short silent pad, and
these are timing cues. At six clips totalling ~180KB the compression would
have saved nothing worth a few tens of milliseconds of lag.

A voice pack is only offered in the picker when its three clips are actually
present. That check (`src/lib/voices.ts`) runs during `next build`, so it
costs nothing at runtime and a pack can never appear without files behind it.
Adding a third voice is dropping a folder in and rebuilding.

### Why the sustained voices are tuned the way they are

Both of these hold tones for seconds at a time, which is where any interference
between partials stops being a texture and starts being an audible wobble
sitting behind the note. Two rules fell out of fixing exactly that:

- **No detuning, no filter sweeps.** Trek originally used the standard synth
  trick of two sawtooths detuned ±7 cents. At F3 that is a 1.4 Hz beat on the
  fundamental and *n* × 1.4 Hz on each harmonic — the tenth warbling at 14 Hz.
  Exact integer harmonics give a perfectly periodic waveform, which cannot beat
  with itself.
- **Sines in chords, and mind the tuning system.** Crescendo used triangles,
  whose odd harmonics collide between chord tones (220 Hz's 7th sits 30 Hz from
  C5's 3rd — squarely in the roughness range). Trek's notes overlap, and an
  equal-tempered fourth is 2 cents narrow, enough to beat at 0.8 Hz between one
  note's 4th harmonic and the next note's 3rd; stacking the fanfare as *just*
  fourths puts those partials on the same frequency so they lock instead.

`scratchpad/beats.mjs`-style instrumentation is the way to check this: record
every oscillator's frequency and lifetime, then assert no two partials sounding
at the same moment are within ~20 Hz of each other unless they are identical.

Beats are queued ahead of time against `AudioContext.currentTime` by a
lookahead scheduler (`useBreathSession`), so timing holds steady even when the
main thread stalls. The animation reads that same clock, which means the marker
cannot drift away from the sound.

## Layout

```
src/
  app/            routes: / (practice) and /patterns (library)
  components/     BreathLoop (the SVG), SessionPanel, PracticeScreen, …
  hooks/          useBreathSession (clock + scheduler), useWakeLock, useSettings
  lib/            geometry, patterns, audio, settings store
```

Patterns are fixed presets in `src/lib/patterns.ts`. Preferences live in
localStorage behind a `useSyncExternalStore` store, so the server render uses
defaults and the client swaps in saved values without a hydration mismatch.

`SessionPanel` is mounted keyed by pattern id — switching patterns starts a
clean session by remount rather than by unwinding a half-finished cycle.

Space bar starts and stops. A session runs until you stop it.

Stop means stop, not pause: it rewinds to the top of the cycle. That is what
keeps the clock honest — while running, elapsed time is read straight off the
audio clock; while stopped, it is zero. There is no banked position, so nothing
ever has to be resumed mid-phase.
