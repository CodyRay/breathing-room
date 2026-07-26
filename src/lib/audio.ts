import type { PhaseKind } from "./patterns";

export type SoundPackId = "bells" | "midi" | "trek" | "crescendo";

export const SOUND_PACKS: { id: SoundPackId; name: string; blurb: string }[] = [
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
];

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
const CRESCENDO_LEVELS: Record<PhaseKind, [number, number]> = {
  inhale: [0.04, 0.34],
  hold: [0.34, 0.34],
  exhale: [0.34, 0.04],
  "hold-out": [0.04, 0.04],
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
    }
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
