import fs from 'node:fs'
import path from 'node:path'
import { analyze, type FileAnalysis } from './analyze'

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage'])
const JSX_FILE = /\.(tsx|jsx)$/
const DATA_FILE = /\.(ts|js|mjs|md|mdx)$/i
/** Markdown about the repository itself, which is never page content. */
const REPO_DOCS = /^(readme|changelog|license|contributing|code_of_conduct|security|agents|claude)\.mdx?$/i
const NOT_CONTENT = /(\.d\.ts|\.config\.[cm]?[jt]s|\.(test|spec)\.[jt]sx?)$/
/** Folders whose JSON files hold translated or shared copy, by the conventions of the common i18n setups. */
const MESSAGE_DIRS = new Set(['messages', 'locales', 'locale', 'i18n', 'lang', 'translations', 'dictionaries'])
const MAX_MESSAGE_BYTES = 1024 * 1024

const cache = new Map<string, { stamp: string; analysis: FileAnalysis | null }>()

/**
 * `messages` is true once we are inside a message folder, where JSON files count.
 * `onlyMessages` is true under `public`, where nothing else is source.
 */
function* sourceFiles(dir: string, messages = false, onlyMessages = false): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'public') yield* sourceFiles(full, messages, true)
      else if (!SKIP_DIRS.has(entry.name)) yield* sourceFiles(full, messages || MESSAGE_DIRS.has(entry.name), onlyMessages)
    } else if (messages && /\.json$/i.test(entry.name)) {
      if (fs.statSync(full).size <= MAX_MESSAGE_BYTES) yield full
    } else if (!onlyMessages && (JSX_FILE.test(entry.name) || DATA_FILE.test(entry.name)) && !NOT_CONTENT.test(entry.name) && !REPO_DOCS.test(entry.name)) {
      yield full
    }
  }
}

/**
 * Analyze every source file under `root`. The analysis is deterministic, so the ids match
 * the ones the loader stamped as long as the files have not changed since they were compiled.
 */
export function scanProject(root: string): FileAnalysis[] {
  const out: FileAnalysis[] = []
  for (const full of sourceFiles(root)) {
    const stat = fs.statSync(full)
    const stamp = `${stat.mtimeMs}:${stat.size}`
    let hit = cache.get(full)
    if (!hit || hit.stamp !== stamp) {
      const file = path.relative(root, full).split(path.sep).join('/')
      let analysis: FileAnalysis | null = null
      try {
        analysis = analyze(fs.readFileSync(full, 'utf8'), file, { dataOnly: !JSX_FILE.test(full) })
      } catch {
        analysis = null
      }
      hit = { stamp, analysis }
      cache.set(full, hit)
    }
    if (hit.analysis && (hit.analysis.entries.length || hit.analysis.anchors.length)) out.push(hit.analysis)
  }
  return out
}

export interface ClientEntry {
  id: string
  kind: string
  syntax: string
  text: string
  anchored: boolean
  host?: boolean
  name?: string
  group?: string
  line: number
}

export interface ClientManifest {
  files: { key: string; file: string; hash: string; imports?: string[]; entries: ClientEntry[] }[]
}

/** What the editor in the browser needs: ids and text, no source offsets. */
export function clientManifest(files: FileAnalysis[]): ClientManifest {
  return {
    files: files.map((f) => ({
      key: f.key,
      file: f.file,
      hash: f.hash,
      imports: f.imports?.length ? f.imports : undefined,
      entries: f.entries.map(({ id, kind, syntax, text, anchored, host, name, group, line }) => ({ id, kind, syntax, text, anchored, host, name, group, line })),
    })),
  }
}

/** Where `next build` leaves the manifest for the deployed editor, relative to the project root. */
export const MANIFEST_FILE = '.torso/manifest.json'

export function writeBuildManifest(root: string): void {
  const target = path.join(root, MANIFEST_FILE)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(clientManifest(scanProject(root))))
}

let built: { stamp: number; manifest: ClientManifest } | null = null

/** The manifest written by the last build, or null when there is none. */
export function readBuildManifest(root: string): ClientManifest | null {
  const target = path.join(root, MANIFEST_FILE)
  try {
    const stamp = fs.statSync(target).mtimeMs
    if (!built || built.stamp !== stamp) built = { stamp, manifest: JSON.parse(fs.readFileSync(target, 'utf8')) }
    return built.manifest
  } catch {
    return null
  }
}
