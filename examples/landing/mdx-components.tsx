import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

/** Plain text of a heading, to derive the anchor the sidebar links to. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** How Markdown elements look on this site. Used by every .mdx page. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => <h1 className="display text-balance text-5xl sm:text-6xl">{children}</h1>,
    h2: ({ children }) => (
      <h2 id={slug(textOf(children))} className="mt-16 border-t pt-10 text-2xl font-medium tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => <h3 className="mt-8 font-medium">{children}</h3>,
    p: ({ children }) => <p className="mt-4 text-pretty leading-7 text-muted-foreground">{children}</p>,
    ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7 text-muted-foreground">{children}</ol>,
    li: ({ children }) => <li className="text-pretty pl-1">{children}</li>,
    strong: ({ children }) => <strong className="font-medium text-foreground">{children}</strong>,
    a: ({ href, children }) => (
      <a href={href} className="font-medium text-foreground underline underline-offset-4">
        {children}
      </a>
    ),
    pre: ({ children }) => (
      <pre
        translate="no"
        className="mt-5 overflow-x-auto rounded-2xl bg-ink p-5 font-mono text-[0.8125rem] leading-6 text-[#f4f4f5] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
      >
        {children}
      </pre>
    ),
    code: ({ children }) => (
      <code translate="no" className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
        {children}
      </code>
    ),
    ...components,
  };
}
