import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The product name, set in Geist Pixel. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span translate="no" className={cn("px", className)}>
      Torso
    </span>
  );
}

/**
 * The word in a headline that carries it: pixel type inside the editor's dashed box.
 * On hover the box goes solid and a caret blinks after the last letter, the same two
 * states a piece of text has in the editor: hovered, then being edited. All CSS.
 */
export function Px({ children }: { children: ReactNode }) {
  return <span className="px editable">{children}</span>;
}
