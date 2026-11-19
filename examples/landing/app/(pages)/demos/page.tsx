import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/site/code-block";
import { Playground } from "@/components/site/playground";
import { Eyebrow } from "@/components/site/sections";
import { Px } from "@/components/site/wordmark";
import { preparedSamples } from "@/lib/demo-prepared";

export const metadata: Metadata = {
  title: "Demos: Torso",
  description: "Edit a page and watch the exact change Torso would write to its source file.",
};

const tryThese = [
  {
    title: "Type something hostile",
    body: "Put { } < > or * _ [ ] into a heading. Each file type escapes them its own way, and the page still shows exactly what you typed.",
  },
  {
    title: "Break a rule",
    body: "Replace the price with a word, or add a brace to a translation. The edit is refused with a reason, and the source stays as it was.",
  },
  {
    title: "Watch what does not change",
    body: "Edit one word and look at the right-hand side. One line moves. Indentation, quotes and every other line are left alone.",
  },
];

const local = `git clone <this repository>
pnpm install
pnpm --dir examples/landing dev

# then open http://localhost:3000/edit`;

export default function Demos() {
  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
        <Eyebrow>Demos</Eyebrow>
        <h1 className="display mt-5 max-w-4xl text-balance text-5xl sm:text-7xl">
          Edit the page. <Px>Read the commit.</Px>
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
          On the left is a small page. On the right is the file it comes from. Change the text and the real Torso
          save step runs on the server, showing the source it would write. Nothing is stored.
        </p>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <Playground samples={preparedSamples()} />
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <h2 data-reveal className="display text-4xl sm:text-5xl">
            Three things to try
          </h2>
          <dl className="mt-10 grid gap-8 md:grid-cols-3">
            {tryThese.map((item, index) => (
              <div key={item.title} data-reveal style={{ "--i": index } as React.CSSProperties} className="border-t pt-6">
                <dt className="font-medium">{item.title}</dt>
                <dd className="mt-2 text-pretty leading-7 text-muted-foreground">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div data-reveal>
          <h2 className="display text-4xl sm:text-5xl">The real editor, on this site</h2>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">
            The demo above shows the save step. The full experience, clicking on a live page with its own fonts
            and layout, needs a site you are allowed to edit. This website is one: run it locally and every page,
            including the{" "}
            <Link href="/docs" className="font-medium text-foreground underline underline-offset-4">
              docs
            </Link>
            , is editable.
          </p>
        </div>
        <CodeBlock code={local} className="self-start" />
      </section>
    </>
  );
}
