import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { saveToGitHub } from '../src/github'

/** A tiny in-memory GitHub: one branch, commits, trees, and the endpoints saveToGitHub uses. */
function fakeGitHub(initial: Record<string, string>) {
  let n = 0
  const trees = new Map<string, Record<string, string>>()
  const commits = new Map<string, { tree: string; parents: string[]; message: string }>()
  const addTree = (files: Record<string, string>) => {
    const sha = `tree${++n}`
    trees.set(sha, files)
    return sha
  }
  const addCommit = (tree: string, parents: string[], message: string) => {
    const sha = `commit${++n}`
    commits.set(sha, { tree, parents, message })
    return sha
  }
  const state = { head: addCommit(addTree(initial), [], 'init'), calls: [] as string[], token: '', beforeMove: null as null | (() => void) }
  const reply = (status: number, body: unknown) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

  const fetchImpl = (async (input: any, init: any = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    const route = url.pathname.replace('/repos/acme/site', '')
    state.calls.push(`${method} ${route}`)
    state.token = init.headers.authorization
    if (state.token !== 'Bearer good-token') return reply(401, { message: 'Bad credentials' })
    const body = init.body ? JSON.parse(init.body) : null

    if (method === 'GET' && route === '/git/ref/heads/main') return reply(200, { object: { sha: state.head } })
    if (method === 'GET' && route.startsWith('/git/commits/')) {
      return reply(200, { tree: { sha: commits.get(route.split('/').pop()!)!.tree } })
    }
    if (method === 'GET' && route.startsWith('/contents/')) {
      const files = trees.get(commits.get(url.searchParams.get('ref')!)!.tree)!
      const file = files[decodeURIComponent(route.slice('/contents/'.length))]
      return file == null ? reply(404, { message: 'Not Found' }) : reply(200, file)
    }
    if (method === 'POST' && route === '/git/trees') {
      const files = { ...trees.get(body.base_tree)! }
      for (const item of body.tree) files[item.path] = item.content
      return reply(201, { sha: addTree(files) })
    }
    if (method === 'POST' && route === '/git/commits') {
      const sha = addCommit(body.tree, body.parents, body.message)
      return reply(201, { sha, html_url: `https://github.com/acme/site/commit/${sha}` })
    }
    if (method === 'PATCH' && route === '/git/refs/heads/main') {
      state.beforeMove?.()
      state.beforeMove = null
      if (body.force || commits.get(body.sha)!.parents[0] !== state.head) return reply(422, { message: 'Update is not a fast forward' })
      state.head = body.sha
      return reply(200, {})
    }
    return reply(404, { message: `unhandled ${method} ${route}` })
  }) as typeof fetch

  const files = () => trees.get(commits.get(state.head)!.tree)!
  const push = (changes: Record<string, string>) => (state.head = addCommit(addTree({ ...files(), ...changes }), [state.head], 'someone else'))
  return { fetchImpl, state, files, push, commits }
}

const page = `export default function Page() {\n  return <main><h1>Hello</h1><a href="/a">Go</a></main>\n}\n`
const data = `export const plans = [{ name: "Team" }]\n`
const gh = { repo: 'acme/site', branch: 'main', token: 'good-token' }
const manifestFor = (sources: Record<string, string>) =>
  Object.entries(sources).map(([file, code]) => analyze(code, file, { dataOnly: !file.endsWith('x') }))
const idOf = (files: ReturnType<typeof manifestFor>, text: string) => files.flatMap((f) => f.entries).find((e) => e.text === text)!.id

describe('saveToGitHub', () => {
  it('commits every changed file in one commit on top of the branch', async () => {
    const sources = { 'app/page.tsx': page, 'lib/plans.ts': data }
    const hub = fakeGitHub({ ...sources, 'README.md': 'untouched' })
    const first = hub.state.head
    const manifest = manifestFor(sources)
    const result = await saveToGitHub(
      gh,
      manifest,
      [
        { id: idOf(manifest, 'Hello'), from: 'Hello', to: 'Hi {there}' },
        { id: idOf(manifest, '/a'), from: '/a', to: '/b' },
        { id: idOf(manifest, 'Team'), from: 'Team', to: 'Growth' },
      ],
      hub.fetchImpl,
    )
    expect(result.conflicts).toEqual([])
    expect(result.saved).toHaveLength(3)
    expect(result.commit?.url).toContain('/commit/')
    expect(hub.files()['app/page.tsx']).toContain('<h1>Hi &#123;there&#125;</h1><a href="/b">Go</a>')
    expect(hub.files()['lib/plans.ts']).toContain('name: "Growth"')
    expect(hub.files()['README.md']).toBe('untouched')
    expect(hub.commits.get(hub.state.head)!.parents).toEqual([first])
    expect(hub.state.calls.filter((c) => c.startsWith('POST /git/commits'))).toHaveLength(1)
  })

  it('reads files under the configured folder of a monorepo', async () => {
    const hub = fakeGitHub({ 'apps/web/app/page.tsx': page })
    const manifest = manifestFor({ 'app/page.tsx': page })
    await saveToGitHub({ ...gh, dir: 'apps/web' }, manifest, [{ id: idOf(manifest, 'Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    expect(hub.files()['apps/web/app/page.tsx']).toContain('<h1>Hi</h1>')
  })

  it('does not commit when the text changed in the repository since the build', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page.replace('Hello', 'Rewritten by a developer') })
    const manifest = manifestFor({ 'app/page.tsx': page })
    const before = hub.state.head
    const id = idOf(manifest, 'Hello')
    const result = await saveToGitHub(gh, manifest, [{ id, from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    expect(result.conflicts).toEqual([{ id, reason: 'changed' }])
    expect(result.commit).toBeUndefined()
    expect(hub.state.head).toBe(before)
  })

  it('still applies an edit when unrelated lines of the file moved', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page.replace('<h1>', '<p>New intro</p><h1>') })
    const manifest = manifestFor({ 'app/page.tsx': page })
    const result = await saveToGitHub(gh, manifest, [{ id: idOf(manifest, '/a'), from: '/a', to: '/b' }], hub.fetchImpl)
    expect(result.conflicts).toEqual([])
    expect(hub.files()['app/page.tsx']).toContain('<p>New intro</p><h1>Hello</h1><a href="/b">')
  })

  it('never overwrites a push that lands mid-save: it redoes the edit on top of it', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page, 'other.txt': 'v1' })
    const manifest = manifestFor({ 'app/page.tsx': page })
    hub.state.beforeMove = () => hub.push({ 'other.txt': 'v2 from a colleague' })
    const result = await saveToGitHub(gh, manifest, [{ id: idOf(manifest, 'Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    expect(result.saved).toHaveLength(1)
    expect(hub.files()['other.txt']).toBe('v2 from a colleague')
    expect(hub.files()['app/page.tsx']).toContain('<h1>Hi</h1>')
    expect(hub.state.calls.filter((c) => c.startsWith('PATCH'))).toHaveLength(2)
  })

  it('reports a rejected token without echoing it', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    const manifest = manifestFor({ 'app/page.tsx': page })
    const attempt = saveToGitHub({ ...gh, token: 'secret-bad' }, manifest, [{ id: idOf(manifest, 'Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    await expect(attempt).rejects.toThrow('the token was rejected')
    await expect(attempt).rejects.not.toThrow('secret-bad')
  })

  it('ignores ids that are not in the manifest', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    const result = await saveToGitHub(gh, manifestFor({ 'app/page.tsx': page }), [{ id: 'zzzzzz.0', from: 'a', to: 'b' }], hub.fetchImpl)
    expect(result.conflicts).toEqual([{ id: 'zzzzzz.0', reason: 'unknown-id' }])
    expect(hub.state.calls).toEqual([])
  })
})
