"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Shows every `[data-reveal]` element the first time it scrolls into view.
 *
 * The elements stay plain server-rendered markup, hidden by CSS (see globals.css). This
 * plays a Web Animation on each one and lets it hold its end state. Nothing is written
 * to the element's attributes, so React never sees markup that differs from what the
 * server sent, however late a part of the page hydrates.
 */
export function RevealOnScroll() {
  // Moving between pages keeps this component mounted, so look again on every new path.
  const pathname = usePathname();
  useEffect(() => {
    const seen = new WeakSet<Element>();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const show = (el: HTMLElement) => {
      if (seen.has(el)) return;
      seen.add(el);
      const order = Number(getComputedStyle(el).getPropertyValue("--i")) || 0;
      el.animate(
        reduced
          ? [{ opacity: 0, transform: "none" }, { opacity: 1, transform: "none" }]
          : [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }],
        { duration: reduced ? 400 : 700, delay: order * 70, easing: reduced ? "ease" : EASE, fill: "both" },
      );
      // Pixel icons inside draw themselves, one square after another.
      el.querySelectorAll<SVGRectElement>(".glyph rect").forEach((rect) => {
        const n = Number(rect.style.getPropertyValue("--n")) || 0;
        rect.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: n * 16 + order * 70 + 250, fill: "both" });
      });
    };

    const pending = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      pending.forEach(show);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      // Wait until the element is properly inside the viewport, not just touching its edge.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );
    pending.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
