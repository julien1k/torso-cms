"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCMS = withCMS;
const node_path_1 = __importDefault(require("node:path"));
const manifest_1 = require("./manifest");
const EXTENSIONS = ['tsx', 'jsx'];
/**
 * Wrap a Next.js config so static text and links carry an opaque id in the rendered HTML.
 * Works with both Turbopack (`turbopack.rules`) and webpack.
 *
 * During `next build` it also records where every editable string lives, so the deployed
 * editor can map the page back to the repository without having the source files.
 */
function withCMS(nextConfig = {}, options = {}) {
    return async (phase, ctx) => {
        const config = typeof nextConfig === 'function' ? await nextConfig(phase, ctx) : nextConfig;
        const root = options.root ?? process.cwd();
        if (phase === 'phase-production-build')
            (0, manifest_1.writeBuildManifest)(root);
        const loader = node_path_1.default.join(__dirname, 'loader.js');
        const use = { loader, options: { root } };
        const rules = { ...(config.turbopack?.rules ?? {}) };
        for (const ext of EXTENSIONS) {
            const glob = `*.${ext}`;
            const ours = { condition: { not: 'foreign' }, loaders: [use] };
            const existing = rules[glob];
            rules[glob] = existing ? [...(Array.isArray(existing) ? existing : [existing]), ours] : ours;
        }
        const external = new Set([...(config.serverExternalPackages ?? []), 'torso-cms']);
        const includes = { ...(config.outputFileTracingIncludes ?? {}) };
        includes['/*'] = [...(includes['/*'] ?? []), `./${manifest_1.MANIFEST_FILE}`];
        return {
            ...config,
            serverExternalPackages: [...external],
            outputFileTracingIncludes: includes,
            turbopack: { ...(config.turbopack ?? {}), rules },
            webpack(webpackConfig, webpackCtx) {
                webpackConfig.module.rules.unshift({
                    test: /\.(tsx|jsx)$/,
                    exclude: /node_modules/,
                    enforce: 'pre',
                    use: [use],
                });
                return typeof config.webpack === 'function' ? config.webpack(webpackConfig, webpackCtx) : webpackConfig;
            },
        };
    };
}
exports.default = withCMS;
