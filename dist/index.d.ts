export interface CMSOptions {
    /** Project root. Defaults to the directory `next` is run from. */
    root?: string;
}
type Config = Record<string, any>;
type ConfigInput<T> = T | ((phase: string, ctx: any) => T | Promise<T>);
/**
 * Wrap a Next.js config so static text and links carry an opaque id in the rendered HTML.
 * Works with both Turbopack (`turbopack.rules`) and webpack.
 *
 * During `next build` it also records where every editable string lives, so the deployed
 * editor can map the page back to the repository without having the source files.
 */
export declare function withCMS<T extends Config>(nextConfig?: ConfigInput<T>, options?: CMSOptions): (phase: string, ctx: any) => Promise<T>;
export default withCMS;
