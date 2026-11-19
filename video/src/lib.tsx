import type { CSSProperties, ReactNode } from "react";
import { continueRender, delayRender, Easing, interpolate, staticFile } from "remotion";

/** The site's identity: white, black, one blue, square corners, Geist and Geist Pixel. */
export const color = {
  paper: "#ffffff",
  ink: "#0b0b0c",
  mark: "#2450ff",
  markOnInk: "#6f8cff",
  muted: "#5f6066",
  mutedOnInk: "#a0a1a8",
  line: "#d9d9dc",
  lineOnInk: "rgba(255,255,255,0.16)",
  soft: "#f1f1f2",
};

export const font = {
  sans: "Geist, system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
  pixel: "'Geist Pixel', 'Geist Mono', monospace",
};

// Fonts are local files, loaded once per render tab before any frame is drawn.
const faces: [family: string, file: string, weight: string][] = [
  ["Geist", "fonts/Geist-Regular.woff2", "400"],
  ["Geist", "fonts/Geist-Medium.woff2", "500"],
  ["Geist Mono", "fonts/GeistMono-Regular.woff2", "400"],
  ["Geist Pixel", "fonts/GeistPixel-Square.woff2", "500"],
];
if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map(async ([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
      document.fonts.add(await face.load());
    }),
  ).then(
    () => continueRender(handle),
    () => continueRender(handle),
  );
}

/** The curve used across the site: fast out of the gate, long settle. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 to 1 over `length` frames starting at `start`. */
export const ramp = (frame: number, start: number, length: number, easing = easeOut) =>
  interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing });

/** Fade and rise in, the way content arrives on the site. */
export const rise = (frame: number, start: number, distance = 24, length = 18): CSSProperties => {
  const t = ramp(frame, start, length);
  return { opacity: t, transform: `translateY(${(1 - t) * distance}px)` };
};

/** The part of `text` typed so far. */
export const typed = (text: string, frame: number, start: number, framesPerChar: number) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - start) / framesPerChar))));

/** Move through a list of [frame, x, y] points, easing between each pair. */
export function along(frame: number, points: [number, number, number][]): { x: number; y: number } {
  const frames = points.map((p) => p[0]);
  const options = { ...clamp, easing: easeInOut };
  return {
    x: interpolate(frame, frames, points.map((p) => p[1]), options),
    y: interpolate(frame, frames, points.map((p) => p[2]), options),
  };
}

export function Cursor({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${pressed ? 0.86 : 1})`,
        transformOrigin: "4px 3px",
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
        zIndex: 50,
      }}
    >
      <path d="M4 3l15 7.5-6.6 1.9L10.5 19z" fill="#fff" stroke="#0b0b0c" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** The editor's box: dashed when hovered, solid with a caret when being edited. */
export function Editable({
  children,
  state,
  frame = 0,
  onPhoto = false,
  style,
}: {
  children: ReactNode;
  state: "plain" | "hover" | "editing";
  frame?: number;
  onPhoto?: boolean;
  style?: CSSProperties;
}) {
  const tone = onPhoto ? "#ffffff" : color.mark;
  const caretOn = Math.floor(frame / 16) % 2 === 0;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        padding: "0.04em 0.14em",
        margin: "0 0.04em",
        outline: state === "plain" ? "none" : `0.03em ${state === "hover" ? "dashed" : "solid"} ${tone}`,
        background: state === "plain" ? "transparent" : onPhoto ? "rgba(255,255,255,0.16)" : "rgba(36,80,255,0.1)",
        ...style,
      }}
    >
      {children}
      {state === "editing" && (
        <span
          style={{
            display: "inline-block",
            width: "0.045em",
            height: "0.82em",
            marginLeft: "0.06em",
            marginRight: "-0.105em",
            verticalAlign: "-0.06em",
            background: tone,
            opacity: caretOn ? 1 : 0,
          }}
        />
      )}
    </span>
  );
}

export function Eyebrow({ children, onInk = false }: { children: ReactNode; onInk?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: font.mono,
        fontSize: 24,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: onInk ? color.mutedOnInk : color.muted,
      }}
    >
      <span style={{ width: 14, height: 14, background: onInk ? color.markOnInk : color.mark }} />
      {children}
    </div>
  );
}

const glyphs = {
  empty: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
  code: [".......", "..#.#..", ".#...#.", "#.....#", ".#...#.", "..#.#..", "......."],
  branch: [".#...#.", ".#...#.", ".#..#..", ".###...", ".#.....", ".#.....", ".#....."],
  agent: ["...#...", ".#####.", ".#.#.#.", ".#####.", ".#...#.", ".#####.", "......."],
  nothing: [".#####.", "#....##", "#...#.#", "#..#..#", "#.#...#", "##....#", ".#####."],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
} as const;

export type GlyphName = keyof typeof glyphs;

/** A pixel icon that draws itself square by square from `start`. */
export function Glyph({ name, size, frame, start }: { name: GlyphName; size: number; frame: number; start: number }) {
  return (
    <svg viewBox="0 0 7 7" width={size} height={size} shapeRendering="crispEdges">
      {glyphs[name].flatMap((row, y) =>
        Array.from(row).map((cell, x) =>
          cell === "#" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={color.mark}
              opacity={frame >= start + ((x * 3 + y * 5) % 11) * 1.2 ? 1 : 0}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
