import { analyze } from "torso-cms/server";
import { samples } from "./demo-samples";

/** The demo samples with each one's source strings, in the order Torso finds them. Server only. */
export const preparedSamples = () =>
  samples.map((sample) => ({
    ...sample,
    texts: analyze(sample.code, sample.file).entries.map((entry) => entry.text),
  }));
