import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { slug } from "@/mdx-components";

/** The sections of the docs page, in order. Each must match a second-level heading in page.mdx. */
const sections = [
  "Requirements",
  "Install",
  "Wrap your config",
  "Add the edit route",
  "Who can edit",
  "Where saves go",
  "What you can edit",
  "What stays read-only",
  "In the editor",
  "Deploying",
  "Other frameworks",
  "Options",
  "Troubleshooting",
];

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-24">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">On this page</p>
          <ul className="mt-4 space-y-1 border-l">
            {sections.map((title) => (
              <li key={title}>
                <a
                  href={`#${slug(title)}`}
                  className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-muted-foreground outline-none transition-colors duration-150 hover:border-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <Collapsible className="border lg:hidden">
        <CollapsibleTrigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between px-4 font-mono text-xs uppercase tracking-wider text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          On this page
          <span aria-hidden="true" className="px text-base text-mark group-data-open:hidden">
            +
          </span>
          <span aria-hidden="true" className="px hidden text-base text-mark group-data-open:inline">
            -
          </span>
        </CollapsibleTrigger>
        <CollapsiblePanel hiddenUntilFound>
          <ul className="border-t px-4 py-2">
            {sections.map((title) => (
              <li key={title}>
                <a href={`#${slug(title)}`} className="tap flex text-sm text-muted-foreground">
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
      <article className="min-w-0 max-w-2xl">{children}</article>
    </div>
  );
}
