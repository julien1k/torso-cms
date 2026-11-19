import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Small icons drawn on a 7 x 7 grid, in the spirit of the hero's pixels. `#` is a filled square. */
const glyphs = {
  empty: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
  code: [".......", "..#.#..", ".#...#.", "#.....#", ".#...#.", "..#.#..", "......."],
  branch: [".#...#.", ".#...#.", ".#..#..", ".###...", ".#.....", ".#.....", ".#....."],
  agent: ["...#...", ".#####.", ".#.#.#.", ".#####.", ".#...#.", ".#####.", "......."],
  nothing: [".#####.", "#....##", "#...#.#", "#..#..#", "#.#...#", "##....#", ".#####."],
  hidden: [".......", ".......", "#.....#", ".#...#.", "..###..", ".#.#.#.", "......."],
  check: [".......", "......#", ".....#.", "#...#..", ".#.#...", "..#....", "......."],
  forward: [".......", "#..#...", ".#..#..", "..#..#.", ".#..#..", "#..#...", "......."],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
} as const;

export type GlyphName = keyof typeof glyphs;

export function PixelGlyph({ name, className }: { name: GlyphName; className?: string }) {
  const rows = glyphs[name];
  return (
    <svg
      viewBox="0 0 7 7"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={cn("glyph size-7 text-mark", className)}
    >
      {rows.flatMap((row, y) =>
        Array.from(row).map((cell, x) =>
          cell === "#" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill="currentColor"
              // An uneven order, so the squares arrive scattered, not row by row.
              style={{ "--n": (x * 3 + y * 5) % 11 } as CSSProperties}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
