"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMessageFile = void 0;
exports.fileKey = fileKey;
exports.hashSource = hashSource;
exports.cleanJSXText = cleanJSXText;
exports.analyze = analyze;
exports.attributesFor = attributesFor;
const node_crypto_1 = require("node:crypto");
const parser_1 = require("@babel/parser");
const markdown_1 = require("./markdown");
const SKIP_TEXT_IN = new Set(['script', 'style']);
const SKIP_PROPS = new Set([
    'className', 'class', 'id', 'key', 'style', 'href', 'src', 'type', 'variant', 'size',
    'rel', 'target', 'as', 'name', 'role', 'htmlFor', 'method', 'action', 'lang', 'dir',
]);
function fileKey(file) {
    const n = parseInt((0, node_crypto_1.createHash)('sha1').update(file).digest('hex').slice(0, 10), 16);
    return n.toString(36).padStart(8, '0').slice(-6);
}
function hashSource(code) {
    return (0, node_crypto_1.createHash)('sha1').update(code).digest('hex').slice(0, 16);
}
/** React's JSX whitespace rule: lines are trimmed and joined with single spaces. */
function cleanJSXText(value) {
    const lines = value.split(/\r\n|\n|\r/);
    let lastNonEmpty = 0;
    for (let i = 0; i < lines.length; i++)
        if (/[^ \t]/.test(lines[i]))
            lastNonEmpty = i;
    let out = '';
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/\t/g, ' ');
        if (i !== 0)
            line = line.replace(/^ +/, '');
        if (i !== lines.length - 1)
            line = line.replace(/ +$/, '');
        if (line) {
            if (i !== lastNonEmpty)
                line += ' ';
            out += line;
        }
    }
    return out;
}
function unwrap(node) {
    let n = node ?? null;
    while (n &&
        (n.type === 'TSAsExpression' ||
            n.type === 'TSSatisfiesExpression' ||
            n.type === 'TSNonNullExpression' ||
            n.type === 'TSTypeAssertion' ||
            n.type === 'ParenthesizedExpression')) {
        n = n.expression;
    }
    return n;
}
function staticString(node) {
    if (!node)
        return null;
    if (node.type === 'StringLiteral')
        return { text: node.value, syntax: 'string' };
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        const cooked = node.quasis[0].value.cooked;
        return cooked == null ? null : { text: cooked, syntax: 'template' };
    }
    return null;
}
/** String literals an expression can evaluate to: `a ? "x" : "y"`, `open && "Close"`. */
function literalLeaves(expr) {
    const n = unwrap(expr);
    if (!n)
        return [];
    if (staticString(n))
        return [n];
    if (n.type === 'ConditionalExpression') {
        return [...literalLeaves(n.consequent), ...literalLeaves(n.alternate)];
    }
    if (n.type === 'LogicalExpression') {
        const right = literalLeaves(n.right);
        return n.operator === '&&' ? right : [...literalLeaves(n.left), ...right];
    }
    return [];
}
function jsxName(name) {
    if (name.type === 'JSXIdentifier')
        return name.name;
    if (name.type === 'JSXMemberExpression')
        return `${jsxName(name.object)}.${name.property.name}`;
    if (name.type === 'JSXNamespacedName')
        return `${name.namespace.name}:${name.name.name}`;
    return '';
}
/** Message files (translations, dictionaries) are plain JSON: every string in them is content. */
const isMessageFile = (file) => /\.json$/i.test(file);
exports.isMessageFile = isMessageFile;
function analyze(code, file, options = {}) {
    const key = fileKey(file);
    if ((0, markdown_1.isMarkdownFile)(file)) {
        const entries = (0, markdown_1.analyzeMarkdown)(code, file).map((e, i) => ({ ...e, id: `${key}.${i.toString(36)}`, kind: 'md', anchored: false }));
        return { file, key, hash: hashSource(code), entries, anchors: [] };
    }
    const isJson = (0, exports.isMessageFile)(file);
    const isTsOnly = /\.[cm]?ts$/.test(file);
    const ast = isJson
        ? null
        : (0, parser_1.parse)(code, {
            sourceType: 'module',
            errorRecovery: true,
            plugins: isTsOnly ? ['typescript', 'decorators-legacy'] : ['typescript', 'jsx', 'decorators-legacy'],
        });
    const drafts = [];
    const anchorDrafts = [];
    const add = (node, kind, syntax, text, anchored, name, group) => {
        const d = {
            kind, syntax, text, anchored, name, group,
            start: node.start, end: node.end, line: node.loc?.start.line ?? 0,
        };
        drafts.push(d);
        return d;
    };
    function collectData(node, name, group) {
        const n = unwrap(node);
        if (!n)
            return;
        const s = staticString(n);
        if (s) {
            add(n, 'data', s.syntax, s.text, false, name, group);
            return;
        }
        // A number counts as content only as a named value of an object: { name: "Team", price: 29 }.
        if (n.type === 'NumericLiteral' && group && name && !isJson) {
            add(n, 'data', 'number', String(n.value), false, name, group);
            return;
        }
        if (n.type === 'ArrayExpression') {
            for (const el of n.elements)
                if (el && el.type !== 'SpreadElement')
                    collectData(el, name, group);
        }
        else if (n.type === 'ObjectExpression') {
            const own = `${key}@${n.start}`;
            for (const p of n.properties) {
                if (p.type !== 'ObjectProperty')
                    continue;
                const k = p.computed ? undefined : p.key.name ?? p.key.value;
                collectData(p.value, k == null ? name : String(k), own);
            }
        }
    }
    function element(node) {
        const opening = node.type === 'JSXElement' ? node.openingElement : null;
        const tag = opening ? jsxName(opening.name) : '';
        const isHost = !!opening && /^[a-z]/.test(tag) && !tag.includes('.');
        const canAnchor = !!opening && tag !== 'Fragment' && tag !== 'React.Fragment';
        const skipText = isHost && SKIP_TEXT_IN.has(tag);
        const text = [];
        let href;
        let dynamic = false;
        if (!skipText) {
            for (const child of node.children) {
                if (child.type === 'JSXText') {
                    const value = cleanJSXText(child.value);
                    if (value.trim())
                        text.push(add(child, 'text', 'jsxText', value, canAnchor));
                }
                else if (child.type === 'JSXExpressionContainer') {
                    const expr = child.expression;
                    if (expr.type === 'JSXEmptyExpression')
                        continue;
                    const leaves = literalLeaves(expr);
                    for (const leaf of leaves) {
                        const s = staticString(leaf);
                        text.push(add(leaf, 'expr', s.syntax, s.text, canAnchor && !!s.text.trim()));
                    }
                    if (!staticString(unwrap(expr)))
                        dynamic = true;
                }
            }
        }
        if (opening) {
            for (const attr of opening.attributes) {
                if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier' || !attr.value)
                    continue;
                const name = attr.name.name;
                let valueNode = null;
                let syntax = 'jsxAttr';
                let value = '';
                if (attr.value.type === 'StringLiteral') {
                    valueNode = attr.value;
                    value = attr.value.value;
                }
                else if (attr.value.type === 'JSXExpressionContainer') {
                    const inner = unwrap(attr.value.expression);
                    const s = staticString(inner);
                    if (s) {
                        valueNode = inner;
                        syntax = s.syntax;
                        value = s.text;
                    }
                }
                if (!valueNode)
                    continue;
                if (name === 'href') {
                    href = add(valueNode, 'href', syntax, value, canAnchor, name);
                }
                else if (!isHost && !SKIP_PROPS.has(name) && !name.startsWith('data-') && !name.startsWith('aria-')) {
                    add(valueNode, 'prop', syntax, value, false, name);
                }
            }
        }
        if (isHost)
            for (const d of href ? [...text, href] : text)
                d.host = d.anchored;
        // A link's address and its words, written on one element, belong together: when the id
        // does not reach the page (a component swallowed it), finding both identifies the link.
        if (href && text.length)
            for (const d of [...text, href])
                d.group = `${key}@${node.start}`;
        if (opening && canAnchor && (text.length || href || (dynamic && isHost))) {
            const after = opening.typeArguments ?? opening.typeParameters ?? opening.name;
            anchorDrafts.push({ pos: after.end, text, href, dynamic: dynamic && isHost });
        }
    }
    function walk(node, topLevel) {
        if (!node || typeof node.type !== 'string')
            return;
        if (node.type === 'JSXElement' || node.type === 'JSXFragment')
            element(node);
        if (topLevel) {
            const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
            if (decl?.type === 'VariableDeclaration' && decl.kind === 'const') {
                for (const d of decl.declarations) {
                    const name = d.id?.type === 'Identifier' ? d.id.name : undefined;
                    collectData(d.init, name);
                }
            }
        }
        for (const k in node) {
            if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments')
                continue;
            const v = node[k];
            if (Array.isArray(v))
                for (const c of v)
                    walk(c, false);
            else if (v && typeof v === 'object' && typeof v.type === 'string')
                walk(v, false);
        }
    }
    if (isJson)
        collectData((0, parser_1.parseExpression)(code, { errorRecovery: false }));
    const imports = [];
    for (const stmt of (ast?.program.body ?? [])) {
        if (stmt.type === 'ImportDeclaration' && stmt.importKind !== 'type')
            imports.push(String(stmt.source.value));
        if (options.dataOnly) {
            const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
            if (decl?.type === 'VariableDeclaration' && decl.kind === 'const') {
                for (const d of decl.declarations)
                    collectData(d.init, d.id?.type === 'Identifier' ? d.id.name : undefined);
            }
        }
        else {
            walk(stmt, true);
        }
    }
    drafts.sort((a, b) => a.start - b.start);
    drafts.forEach((d, i) => (d.id = `${key}.${i.toString(36)}`));
    const anchors = anchorDrafts
        .map((a) => ({
        pos: a.pos,
        textIds: a.text.filter((d) => d.anchored).map((d) => d.id),
        hrefId: a.href?.anchored ? a.href.id : undefined,
        dynamic: a.dynamic,
    }))
        .sort((a, b) => a.pos - b.pos);
    return { file, key, hash: hashSource(code), imports, entries: drafts, anchors };
}
/** The loader's transform: stamp ids on elements. Returns null when there is nothing to do. */
function attributesFor(anchor, key) {
    let out = '';
    if (anchor.textIds.length)
        out += ` data-cms="${anchor.textIds.join(' ')}"`;
    if (anchor.hrefId)
        out += ` data-cms-href="${anchor.hrefId}"`;
    if (anchor.dynamic)
        out += ` data-cms-x="${key}"`;
    return out;
}
