import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** The same numbers as the site's hero. */
const COLUMNS = 1024;
const TILE = 16;
const BLOCKS = [1, 2, 4, 8, 16];
const REACH = 5;
const SETTLE_MS = 900;

function reduce(source: ImageData, columns: number, rows: number): ImageData {
  const out = new ImageData(columns, rows);
  const sx = source.width / columns;
  const sy = source.height / rows;
  for (let y = 0; y < rows; y++) {
    const top = y * sy;
    const bottom = top + sy;
    for (let x = 0; x < columns; x++) {
      const left = x * sx;
      const right = left + sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let area = 0;
      for (let py = Math.floor(top); py < Math.min(Math.ceil(bottom), source.height); py++) {
        const h = Math.min(py + 1, bottom) - Math.max(py, top);
        for (let px = Math.floor(left); px < Math.min(Math.ceil(right), source.width); px++) {
          const w = (Math.min(px + 1, right) - Math.max(px, left)) * h;
          const i = (py * source.width + px) * 4;
          r += source.data[i] * w;
          g += source.data[i + 1] * w;
          b += source.data[i + 2] * w;
          area += w;
        }
      }
      const o = (y * columns + x) * 4;
      out.data[o] = r / area;
      out.data[o + 1] = g / area;
      out.data[o + 2] = b / area;
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function blocky(base: ImageData, size: number): HTMLCanvasElement {
  const { width, height } = base;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (size === 1) {
    ctx.putImageData(base, 0, 0);
    return canvas;
  }
  const out = new ImageData(width, height);
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = by; y < Math.min(by + size, height); y++) {
        for (let x = bx; x < Math.min(bx + size, width); x++) {
          const i = (y * width + x) * 4;
          r += base.data[i];
          g += base.data[i + 1];
          b += base.data[i + 2];
          n++;
        }
      }
      for (let y = by; y < Math.min(by + size, height); y++) {
        for (let x = bx; x < Math.min(bx + size, width); x++) {
          const i = (y * width + x) * 4;
          out.data[i] = r / n;
          out.data[i + 1] = g / n;
          out.data[i + 2] = b / n;
          out.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** A repeatable stand-in for Math.random, so every render of a frame is identical. */
const noise = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The hero's pixel photo, driven by the frame number instead of by time and a real
 * pointer. `pointer` gives the pointer's position (as fractions of the picture) for a
 * frame, or null when it is away. Every frame is computed from scratch, because Remotion
 * may render frames in any order.
 */
export function PixelPhoto({
  intro = 0,
  pointer,
}: {
  /** Frame at which the picture starts resolving from coarse to fine. */
  intro?: number;
  pointer?: (frame: number) => { x: number; y: number } | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [levels, setLevels] = useState<HTMLCanvasElement[] | null>(null);
  const [handle] = useState(() => delayRender("Reducing the photo"));

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const full = document.createElement("canvas");
      full.width = image.naturalWidth;
      full.height = image.naturalHeight;
      const ctx = full.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);
      const rows = Math.round((COLUMNS * image.naturalHeight) / image.naturalWidth / TILE) * TILE;
      const base = reduce(ctx.getImageData(0, 0, full.width, full.height), COLUMNS, rows);
      setLevels(BLOCKS.map((size) => blocky(base, size)));
      continueRender(handle);
    };
    image.src = staticFile("nike-arcadia.jpg");
  }, [handle]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !levels) return;
    const columns = levels[0].width;
    const rows = levels[0].height;
    canvas.width = columns;
    canvas.height = rows;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const across = columns / TILE;
    const down = rows / TILE;
    const settle = (SETTLE_MS / 1000) * fps;
    const top = BLOCKS.length - 1;

    for (let ty = 0; ty < down; ty++) {
      for (let tx = 0; tx < across; tx++) {
        const i = ty * across + tx;
        // Arrival: each tile starts with a slightly different amount of disturbance.
        let energy = frame < intro ? 1.25 : 0.75 + noise(i) * 0.5 - (frame - intro) / settle;
        if (pointer) {
          // The pointer's trail: every position of the last moments still counts, a little less each frame.
          for (let age = 0; age <= settle; age++) {
            const at = pointer(frame - age);
            if (!at) continue;
            const reach = 1 - Math.hypot(tx + 0.5 - at.x * across, ty + 0.5 - at.y * down) / REACH;
            if (reach > 0) energy = Math.max(energy, reach - age / settle);
          }
        }
        const level = energy <= 0 ? 0 : Math.min(top, Math.ceil(energy * top));
        ctx.drawImage(levels[level], tx * TILE, ty * TILE, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }, [frame, levels, fps, intro, pointer]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
    />
  );
}
