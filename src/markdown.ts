/**
 * Markdown and MDX as a source of editable text.
 *
 * A Markdown file reaches the page through some renderer we know nothing about, so there
 * are no ids to stamp. What we can rely on: every run of plain text in the file becomes a
 * text node on the page. This module lists those runs with their exact source positions,
 * plus the simple string fields of YAML front matter (a title is often shown as a heading).
 */

export interface MarkdownEntry {
  syntax: 'markdown' | 'yaml'
  /** The text as rendered: escapes and entities resolved. */
  text: string
  start: number
  end: number
  line: number
  name?: string
}

export const isMarkdownFile = (file: string) => /\.mdx?$/i.test(file)

type MdNode = {
  type: string
  value?: string
  children?: MdNode[]
  position?: { start: { offset: number; line: number }; end: { offset: number } }
}

let parser: ((code: string, mdx: boolean) => MdNode) | null = null

/**
 * The parser packages are ES modules. They are loaded on first use, so projects without
 * any Markdown never pay for them (and the build loader never touches them).
 */
function parse(code: string, mdx: boolean): MdNode {
  if (!parser) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { fromMarkdown } = require('mdast-util-from-markdown')
    const { mdxjs } = require('micromark-extension-mdxjs')
    const { mdxFromMarkdown } = require('mdast-util-mdx')
    const { gfm } = require('micromark-extension-gfm')
    const { gfmFromMarkdown } = require('mdast-util-gfm')
    const { frontmatter } = require('micromark-extension-frontmatter')
    const { frontmatterFromMarkdown } = require('mdast-util-frontmatter')
    /* eslint-enable @typescript-eslint/no-require-imports */
    parser = (source, asMdx) =>
      fromMarkdown(source, {
        extensions: [frontmatter(['yaml']), gfm(), ...(asMdx ? [mdxjs()] : [])],
        mdastExtensions: [frontmatterFromMarkdown(['yaml']), gfmFromMarkdown(), ...(asMdx ? [mdxFromMarkdown()] : [])],
      })
  }
  return parser(code, mdx)
}

/** YAML values that are not text: numbers, dates, booleans, null, and anything structured. */
const NOT_A_STRING = /^(true|false|yes|no|on|off|null|~|[-+]?[\d.][\d._:eE+-]*|\d{4}-\d{2}-\d{2}.*)$/i
const STRUCTURED = /^[[{>|*&!%@`]/

/** Top-level `key: value` lines whose value is a single-line string. */
function frontMatter(code: string, node: MdNode, out: MarkdownEntry[]) {
  const from = node.position!.start.offset
  const raw = code.slice(from, node.position!.end.offset)
  let offset = from
  let line = node.position!.start.line
  for (const text of raw.split('\n')) {
    const match = /^([A-Za-z_][\w-]*):[ \t]+(\S.*?)[ \t\r]*$/.exec(text)
    if (match) {
      const [, name, value] = match
      const start = offset + text.indexOf(value, name.length + 1)
      let decoded: string | null = null
      if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
        try {
          decoded = JSON.parse(value)
        } catch {
          decoded = null
        }
      } else if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
        decoded = value.slice(1, -1).replace(/''/g, "'")
      } else if (!STRUCTURED.test(value) && !NOT_A_STRING.test(value) && !/\s#/.test(value) && !/:\s/.test(value) && !value.endsWith(':')) {
        decoded = value
      }
      if (typeof decoded === 'string' && decoded.trim()) {
        out.push({ syntax: 'yaml', text: decoded, start, end: start + value.length, line, name })
      }
    }
    offset += text.length + 1
    line++
  }
}

export function analyzeMarkdown(code: string, file: string): MarkdownEntry[] {
  const tree = parse(code, /\.mdx$/i.test(file))
  const out: MarkdownEntry[] = []
  const walk = (node: MdNode) => {
    if (node.type === 'yaml' && node.position) {
      frontMatter(code, node, out)
    } else if (node.type === 'text' && node.position && node.value && node.value.trim()) {
      out.push({
        syntax: 'markdown',
        text: node.value,
        start: node.position.start.offset,
        end: node.position.end.offset,
        line: node.position.start.line,
      })
    }
    // Code, raw HTML, and MDX expressions or imports are not text and have no text children.
    for (const child of node.children ?? []) walk(child)
  }
  walk(tree)
  return out
}

/** A line break cannot live inside one run of text: Markdown would start a new block. */
export const oneLine = (value: string) => value.replace(/\s*[\r\n]+\s*/g, ' ')

/**
 * Write text so Markdown (and MDX) reads it back as exactly that text and nothing else.
 * Every character that could begin markup gets a backslash, which both formats accept
 * before any punctuation.
 */
export function escapeMarkdown(value: string): string {
  return oneLine(value)
    .replace(/[\\`*_[\]<>{}~|#&!]/g, '\\$&')
    // At the start of a block these would begin a list, a rule, a heading underline or a quote.
    .replace(/^(\s*)([-+=])/, '$1\\$2')
    .replace(/^(\s*\d+)([.)])/, '$1\\$2')
    // A bare address would become a link, splitting the run in two.
    .replace(/(https?|ftp):\/\//gi, '$1\\://')
    .replace(/www\./gi, 'www\\.')
    .replace(/@(?=\S)/g, '\\@')
}

/** A YAML scalar that any value survives: double quotes use the same escapes as JSON. */
export const yamlString = (value: string) => JSON.stringify(oneLine(value))
