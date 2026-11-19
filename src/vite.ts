import { relativeFile, transform } from './loader'
import { writeBuildManifest } from './manifest'
import { createCMS, type CreateCMSOptions } from './server'

export interface TorsoViteOptions extends CreateCMSOptions {
  /** Where the editor lives on the dev server. Defaults to `/edit`. */
  editPath?: string
}

/**
 * Torso for React apps built with Vite (plain Vite, vinext, React Router, TanStack Start).
 *
 *   // vite.config.ts
 *   import { torso } from "torso-cms/vite";
 *   export default defineConfig({ plugins: [torso(), react()] });
 *
 * It stamps ids on JSX the same way the Next.js integration does, writes the manifest
 * during `vite build`, and in development serves the editor straight from the dev server,
 * so no route file is needed to try it.
 *
 * In production the editor needs a server route. Frameworks with fetch-style handlers can
 * mount `createCMS()` from `torso-cms/server` themselves; a static single-page app has
 * nowhere to run it.
 */
export function torso(options: TorsoViteOptions = {}): any {
  const base = (options.editPath ?? '/edit').replace(/\/+$/, '')
  let root = options.root ?? process.cwd()
  let building = false

  return {
    name: 'torso-cms',
    enforce: 'pre',

    configResolved(config: { root: string; command: string }) {
      root = options.root ?? config.root
      building = config.command === 'build'
    },

    buildStart() {
      if (building) writeBuildManifest(root)
    },

    transform(code: string, id: string) {
      const file = id.split('?')[0]
      if (!/\.(tsx|jsx)$/.test(file) || /[\\/]node_modules[\\/]/.test(file)) return null
      try {
        const result = transform(code, relativeFile(root, file))
        return result ? { code: result.code, map: result.map } : null
      } catch {
        // A file we cannot parse is simply not editable. Never break the build.
        return null
      }
    },

    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      const cms = createCMS({ ...options, root })
      server.middlewares.use(async (req, res, next) => {
        const url: string = req.url ?? ''
        const pathname = url.split('?')[0]
        if (pathname !== base && !pathname.startsWith(`${base}/`)) return next()
        try {
          const chunks: Buffer[] = []
          if (req.method !== 'GET' && req.method !== 'HEAD') for await (const chunk of req) chunks.push(chunk)
          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(name, value)
          }
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${url}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          })
          const segments = pathname.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent)
          const context = { params: Promise.resolve({ path: segments }) }
          const response = await (req.method === 'POST' ? cms.POST(request, context) : cms.GET(request, context))
          res.statusCode = response.status
          response.headers.forEach((value: string, name: string) => res.setHeader(name, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          res.statusCode = 500
          res.end(`Torso: ${(error as Error).message}`)
        }
      })
    },
  }
}

export default torso
