"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relativeFile = relativeFile;
exports.transform = transform;
exports.default = torsoLoader;
const node_path_1 = __importDefault(require("node:path"));
const magic_string_1 = __importDefault(require("magic-string"));
const analyze_1 = require("./analyze");
function relativeFile(root, file) {
    return node_path_1.default.relative(root, file).split(node_path_1.default.sep).join('/');
}
/** Stamp opaque ids on JSX elements. The source file on disk is never touched. */
function transform(code, file) {
    const analysis = (0, analyze_1.analyze)(code, file);
    if (!analysis.anchors.length)
        return null;
    const s = new magic_string_1.default(code);
    for (const anchor of analysis.anchors) {
        const attrs = (0, analyze_1.attributesFor)(anchor, analysis.key);
        if (attrs)
            s.appendLeft(anchor.pos, attrs);
    }
    return { code: s.toString(), map: s.generateMap({ hires: true, source: file, includeContent: true }) };
}
/** webpack / Turbopack loader. */
function torsoLoader(source, inputMap) {
    const callback = this.async();
    const resource = this.resourcePath;
    if (/[\\/]node_modules[\\/]/.test(resource) || !/\.(tsx|jsx)$/.test(resource)) {
        return callback(null, source, inputMap);
    }
    try {
        const options = (typeof this.getOptions === 'function' ? this.getOptions() : {}) || {};
        const root = options.root || this.rootContext || process.cwd();
        const result = transform(source, relativeFile(root, resource));
        if (!result)
            return callback(null, source, inputMap);
        // Only hand over our map when we are first in the chain; otherwise keep the incoming one.
        callback(null, result.code, inputMap ?? result.map);
    }
    catch {
        // A file we cannot parse is simply not editable. Never break the build.
        callback(null, source, inputMap);
    }
}
