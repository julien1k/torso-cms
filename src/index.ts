import path from 'node:path'
import { MANIFEST_FILE, writeBuildManifest } from './manifest'

export interface CMSOptions {
  /** Project root. Defaults to the directory `next` is run from. */
  root?: string
}

type Config = Record<string, any>
type ConfigInput<T> = T | ((phase: string, ctx: any) => T | Promise<T>)

const EXTENSIONS = ['tsx', 'jsx']

/**
 * Wrap a Next.js config so static text and links carry an opaque id in the rendered HTML.
 * Works with both Turbopack (`turbopack.rules`) and webpack.
 *
 * During `next build` it also records where every editable string lives, so the deployed
 * editor can map the page back to the repository without having the source files.
 */
export function withCMS<T extends Config>(nextConfig: ConfigInput<T> = {} as T, options: CMSOptions = {}) {
  return async (phase: string, ctx: any): Promise<T> => {
    const config: T = typeof nextConfig === 'function' ? await nextConfig(phase, ctx) : nextConfig
    const root = options.root ?? process.cwd()
    if (phase === 'phase-production-build') writeBuildManifest(root)

    const loader = path.join(__dirname, 'loader.js')
    const use = { loader, options: { root } }

    const rules: Record<string, any> = { ...(config.turbopack?.rules ?? {}) }
    for (const ext of EXTENSIONS) {
      const glob = `*.${ext}`
      const ours = { condition: { not: 'foreign' }, loaders: [use] }
      const existing = rules[glob]
      rules[glob] = existing ? [...(Array.isArray(existing) ? existing : [existing]), ours] : ours
    }

    const external = new Set<string>([...(config.serverExternalPackages ?? []), 'torso-cms'])
    const includes: Record<string, string[]> = { ...(config.outputFileTracingIncludes ?? {}) }
    includes['/*'] = [...(includes['/*'] ?? []), `./${MANIFEST_FILE}`]

    return {
      ...config,
      serverExternalPackages: [...external],
      outputFileTracingIncludes: includes,
      turbopack: { ...(config.turbopack ?? {}), rules },
      webpack(webpackConfig: any, webpackCtx: any) {
        webpackConfig.module.rules.unshift({
          test: /\.(tsx|jsx)$/,
          exclude: /node_modules/,
          enforce: 'pre',
          use: [use],
        })
        return typeof config.webpack === 'function' ? config.webpack(webpackConfig, webpackCtx) : webpackConfig
      },
    }
  }
}

export default withCMS
