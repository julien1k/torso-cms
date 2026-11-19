"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Shows every `[data-reveal]` element the first time it scrolls into view.
 * The elements themselves stay plain server-rendered markup: the motion is CSS
 * (see globals.css), and this only flips `data-shown` once per element.
 */
export function RevealOnScroll() {
  // Moving between pages keeps this component mounted, so look again on every new path.
  const pathname = usePathname();
  useEffect(() => {
    const pending = document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])");
    if (!("IntersectionObserver" in window)) {
      pending.forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
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
