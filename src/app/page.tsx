import { PracticeScreen } from "@/components/PracticeScreen";
import { availableVoicePacks } from "@/lib/voices";

export default function Home() {
  // Resolved at build time; see availableVoicePacks.
  return <PracticeScreen voicePacks={availableVoicePacks()} />;
}
