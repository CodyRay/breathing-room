import type { PhaseKind } from "./patterns";

export type SoundPackId =
  | "bells"
  | "midi"
  | "trek"
  | "crescendo"
  | "ocean"
  | "voice-female"
  | "voice-male";

export interface SoundPack {
  id: SoundPackId;
  name: string;
  blurb: string;
}

/** Packs synthesised on the fly. Always available, nothing to load. */
export const SOUND_PACKS: SoundPack[] = [
  {
    id: "bells",
    name: "Bells",
    blurb: "One struck bell at each change of phase.",
  },
  {
    id: "midi",
    name: "MIDI",
    blurb: "An accent on each phase, then a beat for every second in it.",
  },
  {
    id: "trek",
    name: "Trek",
    blurb: "A rising fanfare, one note held wide across each phase.",
  },
  {
    id: "crescendo",
    name: "Crescendo",
    blurb: "A drone that swells as you breathe in and fades as you breathe out.",
  },
  {
    id: "ocean",
    name: "Ocean",
    blurb: "Surf that rolls in as you breathe in and draws back as you go out.",
  },
];

/**
 * Packs that play recorded clips rather than synthesising them. Unlike the
 * rest of the app these need files on disk, so they are only offered when
 * their clips are actually present — see `availableVoicePacks` in
 * `src/lib/voices.ts`.
 *
 * The clips are WAV rather than MP3 on purpose. These are timing cues, and
 * every MP3 encoder prepends a short silent pad that would drag each cue a few
 * tens of milliseconds late. At well under a second apiece the compression
 * would have saved nothing worth that.
 */
export const VOICE_PACKS: (SoundPack & { dir: string })[] = [
  {
    id: "voice-female",
    name: "Voice (female)",
    blurb: "A spoken cue at each change of phase.",
    dir: "voice/female",
  },
  {
    id: "voice-male",
    name: "Voice (male)",
    blurb: "A spoken cue at each change of phase.",
    dir: "voice/male",
  },
];

/** Clip each phase asks for. Both holds share one, so three files per voice. */
const VOICE_CLIP: Record<PhaseKind, string> = {
  inhale: "in",
  hold: "hold",
  exhale: "out",
  "hold-out": "hold",
};

export const VOICE_CLIP_NAMES = ["in", "hold", "out"] as const;

export function isVoicePack(pack: SoundPackId): boolean {
  return VOICE_PACKS.some((v) => v.id === pack);
}

/** Root note per phase for the MIDI pack, in Hz. Inhale rises, exhale settles. */
const PHASE_PITCH: Record<PhaseKind, number> = {
  inhale: 587.33, // D5
  hold: 493.88, // B4
  exhale: 392.0, // G4
  "hold-out": 440.0, // A4
};

/** Minor-pentatonic steps in semitones, walked by the per-second beats. */
const PENTATONIC = [0, 3, 5, 7, 10, 12];

/**
 * Pitch for one beat of the MIDI pack, accents included, so each phase is a
 * single musical gesture rather than an accent with a detached run under it:
 * inhale climbs the scale from its root, exhale falls back down onto its root,
 * and a hold sits still. You can follow the breath by ear alone.
 */
function midiPitch(event: BeatEvent): number {
  const root = PHASE_PITCH[event.kind];
  if (event.kind === "hold" || event.kind === "hold-out") return root;
  const step =
    event.kind === "inhale" ? event.beat : event.beatsInPhase - event.beat;
  const index = Math.min(Math.max(step, 0), PENTATONIC.length - 1);
  return root * Math.pow(2, PENTATONIC[index] / 12);
}

interface BellVoice {
  freq: number;
  /** Peak output level for the whole strike. */
  gain: number;
  /** Seconds for the strike to ring out. */
  decay: number;
  /**
   * `[frequency ratio, level, decay as a fraction of the voice's]`. Upper
   * partials dying faster than the fundamental is what makes a strike sound
   * struck rather than beeped.
   */
  partials: [number, number, number][];
}

/**
 * A separate voice per phase, so the four sound like four different objects
 * being hit rather than one bell at four pitches. Pitch alone was too subtle —
 * the two holds in square breathing sat a whole tone apart and blurred
 * together. Now they differ in register, timbre and ring-out length at once,
 * which is what you can actually pick out with your eyes closed.
 *
 * The set spans two octaves and descends A5 → E5 → D4 across the breath, so a
 * cycle reads as one falling gesture.
 */
const BELL_VOICES: Record<PhaseKind, BellVoice> = {
  // Bright struck bell, high and open. 2.76 is the classic strike-tone ratio.
  inhale: {
    freq: 880,
    gain: 0.42,
    decay: 2.2,
    partials: [
      [1, 1, 1],
      [2.76, 0.5, 0.5],
      [5.4, 0.22, 0.22],
      [8.93, 0.1, 0.12],
    ],
  },
  // Short muted tap — nothing is changing, so nothing rings on. Bar-like
  // partials (3.9, 9.5) read as wood rather than metal.
  hold: {
    freq: 659.25,
    gain: 0.4,
    decay: 0.42,
    partials: [
      [1, 1, 1],
      [3.9, 0.34, 0.4],
      [9.5, 0.1, 0.16],
    ],
  },
  // Low warm gong, the longest ring in the set: the phase you sink into.
  exhale: {
    freq: 293.66,
    gain: 0.5,
    decay: 3.6,
    partials: [
      [1, 1, 1],
      [2, 0.4, 0.7],
      [2.76, 0.3, 0.45],
      [4.07, 0.14, 0.25],
    ],
  },
  // The same tap a fourth down, so the hold after an exhale is never mistaken
  // for the hold after an inhale.
  "hold-out": {
    freq: 440,
    gain: 0.38,
    decay: 0.42,
    partials: [
      [1, 1, 1],
      [3.9, 0.3, 0.4],
      [9.5, 0.08, 0.16],
    ],
  },
};

/**
 * The Trek fanfare's opening call, one note per phase — patterns with fewer
 * phases simply use fewer notes. Built on the ascending perfect fourths that
 * give the original its shape, from a root of F3.
 *
 * Stacked as *just* fourths (4/3), not equal-tempered ones. Notes overlap here
 * — each rings on into the next — and a tempered fourth is about two cents
 * narrow, which is inaudible as pitch but lands as a 0.8 Hz beat between one
 * note's fourth harmonic and the next note's third. Tuning the stack justly
 * makes those partials land on exactly the same frequency instead, so the
 * overlap locks together rather than throbbing.
 */
const TREK_NOTES = [0, 1, 2, 3].map((i) => 174.61 * Math.pow(4 / 3, i));

/**
 * `[harmonic number, level]` for the Trek voice.
 *
 * These are *exact* integer multiples, which matters more than it looks. The
 * first version of this voice used two sawtooths detuned ±7 cents — the usual
 * synth trick for width. At F3 that puts the pair 1.4 Hz apart, so the
 * fundamental beats once a second and every harmonic beats faster still (the
 * tenth at 14 Hz): a distinct wobble sitting behind the note, and the thing
 * that made it sound synthetic. Exact integer ratios give a perfectly periodic
 * waveform, which cannot beat with itself at all.
 *
 * Keep them integers. Any detuning here comes straight back as modulation.
 *
 * The 7th is deliberately absent. Notes overlap, and where the last note of
 * the fanfare rings into the first of the next cycle the interval is 64/27 —
 * the one place the just-fourth stack gives no exact coincidence. Every other
 * partial pair there lands at least 45 Hz apart, but the 7th would sit 19 Hz
 * from the root's 3rd, close enough to flutter. Dropping it costs nothing:
 * the 7th partial is the one that sounds out of tune anyway.
 */
const TREK_HARMONICS: [number, number][] = [
  [1, 1],
  [2, 0.5],
  [3, 0.32],
  [4, 0.2],
  [5, 0.12],
  [6, 0.075],
  [8, 0.04],
  [9, 0.028],
  [10, 0.018],
];

/**
 * Crescendo holds one root and moves only its top voice, so each phase change
 * registers as a chord shift rather than an event: C5 → B4 → A4 → G4 walks
 * down across the cycle while the breath swells and fades underneath.
 */
const CRESCENDO_CHORDS: Record<PhaseKind, number[]> = {
  inhale: [110, 220, 329.63, 523.25], // Am
  hold: [110, 220, 329.63, 493.88], // Asus2 — open, unresolved, waiting
  exhale: [110, 220, 329.63, 440], // bare octave and fifth — settled
  "hold-out": [110, 220, 329.63, 392], // Am7 — soft, empty-lunged
};

/** Relative weight of each chord tone, root loudest. */
const CHORD_WEIGHTS = [0.5, 0.32, 0.24, 0.2];

/**
 * Level at the start and end of each phase. The pairs meet at the boundaries
 * (inhale ends where hold begins, and so on), so loudness is continuous around
 * the cycle and only the chord marks the change.
 */
/**
 * The swell is deliberately gentle. An earlier version ran 0.04 to 0.34 — an
 * 8:1 range, near 19dB — which made the quiet end almost absent and the whole
 * thing feel like it was lunging at you rather than breathing. This is a hair
 * over 2:1, about 7dB: unmistakable as a direction, never startling. The top
 * is unchanged; it is the floor that came up.
 */
const CRESCENDO_LEVELS: Record<PhaseKind, [number, number]> = {
  inhale: [0.15, 0.34],
  hold: [0.34, 0.34],
  exhale: [0.34, 0.15],
  "hold-out": [0.15, 0.15],
};

/**
 * Ocean is filtered noise rather than tones, which is the point: noise has no
 * partials, so there is nothing to beat or clash with anything else. It is the
 * one pack that cannot be made to sound synthetic by mistuning.
 *
 * Loudness and brightness move together — a wave coming in gets louder *and*
 * brighter as it breaks, and darkens as it draws back — so the breath is
 * legible on two axes at once. Both pairs meet at the phase boundaries, the
 * same as Crescendo.
 */
const OCEAN_LEVELS: Record<PhaseKind, [number, number]> = {
  inhale: [0.24, 0.44],
  hold: [0.44, 0.44],
  exhale: [0.44, 0.24],
  "hold-out": [0.24, 0.24],
};

/**
 * Low-pass cutoff in Hz, tracking the same contour as the level.
 *
 * Kept to a narrower range than it started with (340–2400) for the same reason
 * the levels were tempered: brightness reads as loudness, so a wide filter
 * sweep on top of a wide level sweep compounds into something that surges. The
 * bottom no longer goes muffled, so the surf never disappears between breaths.
 */
const OCEAN_CUTOFF: Record<PhaseKind, [number, number]> = {
  inhale: [1150, 2300],
  hold: [2300, 2300],
  exhale: [2300, 1150],
  "hold-out": [1150, 1150],
};


export interface BeatEvent {
  /** Seconds from the start of the cycle. */
  at: number;
  kind: PhaseKind;
  /** Which phase of the pattern this is — picks the Trek note. */
  phaseIndex: number;
  /** How long the phase lasts, for packs that sustain across it. */
  seconds: number;
  /** 0 for the phase accent, 1..n for the seconds counted out inside it. */
  beat: number;
  /** Total beats in this phase, so the pack can shape a run of them. */
  beatsInPhase: number;
}

/**
 * Small Web Audio wrapper. Everything is synthesised on the fly — no samples to
 * load, so a pattern of any shape gets a beat grid that fits it exactly.
 *
 * Nothing is constructed until `resume()` is called from a user gesture, which
 * is what browser autoplay policy requires.
 */
export class BreathAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Sits under the volume control purely so stopping can duck before cutting. */
  private fade: GainNode | null = null;
  /** Anything connected here comes back as room. */
  private reverbSend: GainNode | null = null;
  private live = new Set<AudioScheduledSourceNode>();
  private volume = 0.7;
  /** Looping noise for Ocean, built once. */
  private noise: AudioBuffer | null = null;
  /** Decoded voice clips, keyed `<pack>/<clip>`. */
  private clips = new Map<string, AudioBuffer>();

  async resume(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.fade = this.ctx.createGain();
      this.fade.connect(this.master);
      this.master.connect(this.ctx.destination);

      const reverb = this.ctx.createConvolver();
      reverb.buffer = this.buildImpulse(2.2, 2.6);
      reverb.connect(this.fade);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.connect(reverb);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();

    // stopAll leaves the bus ducked so the reverb tail dies with it. Lift it
    // again before anything new is scheduled.
    const now = this.ctx.currentTime;
    this.fade!.gain.cancelScheduledValues(now);
    this.fade!.gain.setValueAtTime(1, now);
    return this.ctx;
  }

  /**
   * A synthesised impulse response: decaying noise, smoothed to darken it.
   * Cheaper than shipping a recorded one, and a dark tail is what reads as a
   * warm room rather than a hiss.
   */
  private buildImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let smoothed = 0;
      for (let i = 0; i < length; i++) {
        smoothed = smoothed * 0.68 + (Math.random() * 2 - 1) * 0.32;
        data[i] = smoothed * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  /**
   * Fetch and decode a voice pack's clips. Safe to call repeatedly — already
   * decoded clips are kept. A clip that fails to load simply doesn't speak;
   * the session still runs, which is better than refusing to start because a
   * file is missing.
   */
  async prime(pack: SoundPackId): Promise<void> {
    const voice = VOICE_PACKS.find((v) => v.id === pack);
    if (!voice || !this.ctx) return;
    await Promise.all(
      VOICE_CLIP_NAMES.map(async (name) => {
        const key = `${voice.id}/${name}`;
        if (this.clips.has(key)) return;
        try {
          const response = await fetch(`/${voice.dir}/${name}.wav`);
          if (!response.ok) return;
          const decoded = await this.ctx!.decodeAudioData(
            await response.arrayBuffer(),
          );
          this.clips.set(key, decoded);
        } catch {
          // missing or undecodable — that phase stays silent
        }
      }),
    );
  }

  /**
   * Pink-ish noise: white noise leaned on by a one-pole filter, which tilts
   * the spectrum downward and is what separates surf from hiss.
   */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      smoothed = smoothed * 0.75 + (Math.random() * 2 - 1) * 0.25;
      data[i] = smoothed * 3.2;
    }
    // Match the ends so the loop point doesn't click.
    const blend = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < blend; i++) {
      const t = i / blend;
      data[i] = data[i] * t + data[length - blend + i] * (1 - t);
    }
    this.noise = buffer;
    return buffer;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
    }
  }

  /**
   * Cut anything already scheduled — used when pausing or switching pattern.
   * Sustained packs are mid-note when this happens, so duck first: stopping an
   * oscillator at full amplitude is an audible click.
   */
  stopAll() {
    if (!this.ctx || !this.fade) return;
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(0, now + 0.04);

    for (const node of this.live) {
      try {
        node.stop(now + 0.05);
      } catch {
        // already stopped
      }
    }
    this.live.clear();
    // Left ducked deliberately: a convolution tail outlives the sources that
    // fed it, and stopping the sources alone would leave the room ringing.
    // resume() lifts the bus again.
  }

  play(pack: SoundPackId, event: BeatEvent, when: number) {
    if (!this.ctx || !this.fade) return;
    switch (pack) {
      case "bells":
        if (event.beat === 0) this.bell(when, BELL_VOICES[event.kind]);
        return;
      case "midi": {
        const freq = midiPitch(event);
        if (event.beat === 0) this.accent(when, freq);
        else this.tick(when, freq);
        return;
      }
      case "trek":
        if (event.beat === 0) this.trek(when, event);
        return;
      case "crescendo":
        if (event.beat === 0) this.crescendo(when, event);
        return;
      case "ocean":
        if (event.beat === 0) this.ocean(when, event);
        return;
      case "voice-female":
      case "voice-male":
        if (event.beat === 0) this.speak(when, pack, event.kind);
        return;
    }
  }

  /**
   * Surf: noise through a low-pass, where loudness and brightness swell and
   * subside together across the phase. Because it is noise there are no
   * partials to interfere with anything, which is why this pack cannot be
   * made to sound synthetic by mistuning.
   */
  private ocean(when: number, event: BeatEvent) {
    const ctx = this.ctx!;
    const held = event.seconds;
    const [fromLevel, toLevel] = OCEAN_LEVELS[event.kind];
    const [fromCut, toCut] = OCEAN_CUTOFF[event.kind];

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer();
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(fromCut, when);
    filter.frequency.exponentialRampToValueAtTime(toCut, when + held);

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(fromLevel, when + 0.04);
    out.gain.linearRampToValueAtTime(toLevel, when + held);
    out.gain.linearRampToValueAtTime(0.0001, when + held + 0.04);

    source.connect(filter).connect(out).connect(this.fade!);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    out.connect(wet).connect(this.reverbSend!);
    this.start(source, when, when + held + 0.1);
  }

  /** A recorded cue. Silent if the clip never loaded. */
  private speak(when: number, pack: SoundPackId, kind: PhaseKind) {
    const buffer = this.clips.get(`${pack}/${VOICE_CLIP[kind]}`);
    if (!buffer) return;
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    source.connect(g).connect(this.fade!);
    const wet = ctx.createGain();
    wet.gain.value = 0.12;
    g.connect(wet).connect(this.reverbSend!);
    this.start(source, when, when + buffer.duration + 0.05);
  }

  /**
   * One fanfare note, held wide for the whole phase: an additive stack of
   * exact harmonics with a tail that rings past the phase boundary so
   * consecutive notes overlap. No detuning and no filter sweep — both put
   * something audibly in motion behind the note, and a sustained tone is
   * exactly where that gets noticed.
   */
  private trek(when: number, event: BeatEvent) {
    const ctx = this.ctx!;
    const held = event.seconds;
    const freq = TREK_NOTES[Math.min(event.phaseIndex, TREK_NOTES.length - 1)];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(0.19, when + 0.16);
    out.gain.linearRampToValueAtTime(0.14, when + Math.min(held, 0.7));
    out.gain.setValueAtTime(0.14, when + held);
    out.gain.exponentialRampToValueAtTime(0.0001, when + held + 0.55);
    out.connect(this.fade!);

    // Most of the warmth is the room, not the note.
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    out.connect(wet).connect(this.reverbSend!);

    for (const [harmonic, level] of TREK_HARMONICS) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * harmonic;

      // Upper harmonics speak a fraction late, overshoot, then settle back —
      // brass is brightest as it starts and mellows as it holds. A static
      // stack is the thing that sounds synthetic. This is a one-off
      // evolution, not an oscillation, so nothing beats.
      const bloom = level * (1 + Math.min(harmonic - 1, 6) * 0.34);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(bloom, when + 0.03 + harmonic * 0.008);
      g.gain.exponentialRampToValueAtTime(level, when + 0.45 + harmonic * 0.06);
      osc.connect(g).connect(out);
      this.start(osc, when, when + held + 0.6);
    }

    this.breath(when, freq, out);
  }

  /**
   * The noise of air starting to move, before the note settles. Brass has a
   * scrape on the front of every entry; without one an additive stack reads as
   * a tone generator rather than something being played.
   */
  private breath(when: number, freq: number, out: AudioNode) {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = freq * 5;
    band.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.06, when + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);

    source.connect(band).connect(g).connect(out);
    this.start(source, when, when + 0.12);
  }

  /**
   * A sustained chord for the whole phase whose level tracks the breath —
   * swelling on the inhale, flat through a hold, subsiding on the exhale. The
   * levels are continuous across boundaries, so the only thing marking a change
   * of phase is the chord moving under you.
   */
  private crescendo(when: number, event: BeatEvent) {
    const ctx = this.ctx!;
    const held = event.seconds;
    const [from, to] = CRESCENDO_LEVELS[event.kind];

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(from, when + 0.04);
    out.gain.linearRampToValueAtTime(to, when + held);
    // Overlaps the next chord's fade-in, so the change has no gap in it. Kept
    // short: the two chords share tones, and a long overlap of the same note
    // started at different times is audible as a dip.
    out.gain.linearRampToValueAtTime(0.0001, when + held + 0.04);
    out.connect(this.fade!);

    const chord = CRESCENDO_CHORDS[event.kind];
    chord.forEach((freq, i) => {
      const weight = CHORD_WEIGHTS[i] ?? 0.2;
      // Sines only. Triangles carry odd harmonics that collide between chord
      // tones — 220 Hz's 7th lands 30 Hz from C5's 3rd — and that roughness is
      // heard as something buzzing behind the drone. A sine has no harmonics
      // to collide, and the chord tones are far enough apart not to beat.
      // The added partial is an exact octave, a 2:1 ratio that cannot beat.
      for (const [ratio, share] of [
        [1, 1],
        [2, 0.16],
      ] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * ratio;
        g.gain.value = weight * share;
        osc.connect(g).connect(out);
        this.start(osc, when, when + held + 0.1);
      }
    });
  }

  /** Struck voice: a stack of sine partials under one shared strike envelope. */
  private bell(when: number, voice: BellVoice) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(voice.gain, when + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, when + voice.decay);
    out.connect(this.fade!);

    for (const [ratio, gain, decayFraction] of voice.partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = voice.freq * ratio;
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        when + voice.decay * decayFraction,
      );
      osc.connect(g).connect(out);
      this.start(osc, when, when + voice.decay + 0.1);
    }
  }

  /** Phase accent: a short plucked blip that lands on the phase boundary. */
  private accent(when: number, freq: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.42, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    osc.connect(g).connect(this.fade!);
    this.start(osc, when, when + 0.34);
  }

  /** Per-second beat: a light blip under the accent that opened the phase. */
  private tick(when: number, freq: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.13, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
    osc.connect(g).connect(this.fade!);
    this.start(osc, when, when + 0.15);
  }

  private start(node: AudioScheduledSourceNode, when: number, stopAt: number) {
    node.start(when);
    node.stop(stopAt);
    this.live.add(node);
    node.onended = () => this.live.delete(node);
  }
}
