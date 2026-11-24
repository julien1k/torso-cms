import { NextResponse, type NextRequest } from "next/server";

/** How much a client wants a media type, from its Accept header. 0 when it is not listed. */
function quality(accept: string, type: string) {
  for (const part of accept.split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (name.trim().toLowerCase() !== type) continue;
    const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    return q ? Number(q.slice(2)) || 0 : 1;
  }
  return 0;
}

/**
 * Agents that ask for Markdown get the page as Markdown at the same address, served by
 * app/md. Everyone else gets the page as before. Both answers say they vary by Accept,
 * so a cache never hands one to a client that asked for the other.
 */
export function proxy(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const markdown = quality(accept, "text/markdown");
  if (markdown > 0 && markdown >= quality(accept, "text/html")) {
    const url = request.nextUrl.clone();
    url.pathname = `/md${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  const response = NextResponse.next();
  response.headers.append("Vary", "Accept");
  return response;
}

export const config = {
  // Pages only: not the editor, Next's own files, or anything with a file extension.
  matcher: ["/((?!edit|md|_next|.*\\.[\\w]+$).*)"],
};
