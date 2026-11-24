/**
 * Markdown and MDX as a source of editable text.
 *
 * A Markdown file reaches the page through some renderer we know nothing about, so there
 * are no ids to stamp. What we can rely on: every run of plain text in the file becomes a
 * text node on the page. This module lists those runs with their exact source positions,
 * plus the simple string fields of YAML front matter (a title is often shown as a heading).
 */
export interface MarkdownEntry {
    syntax: 'markdown' | 'yaml';
    /** The text as rendered: escapes and entities resolved. */
    text: string;
    start: number;
    end: number;
    line: number;
    name?: string;
}
export declare const isMarkdownFile: (file: string) => boolean;
export declare function analyzeMarkdown(code: string, file: string): MarkdownEntry[];
/** A line break cannot live inside one run of text: Markdown would start a new block. */
export declare const oneLine: (value: string) => string;
/**
 * Write text so Markdown (and MDX) reads it back as exactly that text and nothing else.
 * Every character that could begin markup gets a backslash, which both formats accept
 * before any punctuation.
 */
export declare function escapeMarkdown(value: string): string;
/** A YAML scalar that any value survives: double quotes use the same escapes as JSON. */
export declare const yamlString: (value: string) => string;
