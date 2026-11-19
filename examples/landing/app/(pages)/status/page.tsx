import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/site/sections";
import { Px } from "@/components/site/wordmark";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Status and limits: Torso",
  description: "What Torso does today, what is experimental, and what it cannot do yet. Kept honest on purpose.",
};

type State = "Works" | "Experimental" | "Not yet";

const frameworks: { name: string; state: State; note: string }[] = [
  {
    name: "Next.js 16, App Router",
    state: "Works",
    note: "Turbopack and webpack. This is what Torso is built and tested on.",
  },
  {
    name: "React on Vite",
    state: "Experimental",
    note: "A Vite plugin covers plain Vite, and should cover vinext, React Router and TanStack Start. Editing in development is verified on a stock Vite and React app. The others, and saving in production, are not tested yet.",
  },
  {
    name: "Next.js Pages Router",
    state: "Not yet",
    note: "The page analysis is the same, but the edit route is written for the App Router. Untested.",
  },
  {
    name: "Svelte and SvelteKit",
    state: "Not yet",
    note: "Svelte templates are not JSX. Torso needs a second parser, and its own rules for writing text back safely.",
  },
  {
    name: "Vue and Nuxt",
    state: "Not yet",
    note: "Same reason as Svelte: single-file components need their own parser and writer.",
  },
  {
    name: "Astro",
    state: "Not yet",
    note: "Markdown and MDX content in an Astro project is already readable. The .astro templates are not.",
  },
];

const limits: { area: string; items: { title: string; body: string }[] }[] = [
  {
    area: "Finding the text",
    items: [
      {
        title: "Some text is matched by its words, not by an id",
        body: "Text that reaches the page through a prop, a constant, a translation file or Markdown carries no id. Torso matches it by value and only when one candidate is left. If the same words exist in several places, that text is read-only on that page.",
      },
      {
        title: "The editor now says why",
        body: "Click text that cannot be edited and the editor explains it: either the words are in several places, with the files listed, or the text is not written out in your code at all.",
      },
      {
        title: "We cannot prove it never guesses wrong",
        body: "Every mismatch found so far is fixed and covered by a test. But value matching is a heuristic, and a site we have not seen may find a new case. Each save shows the file it changed, and every change is a commit you can revert.",
      },
    ],
  },
  {
    area: "Saving",
    items: [
      {
        title: "A direct commit rebuilds your site each time",
        body: "In the default mode every Save is one commit on your deploy branch, and one build. All edits made before pressing Save go into the same commit, so batch them.",
      },
      {
        title: "Pull-request mode avoids that",
        body: "Set it and saves collect in one pull request. Nothing goes live, and nothing rebuilds, until someone merges. On hosts with preview deployments, the pull request is your preview.",
      },
      {
        title: "No drafts, scheduling or approvals of its own",
        body: "Torso has no workflow beyond what git gives you. Review and approval happen in the pull request.",
      },
      {
        title: "Re-editing from a second device before a merge can be refused",
        body: "The editor remembers what you saved in the browser you saved it from. From another browser, an edit to the same text starts from the old wording, and Torso refuses it because the source no longer matches.",
      },
    ],
  },
  {
    area: "Access",
    items: [
      {
        title: "A password is shared, so it carries no identity",
        body: "With password login every commit is made by the owner of the GitHub token. Connect your own login instead and return a name: that person becomes the author of their commits.",
      },
      {
        title: "The lockout is per server instance",
        body: "Ten wrong passwords lock an address out for ten minutes, but on serverless hosts each instance counts on its own. Treat it as a brake. Use a long password, or your own login.",
      },
      {
        title: "No roles",
        body: "Anyone who may edit may edit everything Torso can reach. The record of who changed what is your git history.",
      },
    ],
  },
  {
    area: "The editor",
    items: [
      {
        title: "Undo reaches back to your last save",
        body: "Ctrl+Z steps back through unsaved edits, including a Discard. Once saved, a change is in your files, and undoing it is a new edit or a git revert.",
      },
      {
        title: "Unsaved edits live in one browser",
        body: "Reload and they are still there. Open the editor elsewhere and they are not.",
      },
      {
        title: "No live collaboration",
        body: "Two people can edit at once. If both change the same text, the second save is refused for that text, with a message. Nobody sees the other typing.",
      },
      {
        title: "Formatted paragraphs are edited piece by piece",
        body: "In a sentence with a bold phrase or a link inside it, each stretch of plain text is editable on its own. You cannot select across them.",
      },
      {
        title: "No images, and no rich text",
        body: "Editors can change words, numbers and link addresses. They cannot swap an image, or add, remove or restyle an element.",
      },
    ],
  },
  {
    area: "What it reads",
    items: [
      {
        title: "Only what is in your repository",
        body: "Text from a database, a remote service or another CMS is out of reach by design. The idea is that the code is the content.",
      },
      {
        title: "Not what your code calculates",
        body: "A total, a formatted date, a string joined from parts, a translation with a placeholder filled in: none of these has one place in the source to write back to.",
      },
    ],
  },
  {
    area: "Maturity",
    items: [
      {
        title: "This is early software",
        body: "Torso is not on npm yet. It has been tested in Chromium, with a thorough unit-test suite for the parts that write files. Saving in production has been tested against a simulated GitHub, not yet in a live deployment.",
      },
    ],
  },
];

function Tag({ state }: { state: State }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn(
          "size-2",
          state === "Works" ? "bg-mark" : state === "Experimental" ? "border border-mark" : "bg-foreground/25",
        )}
      />
      {state}
    </span>
  );
}

export default function Status() {
  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <Eyebrow>Status and limits</Eyebrow>
        <h1 className="display mt-5 max-w-4xl text-balance text-5xl sm:text-7xl">
          Where Torso <Px>stands</Px>
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
          A tool that writes to your repository should be plain about what it can and cannot do. This page lists
          every limit we know of. If you find one that is missing, it belongs here.
        </p>
      </header>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <h2 data-reveal className="display text-4xl sm:text-5xl">
            Frameworks
          </h2>
          <ul data-reveal className="mt-10 divide-y border-y">
            {frameworks.map((item) => (
              <li key={item.name} className="grid gap-2 py-6 md:grid-cols-[16rem_10rem_minmax(0,1fr)] md:gap-8">
                <h3 className="font-medium">{item.name}</h3>
                <Tag state={item.state} />
                <p className="text-pretty leading-7 text-muted-foreground">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {limits.map((group) => (
        <section key={group.area} className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <h2 data-reveal className="display text-4xl">
              {group.area}
            </h2>
            <dl data-reveal className="divide-y border-y">
              {group.items.map((item) => (
                <div key={item.title} className="py-6">
                  <dt className="font-medium">{item.title}</dt>
                  <dd className="mt-2 text-pretty leading-7 text-muted-foreground">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ))}

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <p data-reveal className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
            For how to set up pull-request mode, your own login and the Vite plugin, read the{" "}
            <Link href="/docs" className="font-medium text-foreground underline underline-offset-4">
              docs
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
