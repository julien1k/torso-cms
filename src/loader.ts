import path from 'node:path'
import MagicString from 'magic-string'
import { analyze, attributesFor } from './analyze'

export function relativeFile(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

/** Stamp opaque ids on JSX elements. The source file on disk is never touched. */
export function transform(code: string, file: string): { code: string; map: any } | null {
  const analysis = analyze(code, file)
  if (!analysis.anchors.length) return null
  const s = new MagicString(code)
  for (const anchor of analysis.anchors) {
    const attrs = attributesFor(anchor, analysis.key)
    if (attrs) s.appendLeft(anchor.pos, attrs)
  }
  return { code: s.toString(), map: s.generateMap({ hires: true, source: file, includeContent: true }) }
}

/** webpack / Turbopack loader. */
export default function torsoLoader(this: any, source: string, inputMap: any) {
  const callback = this.async()
  const resource: string = this.resourcePath
  if (/[\\/]node_modules[\\/]/.test(resource) || !/\.(tsx|jsx)$/.test(resource)) {
    return callback(null, source, inputMap)
  }
  try {
    const options = (typeof this.getOptions === 'function' ? this.getOptions() : {}) || {}
    const root: string = options.root || this.rootContext || process.cwd()
    const result = transform(source, relativeFile(root, resource))
    if (!result) return callback(null, source, inputMap)
    // Only hand over our map when we are first in the chain; otherwise keep the incoming one.
    callback(null, result.code, inputMap ?? result.map)
  } catch {
    // A file we cannot parse is simply not editable. Never break the build.
    callback(null, source, inputMap)
  }
}
