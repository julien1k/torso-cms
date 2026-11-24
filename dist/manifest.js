"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANIFEST_FILE = void 0;
exports.scanProject = scanProject;
exports.clientManifest = clientManifest;
exports.writeBuildManifest = writeBuildManifest;
exports.readBuildManifest = readBuildManifest;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const analyze_1 = require("./analyze");
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);
const JSX_FILE = /\.(tsx|jsx)$/;
const DATA_FILE = /\.(ts|js|mjs|md|mdx)$/i;
/** Markdown about the repository itself, which is never page content. */
const REPO_DOCS = /^(readme|changelog|license|contributing|code_of_conduct|security|agents|claude)\.mdx?$/i;
const NOT_CONTENT = /(\.d\.ts|\.config\.[cm]?[jt]s|\.(test|spec)\.[jt]sx?)$/;
/** Folders whose JSON files hold translated or shared copy, by the conventions of the common i18n setups. */
const MESSAGE_DIRS = new Set(['messages', 'locales', 'locale', 'i18n', 'lang', 'translations', 'dictionaries']);
const MAX_MESSAGE_BYTES = 1024 * 1024;
const cache = new Map();
/**
 * `messages` is true once we are inside a message folder, where JSON files count.
 * `onlyMessages` is true under `public`, where nothing else is source.
 */
function* sourceFiles(dir, messages = false, onlyMessages = false) {
    for (const entry of node_fs_1.default.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.'))
            continue;
        const full = node_path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'public')
                yield* sourceFiles(full, messages, true);
            else if (!SKIP_DIRS.has(entry.name))
                yield* sourceFiles(full, messages || MESSAGE_DIRS.has(entry.name), onlyMessages);
        }
        else if (messages && /\.json$/i.test(entry.name)) {
            if (node_fs_1.default.statSync(full).size <= MAX_MESSAGE_BYTES)
                yield full;
        }
        else if (!onlyMessages && (JSX_FILE.test(entry.name) || DATA_FILE.test(entry.name)) && !NOT_CONTENT.test(entry.name) && !REPO_DOCS.test(entry.name)) {
            yield full;
        }
    }
}
/**
 * Analyze every source file under `root`. The analysis is deterministic, so the ids match
 * the ones the loader stamped as long as the files have not changed since they were compiled.
 */
function scanProject(root) {
    const out = [];
    for (const full of sourceFiles(root)) {
        const stat = node_fs_1.default.statSync(full);
        const stamp = `${stat.mtimeMs}:${stat.size}`;
        let hit = cache.get(full);
        if (!hit || hit.stamp !== stamp) {
            const file = node_path_1.default.relative(root, full).split(node_path_1.default.sep).join('/');
            let analysis = null;
            try {
                analysis = (0, analyze_1.analyze)(node_fs_1.default.readFileSync(full, 'utf8'), file, { dataOnly: !JSX_FILE.test(full) });
            }
            catch {
                analysis = null;
            }
            hit = { stamp, analysis };
            cache.set(full, hit);
        }
        if (hit.analysis && (hit.analysis.entries.length || hit.analysis.anchors.length))
            out.push(hit.analysis);
    }
    return out;
}
/** What the editor in the browser needs: ids and text, no source offsets. */
function clientManifest(files) {
    return {
        files: files.map((f) => ({
            key: f.key,
            file: f.file,
            hash: f.hash,
            imports: f.imports?.length ? f.imports : undefined,
            entries: f.entries.map(({ id, kind, syntax, text, anchored, host, name, group, line }) => ({ id, kind, syntax, text, anchored, host, name, group, line })),
        })),
    };
}
/** Where `next build` leaves the manifest for the deployed editor, relative to the project root. */
exports.MANIFEST_FILE = '.torso/manifest.json';
function writeBuildManifest(root) {
    const target = node_path_1.default.join(root, exports.MANIFEST_FILE);
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(target), { recursive: true });
    node_fs_1.default.writeFileSync(target, JSON.stringify(clientManifest(scanProject(root))));
}
let built = null;
/** The manifest written by the last build, or null when there is none. */
function readBuildManifest(root) {
    const target = node_path_1.default.join(root, exports.MANIFEST_FILE);
    try {
        const stamp = node_fs_1.default.statSync(target).mtimeMs;
        if (!built || built.stamp !== stamp)
            built = { stamp, manifest: JSON.parse(node_fs_1.default.readFileSync(target, 'utf8')) };
        return built.manifest;
    }
    catch {
        return null;
    }
}
