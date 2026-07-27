import { existsSync } from "node:fs";
import path from "node:path";
import { VOICE_CLIP_NAMES, VOICE_PACKS, type SoundPack } from "./audio";

/**
 * Which voice packs actually have their clips on disk.
 *
 * Server-only, and evaluated during `next build` since every route is
 * prerendered — so this costs nothing at runtime and a pack can never appear
 * in the picker without the files to back it. Adding a voice is just dropping
 * `in.wav`, `hold.wav` and `out.wav` into `public/voice/<name>/` and
 * rebuilding.
 */
export function availableVoicePacks(): SoundPack[] {
  return VOICE_PACKS.filter((voice) =>
    VOICE_CLIP_NAMES.every((clip) =>
      existsSync(path.join(process.cwd(), "public", voice.dir, `${clip}.wav`)),
    ),
  ).map(({ id, name, blurb }) => ({ id, name, blurb }));
}
