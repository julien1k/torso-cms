import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { saveToGitHub } from '../src/github'

/** An in-memory GitHub with branches and pull requests, enough for both save modes. */
function fakeGitHub(initial: Record<string, string>) {
  let n = 0
  const trees = new Map<string, Record<string, string>>()
  const commits = new Map<string, { tree: string; parents: string[]; message: string; author?: { name: string; email: string } }>()
  const refs = new Map<string, string>()
  const pulls: { number: number; head: string; base: string; state: string; html_url: string }[] = []
  const calls: string[] = []
  const addTree = (files: Record<string, string>) => (trees.set(`tree${++n}`, files), `tree${n}`)
  const addCommit = (tree: string, parents: string[], message: string, author?: any) =>
    (commits.set(`commit${++n}`, { tree, parents, message, author }), `commit${n}`)
  refs.set('main', addCommit(addTree(initial), [], 'init'))
  const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

  const fetchImpl = (async (input: any, init: any = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    const route = decodeURIComponent(url.pathname.replace('/repos/acme/site', ''))
    calls.push(`${method} ${route}`)
    const body = init.body ? JSON.parse(init.body) : null

    if (route.startsWith('/git/ref/heads/') && method === 'GET') {
      const sha = refs.get(route.slice('/git/ref/heads/'.length))
      return sha ? reply(200, { object: { sha } }) : reply(404, { message: 'Not Found' })
    }
    if (route === '/git/refs' && method === 'POST') {
      refs.set(body.ref.replace('refs/heads/', ''), body.sha)
      return reply(201, {})
    }
    if (route.startsWith('/git/refs/heads/') && method === 'PATCH') {
      const branch = route.slice('/git/refs/heads/'.length)
      if (!body.force && commits.get(body.sha)!.parents[0] !== refs.get(branch)) return reply(422, { message: 'not a fast forward' })
      refs.set(branch, body.sha)
      return reply(200, {})
    }
    if (route.startsWith('/git/commits/') && method === 'GET') return reply(200, { tree: { sha: commits.get(route.split('/').pop()!)!.tree } })
    if (route.startsWith('/contents/') && method === 'GET') {
      const file = trees.get(commits.get(url.searchParams.get('ref')!)!.tree)![route.slice('/contents/'.length)]
      return file == null ? reply(404, { message: 'Not Found' }) : reply(200, file)
    }
    if (route === '/git/trees' && method === 'POST') {
      const files = { ...trees.get(body.base_tree)! }
      for (const item of body.tree) files[item.path] = item.content
      return reply(201, { sha: addTree(files) })
    }
    if (route === '/git/commits' && method === 'POST') {
      const sha = addCommit(body.tree, body.parents, body.message, body.author)
      return reply(201, { sha, html_url: `https://github.com/acme/site/commit/${sha}` })
    }
    if (route === '/pulls' && method === 'GET') {
      const head = url.searchParams.get('head')!.split(':')[1]
      return reply(200, pulls.filter((p) => p.state === 'open' && p.head === head && p.base === url.searchParams.get('base')))
    }
    if (route === '/pulls' && method === 'POST') {
      const pull = { number: pulls.length + 1, head: body.head, base: body.base, state: 'open', html_url: `https://github.com/acme/site/pull/${pulls.length + 1}` }
      pulls.push(pull)
      return reply(201, pull)
    }
    return reply(404, { message: `unhandled ${method} ${route}` })
  }) as typeof fetch

  const files = (branch: string) => trees.get(commits.get(refs.get(branch)!)!.tree)!
  const push = (branch: string, changes: Record<string, string>) =>
    refs.set(branch, addCommit(addTree({ ...files(branch), ...changes }), [refs.get(branch)!], 'a developer'))
  return { fetchImpl, refs, pulls, commits, calls, files, push }
}

const page = `export default function Page() {\n  return <main><h1>Hello</h1><p>World</p></main>\n}\n`
const gh = { repo: 'acme/site', branch: 'main', token: 't', mode: 'pull-request' as const }
const manifest = [analyze(page, 'app/page.tsx')]
const idOf = (text: string) => manifest[0].entries.find((e) => e.text === text)!.id

describe('pull-request mode', () => {
  it('leaves the deploy branch alone and opens a pull request', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    const main = hub.refs.get('main')
    const result = await saveToGitHub(gh, manifest, [{ id: idOf('Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    expect(result.pullRequest).toEqual({ number: 1, url: 'https://github.com/acme/site/pull/1' })
    expect(hub.refs.get('main')).toBe(main)
    expect(hub.files('main')['app/page.tsx']).toContain('<h1>Hello</h1>')
    expect(hub.files('torso/edits')['app/page.tsx']).toContain('<h1>Hi</h1>')
    expect(hub.pulls).toHaveLength(1)
  })

  it('adds later saves to the same pull request, on top of the earlier ones', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    await saveToGitHub(gh, manifest, [{ id: idOf('Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    const second = await saveToGitHub(gh, manifest, [{ id: idOf('World'), from: 'World', to: 'there' }], hub.fetchImpl)
    expect(second.pullRequest?.number).toBe(1)
    expect(hub.pulls).toHaveLength(1)
    expect(hub.files('torso/edits')['app/page.tsx']).toContain('<h1>Hi</h1><p>there</p>')
    // Editing the same text again works when the edit starts from what the pull request says.
    const third = await saveToGitHub(gh, manifest, [{ id: idOf('Hello'), from: 'Hi', to: 'Hey' }], hub.fetchImpl)
    expect(third.conflicts).toEqual([])
    expect(hub.files('torso/edits')['app/page.tsx']).toContain('<h1>Hey</h1>')
  })

  it('starts a fresh branch from the deploy branch once the last pull request is closed', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    await saveToGitHub(gh, manifest, [{ id: idOf('Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl)
    hub.pulls[0].state = 'closed'
    hub.push('main', { 'README.md': 'new on main' })
    const result = await saveToGitHub(gh, manifest, [{ id: idOf('World'), from: 'World', to: 'there' }], hub.fetchImpl)
    expect(result.pullRequest?.number).toBe(2)
    const edits = hub.files('torso/edits')
    expect(edits['README.md']).toBe('new on main')
    // The abandoned edit is not carried into the new review.
    expect(edits['app/page.tsx']).toContain('<h1>Hello</h1><p>there</p>')
  })

  it('does not open a pull request when every edit was refused', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    const result = await saveToGitHub(gh, manifest, [{ id: idOf('Hello'), from: 'Something else', to: 'Hi' }], hub.fetchImpl)
    expect(result.conflicts).toHaveLength(1)
    expect(result.pullRequest).toBeUndefined()
    expect(hub.pulls).toHaveLength(0)
  })
})

describe('commit author', () => {
  it('credits the signed-in editor when your login names them', async () => {
    const hub = fakeGitHub({ 'app/page.tsx': page })
    const direct = { ...gh, mode: 'commit' as const }
    await saveToGitHub(direct, manifest, [{ id: idOf('Hello'), from: 'Hello', to: 'Hi' }], hub.fetchImpl, { name: 'Ada Example', email: 'ada@example.com' })
    expect(hub.commits.get(hub.refs.get('main')!)!.author).toMatchObject({ name: 'Ada Example', email: 'ada@example.com' })
    await saveToGitHub(direct, manifest, [{ id: idOf('World'), from: 'World', to: 'there' }], hub.fetchImpl, { name: 'Bo Li' })
    expect(hub.commits.get(hub.refs.get('main')!)!.author!.email).toBe('bo.li@users.noreply.torso')
    await saveToGitHub(direct, manifest, [{ id: idOf('Hello'), from: 'Hi', to: 'Hey' }], hub.fetchImpl)
    expect(hub.commits.get(hub.refs.get('main')!)!.author).toBeUndefined()
  })
})
