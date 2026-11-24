"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replacementFor = replacementFor;
exports.applyEdits = applyEdits;
exports.groupEdits = groupEdits;
exports.saveToDisk = saveToDisk;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const magic_string_1 = __importDefault(require("magic-string"));
const analyze_1 = require("./analyze");
const markdown_1 = require("./markdown");
const manifest_1 = require("./manifest");
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;
const UNSAFE_URL = /^\s*(javascript|data|vbscript)\s*:/i;
const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;
/** What a source number reads back as, e.g. "29.50" is stored and shown as 29.5. */
const asNumber = (value) => String(Number(value));
function quoted(value, quote) {
    const inner = JSON.stringify(value).slice(1, -1);
    if (quote === '"')
        return `"${inner}"`;
    return `'${inner.replace(/\\.|'/g, (m) => (m === '\\"' ? '"' : m === "'" ? "\\'" : m))}'`;
}
function template(value) {
    return '`' + value.replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${') + '`';
}
function jsxTextEscape(value) {
    return value
        .replace(ENTITY, '&amp;$1;')
        .replace(/[{}<>\u00a0]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;', '\u00a0': '&nbsp;' })[c]);
}
/** Work out the exact source replacement for one entry. `plain` avoids JSX text syntax entirely. */
function replacementFor(code, entry, to, plain = false) {
    const { start, end } = entry;
    switch (entry.syntax) {
        case 'number':
            return { start, end, text: asNumber(to) };
        case 'markdown':
            return { start, end, text: (0, markdown_1.escapeMarkdown)(to) };
        case 'yaml':
            return { start, end, text: (0, markdown_1.yamlString)(to) };
        case 'string':
            return { start, end, text: quoted(to, code[start] === "'" ? "'" : '"') };
        case 'template':
            return { start, end, text: template(to) };
        case 'jsxAttr': {
            const quote = code[start] === "'" ? "'" : '"';
            if (plain || /[\r\n\t\\]/.test(to))
                return { start, end, text: `{${JSON.stringify(to)}}` };
            const body = to.replace(ENTITY, '&amp;$1;').replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&apos;');
            return { start, end, text: quote + body + quote };
        }
        case 'jsxText': {
            // Indentation around the text is not content: keep it, and replace only what renders.
            const raw = code.slice(start, end);
            const lead = /^[ \t\r\n]*/.exec(raw)[0];
            const trail = /[ \t\r\n]*$/.exec(raw.slice(lead.length))[0];
            const leadBreak = /[\r\n]/.test(lead);
            const trailBreak = /[\r\n]/.test(trail);
            const from = leadBreak ? start + lead.length : start;
            const until = trailBreak ? end - trail.length : end;
            const [, newLead, core, newTrail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(to);
            // JSX drops whitespace next to a line break, so edge spaces there need a string literal.
            const edgeLost = (newLead && leadBreak) || (newTrail && trailBreak);
            if (plain || !core || edgeLost || /[\r\n\t]/.test(to)) {
                return { start: from, end: until, text: `{${JSON.stringify(to)}}` };
            }
            return { start: from, end: until, text: newLead + jsxTextEscape(core) + newTrail };
        }
    }
}
/**
 * Apply edits to one file's source. Each edit is checked against the current source first,
 * and the result is re-parsed to prove every edited string now reads back as intended.
 */
function applyEdits(code, file, edits, options = {}) {
    const analysis = (0, analyze_1.analyze)(code, file, options);
    const conflicts = [];
    const targets = [];
    const taken = new Set();
    for (const edit of edits) {
        let index = analysis.entries.findIndex((e) => e.id === edit.id);
        if (index < 0 || analysis.entries[index].text !== edit.from) {
            // The file moved under the editor. Follow the string if it is still unambiguous.
            const same = analysis.entries.map((e, i) => (e.text === edit.from ? i : -1)).filter((i) => i >= 0);
            index = same.length === 1 ? same[0] : -1;
        }
        if (index < 0 || taken.has(index)) {
            conflicts.push({ id: edit.id, reason: 'changed' });
            continue;
        }
        const entry = analysis.entries[index];
        if ((entry.kind === 'href' || entry.name === 'href') && UNSAFE_URL.test(edit.to)) {
            conflicts.push({ id: edit.id, reason: 'unsafe-url' });
            continue;
        }
        if (entry.syntax === 'number' && !PLAIN_NUMBER.test(edit.to)) {
            conflicts.push({ id: edit.id, reason: 'not-a-number' });
            continue;
        }
        // In message files braces start a placeholder, so a stray one would break the page at runtime.
        if ((0, analyze_1.isMessageFile)(file) && /[{}]/.test(edit.to) && !/[{}]/.test(entry.text)) {
            conflicts.push({ id: edit.id, reason: 'placeholder-syntax' });
            continue;
        }
        taken.add(index);
        targets.push({ edit, index });
    }
    const isMarkdown = (index) => analysis.entries[index].syntax === 'markdown' || analysis.entries[index].syntax === 'yaml';
    // Markdown drops spaces at the edge of a block, so as a last resort the edge spaces are given up.
    const attempt = (plain, trim = false) => {
        const value = (edit, index) => (trim && isMarkdown(index) ? edit.to.trim() : edit.to);
        const s = new magic_string_1.default(code);
        for (const { edit, index } of targets) {
            const r = replacementFor(code, analysis.entries[index], value(edit, index), plain);
            s.overwrite(r.start, r.end, r.text);
        }
        const next = s.toString();
        try {
            const check = (0, analyze_1.analyze)(next, file, options);
            if (check.entries.length !== analysis.entries.length)
                return null;
            for (const { edit, index } of targets) {
                const syntax = analysis.entries[index].syntax;
                const expected = syntax === 'number' ? asNumber(edit.to) : isMarkdown(index) ? (0, markdown_1.oneLine)(value(edit, index)) : edit.to;
                if (check.entries[index].text !== expected)
                    return null;
            }
            return next;
        }
        catch {
            return null;
        }
    };
    if (!targets.length)
        return { code, applied: [], conflicts };
    const next = attempt(false) ?? attempt(true) ?? attempt(false, true);
    if (next == null) {
        return { code, applied: [], conflicts: [...conflicts, ...targets.map((t) => ({ id: t.edit.id, reason: 'unwritable' }))] };
    }
    return { code: next, applied: targets.map((t) => t.edit.id), conflicts };
}
/** Sort edits by the file they belong to. The path always comes from our own manifest, never from the request. */
function groupEdits(files, edits) {
    const byKey = new Map(files.map((f) => [f.key, f.file]));
    const grouped = new Map();
    const unknown = [];
    for (const edit of edits) {
        const file = byKey.get(String(edit?.id).split('.')[0]);
        if (!file || typeof edit.from !== 'string' || typeof edit.to !== 'string') {
            unknown.push({ id: String(edit?.id), reason: 'unknown-id' });
            continue;
        }
        grouped.set(file, [...(grouped.get(file) ?? []), edit]);
    }
    return { grouped, unknown };
}
/** Dev-mode save: write the edits straight into the source files under `root`. */
function saveToDisk(root, edits) {
    const { grouped, unknown } = groupEdits((0, manifest_1.scanProject)(root), edits);
    const result = { saved: [], conflicts: [...unknown], files: [] };
    for (const [file, fileEdits] of grouped) {
        const full = node_path_1.default.join(root, file);
        const code = node_fs_1.default.readFileSync(full, 'utf8');
        const applied = applyEdits(code, file, fileEdits, { dataOnly: !/.(tsx|jsx)$/.test(file) });
        result.conflicts.push(...applied.conflicts);
        if (applied.applied.length && applied.code !== code) {
            node_fs_1.default.writeFileSync(full, applied.code);
            result.files.push(file);
        }
        result.saved.push(...applied.applied.map((id) => ({ id, file })));
    }
    return result;
}
