"use client";

import { RotateCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Sample, Slot } from "@/lib/demo-samples";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

/** A sample plus the text of each of its source strings, in source order. */
export type PlaygroundSample = Sample & { texts: string[] };

const reasons: Record<string, string> = {
  "not-a-number": "A number in your data can only be replaced by another plain number, such as 29 or 4.5.",
  "placeholder-syntax": "Curly braces are not allowed in translated text, because they mark placeholders.",
  "unsafe-url": "Script and data URLs are not allowed in links.",
  unwritable: "That text cannot be written to this file safely.",
  changed: "The source no longer contains the text this edit started from.",
};

const slotStyles: Record<Slot["as"], string> = {
  h1: "display text-3xl sm:text-4xl",
  h2: "mt-5 text-lg font-medium tracking-tight",
  p: "mt-3 leading-7 text-muted-foreground",
  button: "mt-5 inline-flex h-10 items-center rounded-none bg-foreground px-5 text-sm font-medium text-background",
  small: "mt-4 block text-sm text-muted-foreground",
  nav: "mb-6 flex gap-5 border-b pb-4 text-sm text-muted-foreground",
  li: "ml-5 mt-1.5 list-disc leading-7 text-muted-foreground",
  url: "mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground",
};

/** Lines of `after` that are not in `before`, so the changed lines can be highlighted. */
function changedLines(before: string, after: string): number[] {
  const known = new Map<string, number>();
  for (const line of before.split("\n")) known.set(line, (known.get(line) ?? 0) + 1);
  const marked: number[] = [];
  after.split("\n").forEach((line, index) => {
    const left = known.get(line) ?? 0;
    if (left > 0) known.set(line, left - 1);
    else marked.push(index);
  });
  return marked;
}

function Editor({ sample }: { sample: PlaygroundSample }) {
  const [code, setCode] = useState(sample.code);
  const [problems, setProblems] = useState<{ index: number; reason: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [dirty, setDirty] = useState(0);
  // Bumping this remounts the editable text, which is the only way to put the originals back.
  const [version, setVersion] = useState(0);
  const values = useRef<string[]>([...sample.texts]);
  const timer = useRef(0);
  const request = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const apply = async () => {
    const mine = ++request.current;
    try {
      const response = await fetch("/demos/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample: sample.key, values: values.current }),
      });
      const result = await response.json();
      if (mine !== request.current) return;
      if (typeof result.code !== "string") throw new Error(result.error);
      setCode(result.code);
      setProblems(result.conflicts ?? []);
      setFailed(false);
    } catch {
      if (mine === request.current) setFailed(true);
    }
  };

  const change = (index: number, text: string) => {
    values.current[index] = text.replace(/ /g, " ");
    setDirty(values.current.filter((value, i) => value !== sample.texts[i]).length);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(apply, 250);
  };

  const reset = () => {
    values.current = [...sample.texts];
    window.clearTimeout(timer.current);
    request.current++;
    setCode(sample.code);
    setProblems([]);
    setFailed(false);
    setDirty(0);
    setVersion((n) => n + 1);
  };

  const marked = changedLines(sample.code, code);
  const lines = code.split(/\r?\n/);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* The page, in a browser window, with the editor's toolbar floating over it. */}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(24_26_18/0.05),0_24px_48px_-24px_rgb(24_26_18/0.25)]">
        <div className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <i className="size-2.5 rounded-none bg-foreground/15" />
            <i className="size-2.5 rounded-none bg-foreground/15" />
            <i className="size-2.5 rounded-none bg-foreground/15" />
          </span>
          <span translate="no" className="flex-1 truncate rounded-md bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
            yoursite.com/edit
          </span>
          <button
            type="button"
            onClick={reset}
            className="pressable inline-flex h-7 items-center gap-1.5 rounded-none px-2.5 text-xs text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RotateCcwIcon className="size-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>

        <div key={version} className="min-h-64 flex-1 px-6 pb-20 pt-8 sm:px-9">
          {sample.slots.map((slot, slotIndex) => {
            const Tag = slot.as === "url" || slot.as === "button" || slot.as === "nav" ? "div" : slot.as;
            return (
              <Tag key={slotIndex} className={slotStyles[slot.as]}>
                {slot.label && <span className="select-none">{slot.label}:</span>}
                {slot.parts.map((part) => {
                  // Each sample string is unique, so its text identifies its place in the source.
                  const index = sample.texts.indexOf(part.text);
                  const problem = problems.some((p) => p.index === index);
                  return (
                    <span
                      key={part.text}
                      role="textbox"
                      aria-label={`Edit “${part.text.trim()}”`}
                      tabIndex={0}
                      contentEditable="plaintext-only"
                      suppressContentEditableWarning
                      spellCheck={false}
                      onInput={(event) => change(index, event.currentTarget.textContent ?? "")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      className={cn(
                        "rounded-sm whitespace-pre-wrap outline-offset-4 outline-mark hover:outline-1 hover:outline-dashed focus:outline-2 focus:outline-solid",
                        part.strong && "font-semibold text-foreground",
                        slot.as === "url" && "rounded-md bg-muted px-2 py-1 text-foreground",
                        problem && "underline decoration-red-600 decoration-wavy underline-offset-4",
                      )}
                    >
                      {part.text.replace(/\n/g, " ")}
                    </span>
                  );
                })}
              </Tag>
            );
          })}
        </div>

        <div className="pointer-events-none -mt-16 flex justify-center pb-5" aria-hidden="true">
          <div className="flex items-center gap-3 rounded-none bg-ink py-1.5 pl-4 pr-1.5 text-xs text-paper shadow-lg">
            <span className="flex items-center gap-2 tabular-nums">
              <i
                className={cn(
                  "size-1.5 rounded-none transition-colors duration-200",
                  dirty ? "bg-mark" : "bg-paper/30",
                )}
              />
              {dirty === 0 ? "No changes" : dirty === 1 ? "1 unsaved change" : `${dirty} unsaved changes`}
            </span>
            <span
              className={cn(
                "rounded-none px-3 py-1 font-medium transition-colors duration-200",
                dirty ? "bg-mark text-white" : "bg-paper/10 text-paper/50",
              )}
            >
              Save
            </span>
          </div>
        </div>

        <div aria-live="polite" className="border-t bg-muted/40 px-5 py-3 text-sm">
          {failed ? (
            <p className="text-red-700">The demo server did not answer. Try again in a moment.</p>
          ) : problems.length ? (
            <p className="text-red-700">Refused: {reasons[problems[0].reason] ?? "That edit cannot be saved."}</p>
          ) : (
            <p className="text-muted-foreground">
              {code !== sample.code ? (
                <>
                  <span className="hidden lg:inline">On the right: the exact change Torso would commit.</span>
                  <span className="lg:hidden">Torso would commit this to {sample.file}:</span>
                </>
              ) : (
                "Tap or click any text on this page and type."
              )}
            </p>
          )}
          {marked.length > 0 && (
            <pre translate="no" className="mt-2 bg-ink p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-white lg:hidden">
              {marked.map((index) => (
                <span key={index} className="block">
                  {lines[index].trim()}
                </span>
              ))}
            </pre>
          )}
        </div>
      </div>

      <CodeBlock file={sample.file} code={code} marked={marked} className="lg:self-stretch" />
    </div>
  );
}

/** Edit a small page on the left; see the exact source Torso would write on the right. */
export function Playground({ samples }: { samples: PlaygroundSample[] }) {
  return (
    <Tabs defaultValue={samples[0].key} className="gap-5">
      <TabsList aria-label="What to edit">
        {samples.map((sample) => (
          <TabsTrigger key={sample.key} value={sample.key}>
            {sample.tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {samples.map((sample) => (
        <TabsContent key={sample.key} value={sample.key}>
          <Editor sample={sample} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
