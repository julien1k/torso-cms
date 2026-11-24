import { type Editor, type GitHubOptions } from './github';
export { analyze } from './analyze';
export { scanProject, clientManifest } from './manifest';
export { applyEdits, saveToDisk } from './save';
export { saveToGitHub } from './github';
export type { Edit, SaveResult } from './save';
export type { Editor, GitHubOptions } from './github';
export interface CreateCMSOptions {
    /** Project root. Defaults to the directory `next` is run from. */
    root?: string;
    /**
     * Built-in password login. Defaults to the `CMS_PASSWORD` environment variable.
     * Visitors without a session get a password prompt at the edit URL.
     */
    password?: string;
    /** Signs the session cookie. Defaults to `CMS_SECRET`, or a value derived from the password. */
    secret?: string;
    /**
     * Reuse your app's own login instead of a password: return true for people who may edit.
     * Everyone else gets the site's normal 404 page, so the edit URL stays hidden.
     * Return `{ name, email }` instead of `true` and that person becomes the author of the
     * commits their saves create.
     */
    authorize?: (req: Request) => boolean | Editor | Promise<boolean | Editor>;
    /**
     * Where production saves are committed. Defaults to `CMS_GITHUB_REPO`, `CMS_GITHUB_BRANCH`
     * and `CMS_GITHUB_TOKEN`; on Vercel the repo and branch of the deployment are used.
     * Set `mode: "pull-request"` (or `CMS_GITHUB_MODE=pull-request`) to collect saves in a
     * pull request instead of committing each one to the deploy branch.
     */
    github?: Partial<GitHubOptions>;
}
type RouteContext = {
    params?: Promise<Record<string, string | string[] | undefined>>;
};
/**
 * Route handlers for the edit URL. Mount once, in a catch-all route:
 *
 *   // app/edit/[[...path]]/route.ts
 *   export const { GET, POST } = createCMS()
 *
 * `/edit/pricing` then opens `/pricing` in the editor.
 *
 * In development, saving writes the source files on disk. In production it commits to
 * GitHub, and the editor is only reachable when a password or `authorize` is configured.
 */
export declare function createCMS(options?: CreateCMSOptions): {
    GET: (req: Request, ctx?: RouteContext) => Promise<Response>;
    POST: (req: Request, ctx?: RouteContext) => Promise<Response>;
};
