import { createHash } from 'node:crypto'
import { parse, parseExpression } from '@babel/parser'
import { analyzeMarkdown, isMarkdownFile } from './markdown'

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
export type EntryKind = 'text' | 'expr' | 'href' | 'prop' | 'data' | 'md'

/** How the string is written in the source, which decides how it is escaped on save. */
export type EntrySyntax = 'jsxText' | 'jsxAttr' | 'string' | 'template' | 'number' | 'markdown' | 'yaml'

export interface Entry {
  /** `<fileKey>.<ordinal>`: opaque, and stable across edits that only change text. */
  id: string
  kind: EntryKind
  syntax: EntrySyntax
  /** The value as rendered (entities decoded, JSX whitespace collapsed). */
  text: string
  /** Source range of the node, in UTF-16 offsets. */
  start: number
  end: number
  line: number
  /** True when the id is stamped on an element, so the browser can find it exactly. */
  anchored: boolean
  /**
   * True when that element is a plain HTML tag, so the id is certain to reach the page.
   * (An id passed to a component only arrives if the component forwards its props.)
   */
  host?: boolean
  /** Prop or property name, when there is one. */
  name?: string
  /**
   * Shared by every value of one object literal, e.g. a plan's name and its price.
   * A number is only trusted on the page when text from its own object is next to it.
   */
  group?: string
}

/** An attribute insertion the loader performs on one JSX opening element. */
export interface Anchor {
  /** Offset right after the element name. */
  pos: number
  textIds: string[]
  hrefId?: string
  /** The element renders a non-literal expression, e.g. `<h3>{item.title}</h3>`. */
  dynamic: boolean
}

export interface FileAnalysis {
  file: string
  key: string
  hash: string
  /** Module specifiers this file imports, e.g. "@/lib/navigation". */
  imports?: string[]
  entries: Entry[]
  anchors: Anchor[]
}

export interface AnalyzeOptions {
  /** Only collect module-scope data strings (used for plain .ts/.js files). */
  dataOnly?: boolean
}

type Node = { type: string; start: number; end: number; loc?: { start: { line: number } }; [k: string]: any }

const SKIP_TEXT_IN = new Set(['script', 'style'])
const SKIP_PROPS = new Set([
  'className', 'class', 'id', 'key', 'style', 'href', 'src', 'type', 'variant', 'size',
  'rel', 'target', 'as', 'name', 'role', 'htmlFor', 'method', 'action', 'lang', 'dir',
])

export function fileKey(file: string): string {
  const n = parseInt(createHash('sha1').update(file).digest('hex').slice(0, 10), 16)
  return n.toString(36).padStart(8, '0').slice(-6)
}

export function hashSource(code: string): string {
  return createHash('sha1').update(code).digest('hex').slice(0, 16)
}

/** React's JSX whitespace rule: lines are trimmed and joined with single spaces. */
export function cleanJSXText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, ' ')
    if (i !== 0) line = line.replace(/^ +/, '')
    if (i !== lines.length - 1) line = line.replace(/ +$/, '')
    if (line) {
      if (i !== lastNonEmpty) line += ' '
      out += line
    }
  }
  return out
}

function unwrap(node: Node | null | undefined): Node | null {
  let n = node ?? null
  while (
    n &&
    (n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'TSNonNullExpression' ||
      n.type === 'TSTypeAssertion' ||
      n.type === 'ParenthesizedExpression')
  ) {
    n = n.expression
  }
  return n
}

function staticString(node: Node | null): { text: string; syntax: EntrySyntax } | null {
  if (!node) return null
  if (node.type === 'StringLiteral') return { text: node.value, syntax: 'string' }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const cooked = node.quasis[0].value.cooked
    return cooked == null ? null : { text: cooked, syntax: 'template' }
  }
  return null
}

/** String literals an expression can evaluate to: `a ? "x" : "y"`, `open && "Close"`. */
function literalLeaves(expr: Node | null): Node[] {
  const n = unwrap(expr)
  if (!n) return []
  if (staticString(n)) return [n]
  if (n.type === 'ConditionalExpression') {
    return [...literalLeaves(n.consequent), ...literalLeaves(n.alternate)]
  }
  if (n.type === 'LogicalExpression') {
    const right = literalLeaves(n.right)
    return n.operator === '&&' ? right : [...literalLeaves(n.left), ...right]
  }
  return []
}

function jsxName(name: Node): string {
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${name.property.name}`
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`
  return ''
}

/** Message files (translations, dictionaries) are plain JSON: every string in them is content. */
export const isMessageFile = (file: string) => /\.json$/i.test(file)

export function analyze(code: string, file: string, options: AnalyzeOptions = {}): FileAnalysis {
  const key = fileKey(file)
  if (isMarkdownFile(file)) {
    const entries = analyzeMarkdown(code, file).map((e, i) => ({ ...e, id: `${key}.${i.toString(36)}`, kind: 'md' as const, anchored: false }))
    return { file, key, hash: hashSource(code), entries, anchors: [] }
  }
  const isJson = isMessageFile(file)
  const isTsOnly = /\.[cm]?ts$/.test(file)
  const ast = isJson
    ? null
    : (parse(code, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: isTsOnly ? ['typescript', 'decorators-legacy'] : ['typescript', 'jsx', 'decorators-legacy'],
      }) as unknown as { program: Node })

  type Draft = Omit<Entry, 'id'> & { id?: string }
  const drafts: Draft[] = []
  const anchorDrafts: { pos: number; text: Draft[]; href?: Draft; dynamic: boolean }[] = []

  const add = (node: Node, kind: EntryKind, syntax: EntrySyntax, text: string, anchored: boolean, name?: string, group?: string) => {
    const d: Draft = {
      kind, syntax, text, anchored, name, group,
      start: node.start, end: node.end, line: node.loc?.start.line ?? 0,
    }
    drafts.push(d)
    return d
  }

  function collectData(node: Node | null, name?: string, group?: string) {
    const n = unwrap(node)
    if (!n) return
    const s = staticString(n)
    if (s) {
      add(n, 'data', s.syntax, s.text, false, name, group)
      return
    }
    // A number counts as content only as a named value of an object: { name: "Team", price: 29 }.
    if (n.type === 'NumericLiteral' && group && name && !isJson) {
      add(n, 'data', 'number', String(n.value), false, name, group)
      return
    }
    if (n.type === 'ArrayExpression') {
      for (const el of n.elements) if (el && el.type !== 'SpreadElement') collectData(el, name, group)
    } else if (n.type === 'ObjectExpression') {
      const own = `${key}@${n.start}`
      for (const p of n.properties) {
        if (p.type !== 'ObjectProperty') continue
        const k = p.computed ? undefined : p.key.name ?? p.key.value
        collectData(p.value, k == null ? name : String(k), own)
      }
    }
  }

  function element(node: Node) {
    const opening: Node | null = node.type === 'JSXElement' ? node.openingElement : null
    const tag = opening ? jsxName(opening.name) : ''
    const isHost = !!opening && /^[a-z]/.test(tag) && !tag.includes('.')
    const canAnchor = !!opening && tag !== 'Fragment' && tag !== 'React.Fragment'
    const skipText = isHost && SKIP_TEXT_IN.has(tag)

    const text: Draft[] = []
    let href: Draft | undefined
    let dynamic = false

    if (!skipText) {
      for (const child of node.children as Node[]) {
        if (child.type === 'JSXText') {
          const value = cleanJSXText(child.value)
          if (value.trim()) text.push(add(child, 'text', 'jsxText', value, canAnchor))
        } else if (child.type === 'JSXExpressionContainer') {
          const expr: Node = child.expression
          if (expr.type === 'JSXEmptyExpression') continue
          const leaves = literalLeaves(expr)
          for (const leaf of leaves) {
            const s = staticString(leaf)!
            text.push(add(leaf, 'expr', s.syntax, s.text, canAnchor && !!s.text.trim()))
          }
          if (!staticString(unwrap(expr))) dynamic = true
        }
      }
    }

    if (opening) {
      for (const attr of opening.attributes as Node[]) {
        if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier' || !attr.value) continue
        const name: string = attr.name.name
        let valueNode: Node | null = null
        let syntax: EntrySyntax = 'jsxAttr'
        let value = ''
        if (attr.value.type === 'StringLiteral') {
          valueNode = attr.value
          value = attr.value.value
        } else if (attr.value.type === 'JSXExpressionContainer') {
          const inner = unwrap(attr.value.expression)
          const s = staticString(inner)
          if (s) {
            valueNode = inner
            syntax = s.syntax
            value = s.text
          }
        }
        if (!valueNode) continue
        if (name === 'href') {
          href = add(valueNode, 'href', syntax, value, canAnchor, name)
        } else if (!isHost && !SKIP_PROPS.has(name) && !name.startsWith('data-') && !name.startsWith('aria-')) {
          add(valueNode, 'prop', syntax, value, false, name)
        }
      }
    }

    if (isHost) for (const d of href ? [...text, href] : text) d.host = d.anchored
    // A link's address and its words, written on one element, belong together: when the id
    // does not reach the page (a component swallowed it), finding both identifies the link.
    if (href && text.length) for (const d of [...text, href]) d.group = `${key}@${node.start}`

    if (opening && canAnchor && (text.length || href || (dynamic && isHost))) {
      const after: Node = opening.typeArguments ?? opening.typeParameters ?? opening.name
      anchorDrafts.push({ pos: after.end, text, href, dynamic: dynamic && isHost })
    }
  }

  function walk(node: any, topLevel: boolean) {
    if (!node || typeof node.type !== 'string') return
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') element(node)

    if (topLevel) {
      const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node
      if (decl?.type === 'VariableDeclaration' && decl.kind === 'const') {
        for (const d of decl.declarations) {
          const name = d.id?.type === 'Identifier' ? d.id.name : undefined
          collectData(d.init, name)
        }
      }
    }

    for (const k in node) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue
      const v = node[k]
      if (Array.isArray(v)) for (const c of v) walk(c, false)
      else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, false)
    }
  }

  if (isJson) collectData(parseExpression(code, { errorRecovery: false }) as unknown as Node)
  const imports: string[] = []
  for (const stmt of (ast?.program.body ?? []) as Node[]) {
    if (stmt.type === 'ImportDeclaration' && stmt.importKind !== 'type') imports.push(String(stmt.source.value))
    if (options.dataOnly) {
      const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt
      if (decl?.type === 'VariableDeclaration' && decl.kind === 'const') {
        for (const d of decl.declarations) collectData(d.init, d.id?.type === 'Identifier' ? d.id.name : undefined)
      }
    } else {
      walk(stmt, true)
    }
  }

  drafts.sort((a, b) => a.start - b.start)
  drafts.forEach((d, i) => (d.id = `${key}.${i.toString(36)}`))

  const anchors: Anchor[] = anchorDrafts
    .map((a) => ({
      pos: a.pos,
      textIds: a.text.filter((d) => d.anchored).map((d) => d.id!),
      hrefId: a.href?.anchored ? a.href.id : undefined,
      dynamic: a.dynamic,
    }))
    .sort((a, b) => a.pos - b.pos)

  return { file, key, hash: hashSource(code), imports, entries: drafts as Entry[], anchors }
}

/** The loader's transform: stamp ids on elements. Returns null when there is nothing to do. */
export function attributesFor(anchor: Anchor, key: string): string {
  let out = ''
  if (anchor.textIds.length) out += ` data-cms="${anchor.textIds.join(' ')}"`
  if (anchor.hrefId) out += ` data-cms-href="${anchor.hrefId}"`
  if (anchor.dynamic) out += ` data-cms-x="${key}"`
  return out
}
