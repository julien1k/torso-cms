import { NodeHtmlMarkdown } from "node-html-markdown";
import { parse } from "node-html-parser";
import { allPages } from "@/lib/navigation";

const headers = { "content-type": "text/markdown; charset=utf-8", vary: "Accept" };

const converter = new NodeHtmlMarkdown({
  // Decoration and controls that only mean something in a browser.
  ignore: ["script", "style", "noscript", "template", "svg", "canvas", "button", "nav", "textarea", "input"],
});

const notFound = (origin: string) =>
  new Response(
    [
      "# Page not found",
      "",
      "There is no page at this address. These are all the pages of the site:",
      "",
      ...allPages.map((page) => `- [${page.label}](${origin}${page.href})`),
      "",
      `The same list is in the [sitemap](${origin}/sitemap.xml). Setup is covered in the [docs](${origin}/docs).`,
      "",
    ].join("\n"),
    { status: 404, headers },
  );

/**
 * The Markdown version of a page, made from the page's own HTML so the two cannot drift
 * apart. Requests arrive here from proxy.ts when a client asks for text/markdown.
 */
export async function GET(request: Request, { params }: RouteContext<"/md/[[...path]]">) {
  const { path = [] } = await params;
  const { origin } = new URL(request.url);
  const page = allPages.find((candidate) => candidate.href === `/${path.join("/")}`);
  if (!page) return notFound(origin);

  const response = await fetch(`${origin}${page.href}`, { headers: { accept: "text/html" } });
  if (!response.ok) return notFound(origin);
  const html = await response.text();
  const document = parse(html);
  const title = document.querySelector("title")?.text;
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content");
  const main = document.querySelector("main");
  if (!main) return notFound(origin);
  // Decoration, and live demos that read as page content once their framing is gone.
  for (const node of main.querySelectorAll('[aria-hidden="true"], [data-markdown="skip"]')) node.remove();
  // Code blocks draw each line as its own element. Markdown needs the line breaks back.
  for (const pre of main.querySelectorAll("pre")) {
    pre.set_content(pre.innerHTML.replaceAll("</span><span", "</span>\n<span"));
  }

  const others = allPages.filter((other) => other !== page);
  const body = [
    "---",
    ...(title ? [`title: ${JSON.stringify(title)}`] : []),
    ...(description ? [`description: ${JSON.stringify(description)}`] : []),
    `url: ${origin}${page.href}`,
    "---",
    "",
    converter.translate(main.innerHTML).trim(),
    "",
    "## More pages",
    "",
    ...others.map((other) => `- [${other.label}](${origin}${other.href})`),
    "",
  ].join("\n");
  return new Response(body, { headers });
}
