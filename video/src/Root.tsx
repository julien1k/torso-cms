import { Composition } from "remotion";
import { DURATION, FPS, Promo } from "./Promo";

export function Root() {
  return <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />;
}
