// @vitest-environment happy-dom
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { resolveDom } from '../src/client/resolve'
import { clientManifest, scanProject } from '../src/manifest'
import { applyEdits } from '../src/save'

const manifestOf = (sources: Record<string, string>) =>
  clientManifest(Object.entries(sources).map(([file, code]) => analyze(code, file, { dataOnly: !/x$/.test(file) })))

function page(html: string, lang = 'en') {
  document.documentElement.setAttribute('lang', lang)
  document.body.innerHTML = html
  return document
}
const hitFor = (result: ReturnType<typeof resolveDom>, text: string) => result.texts.filter((t) => t.text.trim() === text)

describe('numbers in data', () => {
  const plans = `export const plans = [
  { name: "Starter", monthly: 0, seats: 3 },
  { name: "Team", monthly: 29, seats: 3 },
]
const REACH = 29
const sizes = [3, 29]
export const layout = { columns: 3 }
`

  it('collects numbers only as named values of an object', () => {
    const entries = analyze(plans, 'lib/plans.ts', { dataOnly: true }).entries
    expect(entries.filter((e) => e.syntax === 'number').map((e) => `${e.name}=${e.text}`)).toEqual([
      'monthly=0', 'seats=3', 'monthly=29', 'seats=3', 'columns=3',
    ])
    const team = entries.filter((e) => e.text === 'Team' || e.text === '29')
    expect(team[0].group).toBeDefined()
    expect(team[0].group).toBe(team[1].group)
  })

  it('matches a number to the object whose text is shown beside it', () => {
    const manifest = manifestOf({ 'lib/plans.ts': plans })
    const doc = page(`
      <main>
        <article><h3>Starter</h3><p><span>$</span><b>0</b></p><small>3</small></article>
        <article><h3>Team</h3><p><span>$</span><b>29</b></p><small>3</small></article>
        <footer><i>3</i> <i>29</i></footer>
      </main>`)
    const result = resolveDom(doc, manifest)
    const entries = manifest.files[0].entries
    const starter = entries.find((e) => e.text === 'Starter')!.group
    const team = entries.find((e) => e.text === 'Team')!.group

    const price = hitFor(result, '29').find((t) => t.node.parentElement!.tagName === 'B')!
    expect(price.tier).toBe('match')
    expect(price.entry!.group).toBe(team)
    expect(price.entry!.name).toBe('monthly')

    // The same value in two objects goes to the card it sits in.
    const seats = hitFor(result, '3').filter((t) => t.node.parentElement!.tagName === 'SMALL')
    expect(seats.map((t) => t.entry?.group)).toEqual([starter, team])
  })

  it('leaves a number alone when no text from its object is near it', () => {
    const manifest = manifestOf({ 'lib/plans.ts': plans })
    // "29" and "3" appear, but not inside a container that also shows the plan's name.
    const result = resolveDom(page(`<main><h3>Team</h3></main><aside><b>29</b><i>3</i></aside>`), manifest)
    expect(hitFor(result, '29')[0].entry).toBeUndefined()
    expect(hitFor(result, '3')[0].entry).toBeUndefined()
    // And with nothing of the object on the page at all.
    const bare = resolveDom(page(`<main><p>Step</p><b>3</b></main>`), manifest)
    expect(hitFor(bare, '3')[0].entry).toBeUndefined()
  })

  it('writes a number back as a number, and refuses anything else', () => {
    const code = `export const plans = [{ name: "Team", monthly: 29 }]\n`
    const entry = analyze(code, 'lib/plans.ts', { dataOnly: true }).entries.find((e) => e.text === '29')!
    const ok = applyEdits(code, 'lib/plans.ts', [{ id: entry.id, from: '29', to: ' 34.50 ' }], { dataOnly: true })
    expect(ok.conflicts).toEqual([])
    expect(ok.code).toBe(`export const plans = [{ name: "Team", monthly: 34.5 }]\n`)
    for (const bad of ['$34', 'thirty', '', '1e9', '3,000', '1); process.exit(']) {
      const result = applyEdits(code, 'lib/plans.ts', [{ id: entry.id, from: '29', to: bad }], { dataOnly: true })
      expect(result.conflicts, bad).toEqual([{ id: entry.id, reason: 'not-a-number' }])
      expect(result.code).toBe(code)
    }
  })
})

describe('message files', () => {
  const en = `{
  "hero": { "title": "Ship faster", "cta": "Get started" },
  "greeting": "Hello {name}",
  "items": ["One", "Two"]
}
`
  const de = `{
  "hero": { "title": "Schneller liefern", "cta": "Get started" },
  "greeting": "Hallo {name}",
  "items": ["Eins", "Zwei"]
}
`

  it('treats every string in a JSON file as content, and nothing else', () => {
    const entries = analyze(en, 'messages/en.json').entries
    expect(entries.map((e) => `${e.name}:${e.text}`)).toEqual([
      'title:Ship faster', 'cta:Get started', 'greeting:Hello {name}', 'items:One', 'items:Two',
    ])
    expect(analyze(`{ "count": 3, "on": true, "none": null }`, 'messages/en.json').entries).toEqual([])
  })

  it('edits a message in place and keeps the file valid JSON', () => {
    const entry = analyze(en, 'messages/en.json').entries.find((e) => e.text === 'Ship faster')!
    const result = applyEdits(en, 'messages/en.json', [{ id: entry.id, from: 'Ship faster', to: 'Ship "calmly"\\now' }])
    expect(result.conflicts).toEqual([])
    expect(JSON.parse(result.code).hero.title).toBe('Ship "calmly"\\now')
    expect(result.code.split('\n').length).toBe(en.split('\n').length)
    expect(JSON.parse(result.code).greeting).toBe('Hello {name}')
  })

  it('refuses braces in a message that had none, since they would become a placeholder', () => {
    const entry = analyze(en, 'messages/en.json').entries.find((e) => e.text === 'Ship faster')!
    const result = applyEdits(en, 'messages/en.json', [{ id: entry.id, from: 'Ship faster', to: 'Ship {faster}' }])
    expect(result.conflicts).toEqual([{ id: entry.id, reason: 'placeholder-syntax' }])
    expect(result.code).toBe(en)
  })

  it('picks the message for the language of the page', () => {
    const manifest = manifestOf({ 'messages/en.json': en, 'messages/de.json': de })
    const html = `<main><h1>Ship faster</h1><a>Get started</a></main>`
    const english = resolveDom(page(html, 'en-GB'), manifest)
    expect(hitFor(english, 'Get started')[0].file).toBe('messages/en.json')
    const german = resolveDom(page(html.replace('Ship faster', 'Schneller liefern'), 'de'), manifest)
    expect(hitFor(german, 'Get started')[0].file).toBe('messages/de.json')
    expect(hitFor(german, 'Schneller liefern')[0].file).toBe('messages/de.json')
    // Without a language on the page, the identical string stays ambiguous: never guess.
    const unknown = resolveDom(page(html, ''), manifest)
    expect(hitFor(unknown, 'Get started')[0].tier).toBe('ambiguous')
  })

  it('does not match a message that only renders with a placeholder filled in', () => {
    const manifest = manifestOf({ 'messages/en.json': en })
    const result = resolveDom(page(`<p>Hello Julien</p>`), manifest)
    expect(hitFor(result, 'Hello Julien')[0].entry).toBeUndefined()
  })

  it('finds message folders, including under public, and ignores other JSON', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'torso-'))
    const write = (file: string, body: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), body)
    }
    write('messages/en.json', en)
    write('public/locales/de/common.json', de)
    write('app/dictionaries/fr.json', `{ "a": "Bonjour" }`)
    write('package.json', `{ "name": "nope" }`)
    write('data/config.json', `{ "x": "nope" }`)
    write('public/data.json', `{ "x": "nope" }`)
    write('public/script.js', `export const x = { a: "nope" }`)
    write('node_modules/pkg/messages/en.json', `{ "x": "nope" }`)
    try {
      expect(scanProject(root).map((f) => f.file).sort()).toEqual([
        'app/dictionaries/fr.json', 'messages/en.json', 'public/locales/de/common.json',
      ])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('matching by value', () => {
  it('never lets text from another page claim the same characters here', () => {
    const manifest = manifestOf({
      'components/steps.tsx': `export const Steps = () => <ol><li><span>0</span><b>Zero</b></li></ol>`,
      'lib/plans.ts': `export const plans = [{ name: "Starter", monthly: 0 }]`,
    })
    // This page renders the plans, not the Steps component: no element carries Steps' ids.
    const result = resolveDom(page(`<article><h3>Starter</h3><p>$<b>0</b></p></article>`), manifest)
    const zero = hitFor(result, '0')[0]
    expect(zero.file).toBe('lib/plans.ts')
    expect(zero.entry!.name).toBe('monthly')
  })

  it('still finds text handed to a component that did not forward its id', () => {
    const manifest = manifestOf({ 'app/page.tsx': `export default () => <Button>Sign up</Button>` })
    const result = resolveDom(page(`<button>Sign up</button>`), manifest)
    expect(hitFor(result, 'Sign up')[0].tier).toBe('match')
  })
})

describe('imports as a hint', () => {
  it('prefers text from a module the rendering component imports', () => {
    const manifest = manifestOf({
      'lib/navigation.ts': `export const pages = [{ label: "Docs", href: "/docs" }]`,
      'components/header.tsx': `import { pages } from "@/lib/navigation";\nexport const Header = () => <nav>{pages.map((p) => <a key={p.href} href={p.href}>{p.label}</a>)}</nav>`,
      'app/docs/page.tsx': `export default () => <Badge>Docs</Badge>`,
      'app/other/page.tsx': `export default () => <Hero title="Docs" />`,
    })
    const header = manifest.files.find((f) => f.file === 'components/header.tsx')!
    const result = resolveDom(page(`<nav data-cms-x="${header.key}"><a href="/docs">Docs</a></nav>`), manifest)
    const label = hitFor(result, 'Docs')[0]
    expect(label.tier).toBe('match')
    expect(label.file).toBe('lib/navigation.ts')
    expect(result.links[0].file).toBe('lib/navigation.ts')
  })
})

describe('links whose words and address share an object', () => {
  const sources = {
    'lib/navigation.ts': `export const pages = [{ label: "How it works", href: "/how" }, { label: "Docs", href: "/docs" }]`,
    'components/sections.tsx': `import { pages } from "@/lib/navigation";
export const Intro = () => <Heading eyebrow="How it works" />
export const Footer = () => <footer>{pages.map((p) => <Link key={p.href} href={p.href}>{p.label}</Link>)}</footer>`,
    'app/docs/page.tsx': `export default () => <><Badge>Docs</Badge><Link href="/how">Read more</Link></>`,
  }

  it('matches both to that object, in a header and a footer alike', () => {
    const manifest = manifestOf(sources)
    const sections = manifest.files.find((f) => f.file === 'components/sections.tsx')!
    const result = resolveDom(
      page(`<header><a href="/how">How it works</a><a href="/docs">Docs</a></header>
        <footer data-cms-x="${sections.key}"><a href="/how">How it works</a><a href="/docs">Docs</a></footer>`),
      manifest,
    )
    expect(result.texts.map((t) => t.file)).toEqual(Array(4).fill('lib/navigation.ts'))
    expect(result.links.map((l) => l.file)).toEqual(Array(4).fill('lib/navigation.ts'))
  })

  it('does not pair words with an address from a different object', () => {
    const manifest = manifestOf(sources)
    // "Docs" pointing at "/how" exists in no single object.
    const result = resolveDom(page(`<p><a href="/how">Docs</a></p>`), manifest)
    expect(result.links[0].file).not.toBe('lib/navigation.ts')
  })
})

describe('a link written on one element', () => {
  it('is found by its words and address together when a component drops the id', () => {
    const manifest = manifestOf({
      'lib/navigation.ts': `export const pages = [{ label: "Docs", href: "/docs" }]`,
      'components/cta.tsx': `export const Cta = () => <More href="/docs">Read the docs</More>`,
    })
    const result = resolveDom(page(`<p><a href="/docs">Read the docs</a></p><nav><a href="/docs">Docs</a></nav>`), manifest)
    expect(result.links.map((l) => `${l.el.textContent} -> ${l.file}`)).toEqual([
      'Read the docs -> components/cta.tsx',
      'Docs -> lib/navigation.ts',
    ])
  })
})
