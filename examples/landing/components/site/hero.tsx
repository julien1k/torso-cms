import type { CSSProperties } from "react";
import Link from "next/link";
import { pages } from "@/lib/navigation";
import { CopyPrompt } from "./copy-prompt";
import { PixelCanvas } from "./pixel-canvas";
import { Px, Wordmark } from "./wordmark";


const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero() {
  return (
    <section
      data-pixel-surface
      className="relative isolate flex h-svh max-h-[1000px] min-h-[600px] flex-col overflow-hidden bg-[#77866b] text-white"
    >
      <div className="absolute inset-0 -z-10">
        <PixelCanvas src="/nike-arcadia.jpg" />
        {/* Vignette: the corners and edges fall off towards black. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgb(0_0_0/0.3)_72%,rgb(0_0_0/0.72)_100%)]" />
      </div>

      <header className="rise flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6" style={step(0)}>
        <Link
          href="/"
          className="rounded-md text-2xl leading-none outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center sm:gap-1">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="pressable rounded-none px-2.5 py-1.5 text-sm text-white/85 outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:px-3"
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* One line, in the sky, so the statue it describes stands clear beneath it. */}
      <h1
        className="rise mt-[clamp(0.5rem,4svh,3.5rem)] px-5 text-center text-[clamp(2.75rem,min(6.6vw,10.5svh),6.5rem)] leading-[1.02] tracking-[-0.045em] [text-shadow:0_2px_32px_rgb(0_0_0/0.32)]"
        style={step(1)}
      >
        Victory needs <br className="sm:hidden" />
        <Px>no head.</Px>
      </h1>

      <div className="rise mt-auto flex justify-center px-5 pb-10 sm:pb-14" style={step(2)}>
        <CopyPrompt />
      </div>

    </section>
  );
}
