import { createCMS } from "torso-cms/server";

// This site lives in a folder of the Torso repository, so production saves need to know
// where its files sit inside that repository.
export const { GET, POST } = createCMS({ github: { dir: "examples/landing" } });
