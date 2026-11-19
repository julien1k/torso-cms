import { analyze, applyEdits } from "torso-cms/server";
import { sampleByKey } from "@/lib/demo-samples";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * Runs Torso's real save step for the demos page. Nothing is written anywhere: the
 * source always starts from the fixed sample, and the client only supplies the new
 * text for each of its strings.
 */
export async function POST(request: Request) {
  let body: { sample?: unknown; values?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "expected json" }, 400);
  }
  const sample = typeof body.sample === "string" ? sampleByKey(body.sample) : undefined;
  if (!sample) return json({ error: "unknown sample" }, 400);

  const entries = analyze(sample.code, sample.file).entries;
  const values = body.values;
  if (
    !Array.isArray(values) ||
    values.length !== entries.length ||
    values.some((value) => typeof value !== "string" || value.length > 300)
  ) {
    return json({ error: "expected one short string per entry" }, 400);
  }

  const edits = entries
    .map((entry, index) => ({ id: entry.id, from: entry.text, to: values[index] as string }))
    .filter((edit) => edit.to !== edit.from);
  const result = applyEdits(sample.code, sample.file, edits);
  return json({
    code: result.code,
    conflicts: result.conflicts.map((conflict) => ({
      index: entries.findIndex((entry) => entry.id === conflict.id),
      reason: conflict.reason,
    })),
  });
}
