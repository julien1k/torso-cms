import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { preparedSamples } from "@/lib/demo-prepared";
import { pages, statusPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CopyPrompt } from "./copy-prompt";
import { PixelCanvas } from "./pixel-canvas";
import { PixelGlyph, type GlyphName } from "./pixel-glyph";
import { Playground } from "./playground";
import { Px, Wordmark } from "./wordmark";

const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** The small label above a headline: a pixel, then a word in capitals. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
      <span aria-hidden="true" className="size-2 bg-mark" />
      {children}
    </p>
  );
}

function Heading({ eyebrow, title, lead, className }: { eyebrow: string; title: ReactNode; lead?: string; className?: string }) {
  return (
    <div data-reveal className={cn("max-w-3xl", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display mt-5 text-balance text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
      {lead && <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">{lead}</p>}
    </div>
  );
}

export function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="tap group inline-flex items-center gap-1.5 rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="underline decoration-foreground/25 underline-offset-4 transition-colors duration-150 group-hover:decoration-mark">
        {children}
      </span>
      <ArrowRightIcon
        aria-hidden="true"
        className="size-4 text-mark transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function TryIt() {
  return (
    <section className="dotted border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Heading
          eyebrow="Try it"
          title={
            <>
              Click the page. Read the <Px>commit.</Px>
            </>
          }
          lead="This is the real thing, not a recording. Change the text on the left and Torso’s save step runs on our server, showing the source it would write."
        />
        <div data-reveal className="mt-12">
          <Playground samples={preparedSamples()} />
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    title: "Wrap your config",
    body: "One function around your Next.js config finds the static text and links in your components at build time. Your source files are not changed.",
  },
  {
    title: "Click and type",
    body: "Open the edit URL, sign in, and click a heading, a button or a paragraph. You write directly on the page, in its own fonts and layout.",
  },
  {
    title: "Save is a commit",
    body: "On your machine, Save rewrites the component file. In production it commits to your GitHub branch and your host redeploys as usual.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <Heading
        eyebrow="How it works"
        title={
          <>
            A headless CMS still needs a body. Torso uses <Px>yours.</Px>
          </>
        }
        lead="No content backend, no schema, no sync. The words live in your components, and Torso edits them there."
      />
      <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
        {steps.map((item, index) => (
          <li key={item.title} data-reveal style={order(index)} className="bg-card p-7 sm:p-8">
            <span className="px block text-6xl leading-none text-mark tabular-nums">{index + 1}</span>
            <h3 className="mt-8 text-xl font-medium tracking-tight">{item.title}</h3>
            <p className="mt-2 text-pretty leading-7 text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ol>
      <p data-reveal className="mt-8">
        <More href="/how-it-works">Read how it works, step by step</More>
      </p>
    </section>
  );
}

/** A tiny piece of interface, drawn in mono type, that illustrates a card. */
function Mock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      translate="no"
      className={cn("mt-6 rounded-xl border bg-background p-4 font-mono text-xs leading-6", className)}
    >
      {children}
    </div>
  );
}

const commits = [
  { message: "Edit content in components/hero.tsx", when: "2m" },
  { message: "Edit content in messages/en.json", when: "1h" },
  { message: "Edit content in 2 files", when: "3d" },
];

const featured = [
  {
    glyph: "branch",
    title: "Every edit is versioned",
    body: "Changes land in git as ordinary commits. History, blame, review and revert come with the repository you already have.",
    visual: (
      <Mock>
        {commits.map((commit) => (
          <p key={commit.message} className="flex items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-none bg-mark" />
            <span className="truncate">{commit.message}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{commit.when}</span>
          </p>
        ))}
      </Mock>
    ),
  },
  {
    glyph: "agent",
    title: "Nothing for agents to learn",
    body: "Your copy is plain code, so a coding agent reads and changes it like anything else. It never has to see the CMS, or know there is one.",
    visual: (
      <Mock>
        <p className="text-muted-foreground">&gt; Rename the Team plan to Growth</p>
        <p>
          <span className="text-mark">●</span> Edited lib/pricing.ts
        </p>
        <p className="text-muted-foreground">No API, no schema, no plugin involved.</p>
      </Mock>
    ),
  },
] satisfies { glyph: GlyphName; title: string; body: string; visual: ReactNode }[];

const compact = [
  {
    glyph: "empty",
    title: "No schema",
    body: "Nothing to model and nothing to migrate. If it is written in your JSX, it is editable.",
  },
  {
    glyph: "code",
    title: "Components stay untouched",
    body: "No hooks, no wrapper components and no content files. Remove the package and your site is exactly what it was.",
  },
  {
    glyph: "nothing",
    title: "Nothing to host",
    body: "There is no content API, database or admin app. Pages stay as static as you built them, and no outage elsewhere can take your words down.",
  },
] satisfies { glyph: GlyphName; title: string; body: string }[];

const closing = [
  {
    glyph: "forward",
    title: "Never overwrites a colleague",
    body: "If the text changed in the repository since you opened the page, that edit is refused. The branch only ever moves forward.",
  },
  {
    glyph: "hidden",
    title: "Invisible to visitors",
    body: "No editor script ships to the public site. Elements carry a short opaque id, which adds a few hundred bytes to a page.",
  },
  {
    glyph: "lock",
    title: "Your login or a password",
    body: "Reuse your app’s admin session with one function, or set a password. Without either, the edit URL is a plain 404.",
  },
] satisfies { glyph: GlyphName; title: string; body: string }[];

function Card({
  glyph,
  title,
  body,
  children,
  index,
  className,
}: {
  glyph: GlyphName;
  title: string;
  body: string;
  children?: ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <article data-reveal style={order(index)} className={cn("lift rounded-2xl border bg-card p-6 sm:p-7", className)}>
      <PixelGlyph name={glyph} />
      <h3 className="mt-6 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-pretty leading-7 text-muted-foreground">{body}</p>
      {children}
    </article>
  );
}

export function Promises() {
  return (
    <section className="border-y bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Heading
          eyebrow="What you get"
          title={
            <>
              <Px>Less</Px> of everything a CMS usually brings
            </>
          }
        />
        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {featured.map((item, index) => (
            <Card key={item.title} glyph={item.glyph} title={item.title} body={item.body} index={index} className="md:col-span-3">
              {item.visual}
            </Card>
          ))}
          {compact.map((item, index) => (
            <Card key={item.title} {...item} index={index} className="md:col-span-2" />
          ))}
          <Card
            glyph="check"
            title="Writes that cannot break the build"
            body="Every edit is escaped for the syntax it lands in, then the file is parsed again to prove it reads back as typed."
            index={0}
            className="md:col-span-4"
          >
            <Mock className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              <span className="text-muted-foreground">You type</span>
              <span>Ship {"{much}"} faster</span>
              <span className="text-muted-foreground">Torso writes</span>
              <span>
                Ship <mark className="bg-mark/15 px-0.5 text-inherit">&amp;#123;</mark>much
                <mark className="bg-mark/15 px-0.5 text-inherit">&amp;#125;</mark> faster
              </span>
            </Mock>
          </Card>
          <Card {...closing[0]} index={1} className="md:col-span-2" />
          {closing.slice(1).map((item, index) => (
            <Card key={item.title} {...item} index={index} className="md:col-span-3" />
          ))}
        </div>
      </div>
    </section>
  );
}

const limits = [
  "Text that comes from a database or a remote service stays where it is.",
  "It edits what already exists. Images, rich text, new sections and new pages are planned, not built.",
  "Values your code calculates, such as a total or today’s date, are left alone.",
  "Next.js is the supported framework. React on Vite is experimental. Svelte and Vue are not supported yet.",
];

export function Limits() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Heading
          eyebrow="Honest limits"
          title={
            <>
              What it does <Px>not</Px> do
            </>
          }
        />
        <ul data-reveal className="divide-y border-y">
          {limits.map((limit) => (
            <li key={limit} className="flex gap-4 py-5 text-pretty text-lg leading-7">
              <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 bg-foreground/25" />
              {limit}
            </li>
          ))}
          <li className="py-5">
            <More href={statusPage.href}>Every limit we know of, in full</More>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section data-pixel-surface className="relative isolate overflow-hidden bg-[#4a4a3a] text-white">
      <div className="absolute inset-0 -z-10">
        <PixelCanvas src="/nike-arcadia.jpg" align="bottom" />
        <div className="absolute inset-0 bg-black/55" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-28 text-center sm:px-8 sm:py-40">
        <h2 data-reveal className="display max-w-3xl text-balance text-5xl sm:text-7xl">
          This page is edited with <Px>itself</Px>
        </h2>
        <p data-reveal style={order(1)} className="mt-6 max-w-xl text-pretty text-lg leading-8 text-white/85">
          Run the repository, open the edit URL and click on this sentence. Save, and the change is in the
          component file.
        </p>
        <div data-reveal style={order(2)} className="mt-10">
          <CopyPrompt />
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-2xl leading-none text-foreground">
          <Wordmark />
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {[...pages, statusPage].map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <p>Open source under the MIT license.</p>
      </div>
    </footer>
  );
}

export { Heading };
