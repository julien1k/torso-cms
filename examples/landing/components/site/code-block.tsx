import { cn } from "@/lib/utils";

/** A block of code with an optional file name above it. Lines in `marked` are highlighted. */
export function CodeBlock({
  code,
  file,
  marked,
  className,
}: {
  code: string;
  file?: string;
  marked?: number[];
  className?: string;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-2xl bg-ink text-[#f4f4f5]", className)}>
      {file && (
        <figcaption translate="no" className="border-b border-white/10 px-5 py-2.5 font-mono text-xs text-neutral-400">
          {file}
        </figcaption>
      )}
      <pre className="overflow-x-auto py-4 font-mono text-[0.8125rem] leading-6">
        <code translate="no" className="grid min-w-max">
          {lines.map((line, index) => (
            <span
              key={index}
              className={cn(
                "border-l-2 border-transparent px-5",
                marked?.includes(index) && "border-mark bg-mark/25 text-white",
              )}
            >
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
