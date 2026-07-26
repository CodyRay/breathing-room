"use client";

import { useRouter } from "next/navigation";
import { PatternGlyph } from "@/components/PatternGlyph";
import { useSettings } from "@/hooks/useSettings";
import { PATTERNS, PHASE_LABEL } from "@/lib/patterns";

export function PatternLibrary() {
  const { patternId, set } = useSettings();
  const router = useRouter();

  const choose = (id: string) => {
    set("patternId", id);
    router.push("/");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-4 pb-10">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="-ml-2 flex items-center gap-1 self-start rounded-full py-2 pr-4 pl-2 text-slate-300 transition hover:text-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            d="M14.5 5.5L8 12l6.5 6.5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Return
      </button>

      <ul className="mt-4 space-y-1 border-t border-white/8 pt-3">
        {PATTERNS.map((pattern) => {
          const selected = pattern.id === patternId;
          return (
            <li key={pattern.id}>
              <button
                type="button"
                onClick={() => choose(pattern.id)}
                aria-current={selected ? "true" : undefined}
                className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${
                  selected ? "bg-white/8" : "hover:bg-white/5"
                }`}
              >
                <PatternGlyph pattern={pattern} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-slate-100">
                    {pattern.name}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {pattern.phases
                      .map((p) => `${PHASE_LABEL[p.kind]} ${p.seconds}`)
                      .join(" · ")}
                  </span>
                </span>
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 text-teal-300"
                    aria-hidden
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 px-3 text-sm leading-relaxed text-slate-500">
        {PATTERNS.find((p) => p.id === patternId)?.blurb}
      </p>
    </div>
  );
}
