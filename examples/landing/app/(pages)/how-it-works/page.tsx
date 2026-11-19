import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/site/code-block";
import { Eyebrow } from "@/components/site/sections";
import { Px } from "@/components/site/wordmark";

export const metadata: Metadata = {
  title: "How Torso works",
  description:
    "What happens at build time, in the editor and on save: how a click on your page becomes a change in your code.",
};

const source = `export function Hero() {
  return (
    <section>
      <h1>Ship faster</h1>
      <a href="/signup">Start for free</a>
    </section>
  );
}`;

const stamped = `<section>
  <h1 data-cms="k3f9a1.0">Ship faster</h1>
  <a data-cms="k3f9a1.2" data-cms-href="k3f9a1.1" href="/signup">
    Start for free
  </a>
</section>`;

const manifest = `{
  "file": "components/hero.tsx",
  "entries": [
    { "id": "k3f9a1.0", "kind": "text", "line": 4, "text": "Ship faster" },
    { "id": "k3f9a1.1", "kind": "href", "line": 5, "text": "/signup" },
    { "id": "k3f9a1.2", "kind": "text", "line": 5, "text": "Start for free" }
  ]
}`;

const written = `      <h1>Ship &#123;much&#125; faster</h1>`;

const matching = [
  {
    title: "By id",
    body: "Text written directly inside an HTML tag carries its id. The match is exact, even when the same words appear ten times on the page.",
  },
  {
    title: "By value",
    body: "Text that arrives through a prop, a constant, a translation file or Markdown has no id. It is matched by its words, preferring the file that rendered the element, and only when that leaves exactly one candidate.",
  },
  {
    title: "By company",
    body: "A number is only trusted when text from the same object sits beside it: a price inside the card that shows its plan’s name. A stray 3 elsewhere in your code can never claim a 3 on the page.",
  },
];

const checks = [
  {
    title: "Is it still the same text?",
    body: "The edit names the text you started from. If the source says something else now, because a developer changed it, that edit is refused and nothing is written.",
  },
  {
    title: "Escape for where it lands",
    body: "JSX, a string, a template literal, JSON, YAML and Markdown each have their own rules. A brace typed into a heading becomes an entity, not an expression.",
  },
  {
    title: "Read it back",
    body: "The changed file is parsed again. Unless every edited string reads back exactly as typed, and nothing else moved, the file is not written.",
  },
];

function Stage({
  number,
  title,
  children,
  aside,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <section className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-28">
        <div data-reveal>
          <span className="font-mono text-sm tabular-nums text-mark">{number}</span>
          <h2 className="display mt-3 text-balance text-4xl">{title}</h2>
          <div className="mt-4 space-y-4 text-pretty leading-7 text-muted-foreground">{children}</div>
        </div>
        <div data-reveal className="min-w-0 space-y-4">
          {aside}
        </div>
      </div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="display mt-5 max-w-4xl text-balance text-5xl sm:text-7xl">
          From a click on the page to a <Px>line in your code</Px>
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
          Torso has no database and no content API. It works because it knows, for every word on the page, which
          line of which file it came from. Here is how it finds out, and what it does with that.
        </p>
      </header>

      <Stage
        number="01"
        title="At build time, your components are read"
        aside={
          <>
            <CodeBlock file="components/hero.tsx, as you wrote it" code={source} />
            <CodeBlock file="What the browser receives" code={stamped} marked={[1, 2]} />
          </>
        }
      >
        <p>
          Wrapping your Next.js config adds one step to the compiler. It reads each component, finds the text and
          link addresses that are written out literally, and stamps a short id on the element that holds them.
        </p>
        <p>
          The file on disk is never modified. Anything dynamic, such as a variable, a loop or a function call, is
          left exactly as it is.
        </p>
      </Stage>

      <Stage
        number="02"
        title="A manifest remembers where everything lives"
        aside={<CodeBlock file=".torso/manifest.json" code={manifest} />}
      >
        <p>
          The same analysis produces a manifest: for every id, the file, the position and the text. It also lists
          the text that has no id because it reaches the page indirectly, from props, constants, translation
          files and Markdown.
        </p>
        <p>
          In development it is computed on demand. For production it is written during the build and travels
          with your deployment, so the server never needs your source files.
        </p>
      </Stage>

      <Stage
        number="03"
        title="The editor wraps your site from the outside"
        aside={
          <>
            <div className="rounded-2xl border bg-muted/40 p-3">
              <p className="px-2 pb-3 font-mono text-xs text-muted-foreground">/edit</p>
              <div className="rounded-xl border bg-background p-6">
                <p className="font-mono text-xs text-muted-foreground">Your site, in a frame, unmodified</p>
                <p className="mt-4 text-2xl font-medium tracking-tight">
                  <span className="rounded-sm outline-2 outline-offset-4 outline-dashed outline-mark">
                    Ship faster
                  </span>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">Start for free</p>
              </div>
              <div className="mx-auto mt-3 flex w-fit items-center gap-3 rounded-none bg-ink px-4 py-2 text-xs text-paper">
                <span>1 unsaved change</span>
                <span className="rounded-none bg-mark px-2.5 py-1 font-medium">Save</span>
              </div>
            </div>
            <dl className="grid gap-3">
              {matching.map((item) => (
                <div key={item.title} className="rounded-xl border p-4">
                  <dt className="text-sm font-medium">{item.title}</dt>
                  <dd className="mt-1.5 text-pretty text-sm leading-6 text-muted-foreground">{item.body}</dd>
                </div>
              ))}
            </dl>
          </>
        }
      >
        <p>
          The edit URL serves a small page of its own: your real site in a frame, with the toolbar around it. The
          editor reaches into the frame, so your pages load no editor script and visitors never download one.
        </p>
        <p>
          When you click, it looks up what is under the pointer in the manifest. There are three ways a piece of
          text can be recognised, and when none of them is certain the text simply stays read-only.
        </p>
      </Stage>

      <Stage
        number="04"
        title="Saving is three checks, then a write"
        aside={
          <>
            <ol className="space-y-4">
              {checks.map((check, index) => (
                <li key={check.title} className="flex gap-4 rounded-xl border p-5">
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                  <div>
                    <h3 className="font-medium">{check.title}</h3>
                    <p className="mt-1.5 text-pretty text-sm leading-6 text-muted-foreground">{check.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <CodeBlock file="Typing “Ship {much} faster” writes" code={written} marked={[0]} />
          </>
        }
      >
        <p>
          The browser sends only an id, the text you started from and the new text. It never sends a file path or
          file contents, so an editor cannot write anywhere the manifest does not point.
        </p>
        <p>
          On your machine the component file is rewritten and the page refreshes in place. In production the same
          change becomes one commit on your branch, added on top of whatever is there. The branch is never
          force-moved.
        </p>
      </Stage>

      <Stage
        number="05"
        title="Then your host does what it always does"
        aside={
          <div className="rounded-2xl border p-6">
            <h3 className="font-medium">What never happens</h3>
            <ul className="mt-4 space-y-3 text-pretty text-sm leading-6 text-muted-foreground">
              <li>Your pages never fetch content at request time. The words are in the build.</li>
              <li>Visitors never download the editor, the manifest or a file path.</li>
              <li>An edit never adds or removes an element. It replaces the inside of one string.</li>
              <li>A save never overwrites a change it has not seen.</li>
            </ul>
          </div>
        }
      >
        <p>
          A commit lands, your host rebuilds, and the new text is live. Until then the editor keeps showing what
          you saved, so a change never looks lost while the build runs.
        </p>
        <p>
          That is the whole system. To see the checks run on real input, try the{" "}
          <Link href="/demos" className="font-medium text-foreground underline underline-offset-4">
            demos
          </Link>
          . To set it up, read the{" "}
          <Link href="/docs" className="font-medium text-foreground underline underline-offset-4">
            docs
          </Link>
          .
        </p>
      </Stage>
    </>
  );
}
