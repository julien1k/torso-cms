"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pages } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

/** The header of every page except the home page, whose hero carries its own. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="rounded-md text-2xl leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center sm:gap-1">
          {pages.map((page) => {
            const current = pathname === page.href || pathname.startsWith(`${page.href}/`);
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "pressable rounded-none px-2.5 py-1.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-3",
                  current && "bg-muted text-foreground",
                )}
              >
                {page.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
