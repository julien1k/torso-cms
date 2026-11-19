/**
 * The three small "projects" behind the demos page. Each has a source file and a
 * description of how its text appears on a page. The demo edits the page; the server
 * runs Torso's real save step on the source and returns the result.
 */

export type SampleKey = "component" | "messages" | "markdown";

/** One piece of the rendered page: an element, made of one or more source strings. */
export interface Slot {
  as: "h1" | "h2" | "p" | "button" | "small" | "nav" | "li" | "url";
  /** The source strings shown in this element, by their original text. */
  parts: { text: string; strong?: boolean }[];
  /** Explains a field that is not ordinary visible text. */
  label?: string;
}

export interface Sample {
  key: SampleKey;
  tab: string;
  file: string;
  blurb: string;
  code: string;
  slots: Slot[];
}

export const samples: Sample[] = [
  {
    key: "component",
    tab: "Component",
    file: "components/hero.tsx",
    blurb: "Text in JSX, a link address, and a name and a price held in a constant.",
    code: `const plan = { name: "Team", price: 29 };

export function Hero() {
  return (
    <section>
      <h1>Ship your product, not your backlog</h1>
      <p>
        Previews for every pull request, so reviews
        happen on the real thing.
      </p>
      <a href="/signup">Start for free</a>
      <small>
        {plan.name} plan, \${plan.price} per month
      </small>
    </section>
  );
}
`,
    slots: [
      { as: "h1", parts: [{ text: "Ship your product, not your backlog" }] },
      { as: "p", parts: [{ text: "Previews for every pull request, so reviews happen on the real thing." }] },
      { as: "button", parts: [{ text: "Start for free" }] },
      { as: "url", label: "Link address", parts: [{ text: "/signup" }] },
      { as: "small", parts: [{ text: "Team" }, { text: " plan, $" }, { text: "29" }, { text: " per month" }] },
    ],
  },
  {
    key: "messages",
    tab: "Translations",
    file: "messages/en.json",
    blurb: "Strings in a JSON dictionary, as used by next-intl and similar libraries.",
    code: `{
  "nav": {
    "pricing": "Pricing",
    "docs": "Documentation"
  },
  "hero": {
    "title": "Built for teams that ship",
    "cta": "Get started"
  }
}
`,
    slots: [
      { as: "nav", parts: [{ text: "Pricing" }, { text: "Documentation" }] },
      { as: "h1", parts: [{ text: "Built for teams that ship" }] },
      { as: "button", parts: [{ text: "Get started" }] },
    ],
  },
  {
    key: "markdown",
    tab: "Markdown",
    file: "content/release-notes.mdx",
    blurb: "Front matter, a heading, a paragraph with bold text, and a list.",
    code: `---
title: Release notes
---

## Faster previews

Builds now finish in **half the time**,
thanks to smarter caching.

- Works with every framework
- No configuration needed
`,
    slots: [
      { as: "h1", parts: [{ text: "Release notes" }] },
      { as: "h2", parts: [{ text: "Faster previews" }] },
      {
        as: "p",
        parts: [
          { text: "Builds now finish in " },
          { text: "half the time", strong: true },
          { text: ",\nthanks to smarter caching." },
        ],
      },
      { as: "li", parts: [{ text: "Works with every framework" }] },
      { as: "li", parts: [{ text: "No configuration needed" }] },
    ],
  },
];

export const sampleByKey = (key: string) => samples.find((sample) => sample.key === key);
