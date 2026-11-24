/**
 * Where an editable string comes from.
 *
 * - text: literal JSX text (`<h1>Hello</h1>`)
 * - expr: string literal inside a JSX child expression (`{"Hello"}`, `{a ? "x" : "y"}`)
 * - href: literal `href` attribute
 * - prop: string literal passed as a prop to a component (`<Hero title="Hello" />`)
 * - data: string inside a module-scope constant (`const items = [{ title: "Hello" }]`)
 * - md: a run of text, or a front matter field, in a Markdown or MDX file
 */
export type EntryKind = 'text' | 'expr' | 'href' | 'prop' | 'data' | 'md';
/** How the string is written in the source, which decides how it is escaped on save. */
export type EntrySyntax = 'jsxText' | 'jsxAttr' | 'string' | 'template' | 'number' | 'markdown' | 'yaml';
export interface Entry {
    /** `<fileKey>.<ordinal>`: opaque, and stable across edits that only change text. */
    id: string;
    kind: EntryKind;
    syntax: EntrySyntax;
    /** The value as rendered (entities decoded, JSX whitespace collapsed). */
    text: string;
    /** Source range of the node, in UTF-16 offsets. */
    start: number;
    end: number;
    line: number;
    /** True when the id is stamped on an element, so the browser can find it exactly. */
    anchored: boolean;
    /**
     * True when that element is a plain HTML tag, so the id is certain to reach the page.
     * (An id passed to a component only arrives if the component forwards its props.)
     */
    host?: boolean;
    /** Prop or property name, when there is one. */
    name?: string;
    /**
     * Shared by every value of one object literal, e.g. a plan's name and its price.
     * A number is only trusted on the page when text from its own object is next to it.
     */
    group?: string;
}
/** An attribute insertion the loader performs on one JSX opening element. */
export interface Anchor {
    /** Offset right after the element name. */
    pos: number;
    textIds: string[];
    hrefId?: string;
    /** The element renders a non-literal expression, e.g. `<h3>{item.title}</h3>`. */
    dynamic: boolean;
}
export interface FileAnalysis {
    file: string;
    key: string;
    hash: string;
    /** Module specifiers this file imports, e.g. "@/lib/navigation". */
    imports?: string[];
    entries: Entry[];
    anchors: Anchor[];
}
export interface AnalyzeOptions {
    /** Only collect module-scope data strings (used for plain .ts/.js files). */
    dataOnly?: boolean;
}
export declare function fileKey(file: string): string;
export declare function hashSource(code: string): string;
/** React's JSX whitespace rule: lines are trimmed and joined with single spaces. */
export declare function cleanJSXText(value: string): string;
/** Message files (translations, dictionaries) are plain JSON: every string in them is content. */
export declare const isMessageFile: (file: string) => boolean;
export declare function analyze(code: string, file: string, options?: AnalyzeOptions): FileAnalysis;
/** The loader's transform: stamp ids on elements. Returns null when there is nothing to do. */
export declare function attributesFor(anchor: Anchor, key: string): string;
