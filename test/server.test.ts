import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession, passwordMatches, sessionSecret, verifySession } from '../src/auth'
import { createCMS } from '../src/server'

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path: path.length ? path : undefined }) })
const url = (p: string) => `https://site.example${p}`
const get = (cms: ReturnType<typeof createCMS>, p: string, headers: Record<string, string> = {}) =>
  cms.GET(new Request(url(p), { headers }), ctx(...p.split('/').filter(Boolean).slice(1)))
const post = (cms: ReturnType<typeof createCMS>, p: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  cms.POST(
    new Request(url(p), { method: 'POST', ...init, headers: { origin: 'https://site.example', host: 'site.example', ...init.headers } }),
    ctx(...p.split('/').filter(Boolean).slice(1)),
  )
const form = (fields: Record<string, string>) => ({
  body: new URLSearchParams(fields).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function production() {
  vi.stubEnv('NODE_ENV', 'production')
  // The site's own 404 page, which hidden routes must be indistinguishable from.
  vi.stubGlobal('fetch', async () => new Response('<h1>Site 404</h1>', { status: 404, headers: { 'content-type': 'text/html' } }))
}

describe('sessions', () => {
  it('accepts its own cookie and nothing else', () => {
    const secret = sessionSecret('hunter2')
    const { value } = createSession(secret, 1_000_000)
    expect(verifySession(secret, value, 1_000_000)).toBe(true)
    expect(verifySession(sessionSecret('other'), value, 1_000_000)).toBe(false)
    expect(verifySession(secret, value.replace(/^\d+/, '99999999999'), 1_000_000)).toBe(false)
    expect(verifySession(secret, value, 1_000_000 + 8 * 24 * 3600 * 1000)).toBe(false)
    expect(verifySession(secret, undefined)).toBe(false)
    expect(verifySession(secret, 'garbage')).toBe(false)
  })

  it('compares passwords of any length', () => {
    expect(passwordMatches('hunter2', 'hunter2')).toBe(true)
    expect(passwordMatches('hunter', 'hunter2')).toBe(false)
    expect(passwordMatches('', 'hunter2')).toBe(false)
  })
})

describe('createCMS in production', () => {
  it('is hidden behind the site 404 when nothing is configured', async () => {
    production()
    const cms = createCMS()
    for (const res of [await get(cms, '/edit'), await get(cms, '/edit/_cms/manifest'), await get(cms, '/edit/_cms/editor.js')]) {
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('<h1>Site 404</h1>')
    }
    expect((await post(cms, '/edit/_cms/save', { body: '{"edits":[]}', headers: { 'content-type': 'application/json' } })).status).toBe(404)
    expect((await post(cms, '/edit/_cms/login', form({ password: 'x' }))).status).toBe(404)
  })

  it('shows the site 404 when authorize says no, and the editor when it says yes', async () => {
    production()
    const cms = createCMS({ authorize: (req) => req.headers.get('cookie') === 'admin=1', password: 'ignored' })
    const denied = await get(cms, '/edit')
    expect(denied.status).toBe(404)
    expect(await denied.text()).toBe('<h1>Site 404</h1>')
    expect((await get(cms, '/edit/_cms/editor.js')).status).toBe(404)
    const allowed = await get(cms, '/edit/pricing', { cookie: 'admin=1' })
    expect(allowed.status).toBe(200)
    expect(await allowed.text()).toContain('"start":"/pricing"')
    // A throwing authorize must fail closed.
    const broken = createCMS({ authorize: () => { throw new Error('db down') } })
    expect((await get(broken, '/edit')).status).toBe(404)
  })

  it('tells the editor where Save writes, so an agent only saves on its own into a pull request', async () => {
    production()
    const shell = (cms: ReturnType<typeof createCMS>) => get(cms, '/edit').then((res) => res.text())
    const base = { authorize: () => true, github: { repo: 'o/r', token: 't', branch: 'main' } }
    expect(await shell(createCMS(base))).toContain('"saves":"commit"')
    expect(await shell(createCMS({ ...base, github: { ...base.github, mode: 'pull-request' } }))).toContain('"saves":"pull-request"')
    vi.stubEnv('NODE_ENV', 'development')
    expect(await shell(createCMS())).toContain('"saves":"disk"')
  })

  it('asks for the password, rejects a wrong one, and signs in with the right one', async () => {
    production()
    const cms = createCMS({ password: 'correct horse' })
    const prompt = await get(cms, '/edit/pricing')
    expect(prompt.status).toBe(401)
    const promptHtml = await prompt.text()
    expect(promptHtml).toContain('type="password"')
    expect(promptHtml).not.toContain('__cmsConfig')
    expect((await get(cms, '/edit/_cms/manifest')).status).toBe(401)
    expect((await get(cms, '/edit/_cms/editor.js')).status).toBe(401)
    expect((await post(cms, '/edit/_cms/save', { body: '{"edits":[]}', headers: { 'content-type': 'application/json' } })).status).toBe(401)

    const wrong = await post(cms, '/edit/_cms/login', form({ password: 'nope', next: '/edit/pricing' }))
    expect(wrong.status).toBe(401)
    expect(wrong.headers.get('set-cookie')).toBeNull()
    expect(await wrong.text()).toContain('not correct')

    const right = await post(cms, '/edit/_cms/login', form({ password: 'correct horse', next: '/edit/pricing' }))
    expect(right.status).toBe(303)
    expect(right.headers.get('location')).toBe('/edit/pricing')
    const cookie = right.headers.get('set-cookie')!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\/edit;/)

    const session = cookie.split(';')[0]
    const shell = await get(cms, '/edit/pricing', { cookie: session })
    expect(shell.status).toBe(200)
    expect(await shell.text()).toContain('__cmsConfig')
    expect((await get(cms, '/edit/_cms/editor.js', { cookie: session })).status).toBe(200)
    // A session signed for another password is worthless.
    expect((await get(createCMS({ password: 'changed' }), '/edit', { cookie: session })).status).toBe(401)
  })

  it('only redirects back into the editor after login', async () => {
    production()
    const cms = createCMS({ password: 'pw' })
    for (const next of ['https://evil.example/', '//evil.example', '/editor-lookalike', '']) {
      const res = await post(cms, '/edit/_cms/login', form({ password: 'pw', next }))
      expect(res.headers.get('location')).toBe('/edit')
    }
  })

  it('refuses cross-origin and origin-less posts', async () => {
    production()
    const cms = createCMS({ password: 'pw' })
    const cross = await post(cms, '/edit/_cms/login', { ...form({ password: 'pw' }), headers: { ...form({}).headers, origin: 'https://evil.example' } })
    expect(cross.status).toBe(403)
    const bare = await cms.POST(new Request(url('/edit/_cms/login'), { method: 'POST', ...form({ password: 'pw' }) }), ctx('_cms', 'login'))
    expect(bare.status).toBe(403)
  })

  it('locks out after repeated wrong passwords', async () => {
    production()
    vi.useFakeTimers()
    const cms = createCMS({ password: 'pw' })
    const attempt = async (password: string) => {
      const pending = post(cms, '/edit/_cms/login', { ...form({ password }), headers: { ...form({}).headers, 'x-forwarded-for': '203.0.113.9' } })
      await vi.advanceTimersByTimeAsync(500)
      return pending
    }
    for (let i = 0; i < 10; i++) expect((await attempt('wrong')).status).toBe(401)
    expect((await attempt('pw')).status).toBe(429)
    vi.useRealTimers()
  })

  it('says so when saving is not set up', async () => {
    production()
    vi.stubEnv('CMS_GITHUB_TOKEN', '')
    vi.stubEnv('CMS_GITHUB_REPO', '')
    const cms = createCMS({ authorize: () => true })
    const res = await post(cms, '/edit/_cms/save', { body: '{"edits":[]}', headers: { 'content-type': 'application/json' } })
    expect(res.status).toBe(501)
  })
})
