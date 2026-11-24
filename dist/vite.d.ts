import { type CreateCMSOptions } from './server';
export interface TorsoViteOptions extends CreateCMSOptions {
    /** Where the editor lives on the dev server. Defaults to `/edit`. */
    editPath?: string;
}
/**
 * Torso for React apps built with Vite (plain Vite, vinext, React Router, TanStack Start).
 *
 *   // vite.config.ts
 *   import { torso } from "torso-cms/vite";
 *   export default defineConfig({ plugins: [torso(), react()] });
 *
 * It stamps ids on JSX the same way the Next.js integration does, writes the manifest
 * during `vite build`, and in development serves the editor straight from the dev server,
 * so no route file is needed to try it.
 *
 * In production the editor needs a server route. Frameworks with fetch-style handlers can
 * mount `createCMS()` from `torso-cms/server` themselves; a static single-page app has
 * nowhere to run it.
 */
export declare function torso(options?: TorsoViteOptions): any;
export default torso;
