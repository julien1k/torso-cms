import fs from 'node:fs'
import path from 'node:path'
import MagicString from 'magic-string'
import { analyze, isMessageFile, type Entry } from './analyze'
import { escapeMarkdown, oneLine, yamlString } from './markdown'
import { scanProject } from './manifest'

export interface Edit {
  id: string
  /** The text the editor started from, exactly as the manifest reported it. */
  from: string
  to: string
}

export type ConflictReason = 'unknown-id' | 'changed' | 'unsafe-url' | 'unwritable' | 'not-a-number' | 'placeholder-syntax'

export interface SaveResult {
  saved: { id: string; file: string }[]
  conflicts: { id: string; reason: ConflictReason }[]
  files: string[]
}

const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi
const UNSAFE_URL = /^\s*(javascript|data|vbscript)\s*:/i
const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/
/** What a source number reads back as, e.g. "29.50" is stored and shown as 29.5. */
const asNumber = (value: string) => String(Number(value))

function quoted(value: string, quote: string): string {
  const inner = JSON.stringify(value).slice(1, -1)
  if (quote === '"') return `"${inner}"`
  return `'${inner.replace(/\\.|'/g, (m) => (m === '\\"' ? '"' : m === "'" ? "\\'" : m))}'`
}

function template(value: string): string {
  return '`' + value.replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${') + '`'
}

function jsxTextEscape(value: string): string {
  return value
    .replace(ENTITY, '&amp;$1;')
    .replace(/[{}<>\u00a0]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;', '\u00a0': '&nbsp;' })[c]!)
}

interface Replacement {
  start: number
  end: number
  text: string
}

/** Work out the exact source replacement for one entry. `plain` avoids JSX text syntax entirely. */
export function replacementFor(code: string, entry: Entry, to: string, plain = false): Replacement {
  const { start, end } = entry
  switch (entry.syntax) {
    case 'number':
      return { start, end, text: asNumber(to) }
    case 'markdown':
      return { start, end, text: escapeMarkdown(to) }
    case 'yaml':
      return { start, end, text: yamlString(to) }
    case 'string':
      return { start, end, text: quoted(to, code[start] === "'" ? "'" : '"') }
    case 'template':
      return { start, end, text: template(to) }
    case 'jsxAttr': {
      const quote = code[start] === "'" ? "'" : '"'
      if (plain || /[\r\n\t\\]/.test(to)) return { start, end, text: `{${JSON.stringify(to)}}` }
      const body = to.replace(ENTITY, '&amp;$1;').replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&apos;')
      return { start, end, text: quote + body + quote }
    }
    case 'jsxText': {
      // Indentation around the text is not content: keep it, and replace only what renders.
      const raw = code.slice(start, end)
      const lead = /^[ \t\r\n]*/.exec(raw)![0]
      const trail = /[ \t\r\n]*$/.exec(raw.slice(lead.length))![0]
      const leadBreak = /[\r\n]/.test(lead)
      const trailBreak = /[\r\n]/.test(trail)
      const from = leadBreak ? start + lead.length : start
      const until = trailBreak ? end - trail.length : end
      const [, newLead, core, newTrail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(to)!
      // JSX drops whitespace next to a line break, so edge spaces there need a string literal.
      const edgeLost = (newLead && leadBreak) || (newTrail && trailBreak)
      if (plain || !core || edgeLost || /[\r\n\t]/.test(to)) {
        return { start: from, end: until, text: `{${JSON.stringify(to)}}` }
      }
      return { start: from, end: until, text: newLead + jsxTextEscape(core) + newTrail }
    }
  }
}

export interface ApplyResult {
  code: string
  applied: string[]
  conflicts: { id: string; reason: ConflictReason }[]
}

/**
 * Apply edits to one file's source. Each edit is checked against the current source first,
 * and the result is re-parsed to prove every edited string now reads back as intended.
 */
export function applyEdits(code: string, file: string, edits: Edit[], options: { dataOnly?: boolean } = {}): ApplyResult {
  const analysis = analyze(code, file, options)
  const conflicts: ApplyResult['conflicts'] = []
  const targets: { edit: Edit; index: number }[] = []
  const taken = new Set<number>()

  for (const edit of edits) {
    let index = analysis.entries.findIndex((e) => e.id === edit.id)
    if (index < 0 || analysis.entries[index].text !== edit.from) {
      // The file moved under the editor. Follow the string if it is still unambiguous.
      const same = analysis.entries.map((e, i) => (e.text === edit.from ? i : -1)).filter((i) => i >= 0)
      index = same.length === 1 ? same[0] : -1
    }
    if (index < 0 || taken.has(index)) {
      conflicts.push({ id: edit.id, reason: 'changed' })
      continue
    }
    const entry = analysis.entries[index]
    if ((entry.kind === 'href' || entry.name === 'href') && UNSAFE_URL.test(edit.to)) {
      conflicts.push({ id: edit.id, reason: 'unsafe-url' })
      continue
    }
    if (entry.syntax === 'number' && !PLAIN_NUMBER.test(edit.to)) {
      conflicts.push({ id: edit.id, reason: 'not-a-number' })
      continue
    }
    // In message files braces start a placeholder, so a stray one would break the page at runtime.
    if (isMessageFile(file) && /[{}]/.test(edit.to) && !/[{}]/.test(entry.text)) {
      conflicts.push({ id: edit.id, reason: 'placeholder-syntax' })
      continue
    }
    taken.add(index)
    targets.push({ edit, index })
  }

  const isMarkdown = (index: number) => analysis.entries[index].syntax === 'markdown' || analysis.entries[index].syntax === 'yaml'
  // Markdown drops spaces at the edge of a block, so as a last resort the edge spaces are given up.
  const attempt = (plain: boolean, trim = false): string | null => {
    const value = (edit: Edit, index: number) => (trim && isMarkdown(index) ? edit.to.trim() : edit.to)
    const s = new MagicString(code)
    for (const { edit, index } of targets) {
      const r = replacementFor(code, analysis.entries[index], value(edit, index), plain)
      s.overwrite(r.start, r.end, r.text)
    }
    const next = s.toString()
    try {
      const check = analyze(next, file, options)
      if (check.entries.length !== analysis.entries.length) return null
      for (const { edit, index } of targets) {
        const syntax = analysis.entries[index].syntax
        const expected =
          syntax === 'number' ? asNumber(edit.to) : isMarkdown(index) ? oneLine(value(edit, index)) : edit.to
        if (check.entries[index].text !== expected) return null
      }
      return next
    } catch {
      return null
    }
  }

  if (!targets.length) return { code, applied: [], conflicts }
  const next = attempt(false) ?? attempt(true) ?? attempt(false, true)
  if (next == null) {
    return { code, applied: [], conflicts: [...conflicts, ...targets.map((t) => ({ id: t.edit.id, reason: 'unwritable' as const }))] }
  }
  return { code: next, applied: targets.map((t) => t.edit.id), conflicts }
}

/** Sort edits by the file they belong to. The path always comes from our own manifest, never from the request. */
export function groupEdits(files: { key: string; file: string }[], edits: Edit[]) {
  const byKey = new Map(files.map((f) => [f.key, f.file]))
  const grouped = new Map<string, Edit[]>()
  const unknown: { id: string; reason: ConflictReason }[] = []
  for (const edit of edits) {
    const file = byKey.get(String(edit?.id).split('.')[0])
    if (!file || typeof edit.from !== 'string' || typeof edit.to !== 'string') {
      unknown.push({ id: String(edit?.id), reason: 'unknown-id' })
      continue
    }
    grouped.set(file, [...(grouped.get(file) ?? []), edit])
  }
  return { grouped, unknown }
}

/** Dev-mode save: write the edits straight into the source files under `root`. */
export function saveToDisk(root: string, edits: Edit[]): SaveResult {
  const { grouped, unknown } = groupEdits(scanProject(root), edits)
  const result: SaveResult = { saved: [], conflicts: [...unknown], files: [] }
  for (const [file, fileEdits] of grouped) {
    const full = path.join(root, file)
    const code = fs.readFileSync(full, 'utf8')
    const applied = applyEdits(code, file, fileEdits, { dataOnly: !/.(tsx|jsx)$/.test(file) })
    result.conflicts.push(...applied.conflicts)
    if (applied.applied.length && applied.code !== code) {
      fs.writeFileSync(full, applied.code)
      result.files.push(file)
    }
    result.saved.push(...applied.applied.map((id) => ({ id, file })))
  }
  return result
}
