"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Columns the photo is reduced to. The canvas never holds more pixels than this. */
const COLUMNS = 1024;
/** The pointer effect works on square tiles of this many cells. */
const TILE = 16;
/** Block sizes, in cells, a tile steps through as it is disturbed: 1 is the resting image. */
const BLOCKS = [1, 2, 4, 8, 16];
/** How far the pointer reaches, in tiles. */
const REACH = 5;
/** Milliseconds for a fully disturbed tile to settle back to single cells. */
const SETTLE = 900;

/**
 * Reduce the image to `columns` x `rows`. Every output cell is the area-weighted average
 * of the source rectangle that lands on it, so nothing shimmers the way picking one
 * source pixel per cell would.
 */
function reduce(source: ImageData, columns: number, rows: number): ImageData {
  const out = new ImageData(columns, rows);
  const sx = source.width / columns;
  const sy = source.height / rows;
  const src = source.data;
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
          r += src[i] * w;
          g += src[i + 1] * w;
          b += src[i + 2] * w;
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

/** Draw the picture into `canvas` in blocks of `size` cells, at full cell resolution. */
function blocky(base: ImageData, size: number, canvas: HTMLCanvasElement) {
  const { width, height } = base;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (size === 1) {
    ctx.putImageData(base, 0, 0);
    return;
  }
  const out = new ImageData(width, height);
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const yEnd = Math.min(by + size, height);
      const xEnd = Math.min(bx + size, width);
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const i = (y * width + x) * 4;
          r += base.data[i];
          g += base.data[i + 1];
          b += base.data[i + 2];
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const i = (y * width + x) * 4;
          out.data[i] = r;
          out.data[i + 1] = g;
          out.data[i + 2] = b;
          out.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * A photo shown as real pixels. The file itself is never displayed: it is read into
 * memory, averaged down to 1024 columns, and that small canvas is stretched with hard
 * edges. Under the pointer the cells merge into larger blocks, then settle back.
 */
export function PixelCanvas({
  src,
  align = "center",
  className,
}: {
  src: string;
  /** Which part of the photo to keep when the box is wider than the photo: its middle or its bottom. */
  align?: "center" | "bottom";
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Content usually sits on top of the canvas, so listen on the surface that holds both.
    const host = canvas.closest<HTMLElement>("[data-pixel-surface]") ?? canvas.parentElement!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverable = window.matchMedia("(hover: hover) and (pointer: fine)");
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      // Read the photo at its real size, off screen.
      const full = document.createElement("canvas");
      full.width = image.naturalWidth;
      full.height = image.naturalHeight;
      const fullCtx = full.getContext("2d", { willReadFrequently: true })!;
      fullCtx.drawImage(image, 0, 0);
      const source = fullCtx.getImageData(0, 0, full.width, full.height);

      // Keep the aspect ratio, rounded to whole tiles so every block size divides evenly.
      const columns = COLUMNS;
      const rows = Math.max(TILE, Math.round((columns * source.height) / source.width / TILE) * TILE);
      const photo = reduce(source, columns, rows);
      canvas.width = columns;
      canvas.height = rows;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const levels = BLOCKS.map((size) => {
        const level = document.createElement("canvas");
        blocky(photo, size, level);
        return level;
      });

      const across = columns / TILE;
      const down = rows / TILE;
      const energy = new Float32Array(across * down);
      const shown = new Int8Array(across * down).fill(-1);
      const top = BLOCKS.length - 1;
      let pointer: { x: number; y: number } | null = null;
      let last = 0;

      /** How the canvas (object-fit: cover) sits on screen: px per cell, and where cell 0,0 is. */
      const placement = () => {
        const box = canvas.getBoundingClientRect();
        const scale = Math.max(box.width / columns, box.height / rows);
        return {
          scale,
          left: box.left + (box.width - columns * scale) / 2,
          top: box.top + (box.height - rows * scale) * (align === "bottom" ? 1 : 0.5),
        };
      };

      const paint = (index: number, level: number) => {
        if (shown[index] === level) return;
        shown[index] = level;
        const x = (index % across) * TILE;
        const y = Math.floor(index / across) * TILE;
        ctx.drawImage(levels[level], x, y, TILE, TILE, x, y, TILE, TILE);
      };
      const levelOf = (e: number) => (e <= 0 ? 0 : Math.min(top, Math.ceil(e * top)));

      const tick = (now: number) => {
        frame = 0;
        const dt = last ? Math.min(now - last, 64) : 16;
        last = now;
        if (pointer) {
          const cx = pointer.x / TILE;
          const cy = pointer.y / TILE;
          for (let ty = Math.max(0, Math.floor(cy - REACH)); ty <= Math.min(down - 1, Math.ceil(cy + REACH)); ty++) {
            for (let tx = Math.max(0, Math.floor(cx - REACH)); tx <= Math.min(across - 1, Math.ceil(cx + REACH)); tx++) {
              const reach = 1 - Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) / REACH;
              if (reach > 0) {
                const i = ty * across + tx;
                if (reach > energy[i]) energy[i] = reach;
              }
            }
          }
        }
        let active = false;
        for (let i = 0; i < energy.length; i++) {
          const e = energy[i];
          paint(i, levelOf(e));
          if (e <= 0) continue;
          energy[i] = e - dt / SETTLE;
          active = true;
        }
        if (active || pointer) frame = requestAnimationFrame(tick);
        else last = 0;
      };
      const wake = () => {
        if (!frame) frame = requestAnimationFrame(tick);
      };

      // Arrive coarse and resolve, a little unevenly, into single cells.
      if (!reduced.matches) for (let i = 0; i < energy.length; i++) energy[i] = 0.75 + Math.random() * 0.5;
      for (let i = 0; i < energy.length; i++) paint(i, levelOf(energy[i]));
      wake();
      canvas.dataset.ready = "true";

      const onMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !hoverable.matches || reduced.matches) return;
        const place = placement();
        pointer = { x: (event.clientX - place.left) / place.scale, y: (event.clientY - place.top) / place.scale };
        wake();
      };
      const onLeave = () => {
        pointer = null;
      };
      // On a touch screen there is no hover: a tap, or a finger dragged across, disturbs the
      // pixels where it lands, and they settle once the finger is gone. Scrolling is untouched.
      let release = 0;
      const onTouch = (event: PointerEvent) => {
        if (event.pointerType === "mouse" || reduced.matches) return;
        const place = placement();
        pointer = { x: (event.clientX - place.left) / place.scale, y: (event.clientY - place.top) / place.scale };
        wake();
        window.clearTimeout(release);
        release = window.setTimeout(onLeave, 220);
      };
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onTouch);
      host.addEventListener("pointermove", onTouch);
      cleanup = () => {
        window.clearTimeout(release);
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        host.removeEventListener("pointerdown", onTouch);
        host.removeEventListener("pointermove", onTouch);
      };
    };
    image.src = src;

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [src, align]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-align={align}
      className={cn(
        "size-full object-cover data-[align=bottom]:object-bottom opacity-0 transition-opacity duration-300 ease-out [image-rendering:crisp-edges] [image-rendering:pixelated] data-[ready=true]:opacity-100",
        className,
      )}
    />
  );
}
