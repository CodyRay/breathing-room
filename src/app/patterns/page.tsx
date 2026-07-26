import type { Metadata } from "next";
import { PatternLibrary } from "@/components/PatternLibrary";

export const metadata: Metadata = {
  title: "Patterns · Breathing Room",
};

export default function PatternsPage() {
  return <PatternLibrary />;
}
