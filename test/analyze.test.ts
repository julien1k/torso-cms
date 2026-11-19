import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { transform } from '../src/loader'

const texts = (code: string, file = 'app/page.tsx') => analyze(code, file).entries.map((e) => `${e.kind}:${e.text}`)

describe('analyze', () => {
  it('finds literal JSX text and collapses whitespace the way React does', () => {
    const code = `export default function P() {
  return (
    <p>
      Hello world, this is
      a long paragraph.
    </p>
  )
}`
    expect(texts(code)).toEqual(['text:Hello world, this is a long paragraph.'])
  })

  it('decodes entities and keeps significant edge spaces', () => {
    expect(texts(`const a = () => <p>Tom &amp; Jerry <b>rock</b> &copy; 2024</p>`)).toEqual([
      'text:Tom & Jerry ',
      'text:rock',
      'text: © 2024',
    ])
  })

  it('finds string literals in child expressions, including both branches', () => {
    expect(texts(`const a = (x) => <p>{"One"}{x ? 'Two' : \`Three\`}{x && "Four"}</p>`)).toEqual([
      'expr:One',
      'expr:Two',
      'expr:Three',
      'expr:Four',
    ])
  })

  it('ignores dynamic values', () => {
    const code = `const a = ({ user, items }) => (
      <div>
        {user.name}
        {\`Hi \${user.name}\`}
        {items.map((i) => <span key={i.id}>{i.label}</span>)}
        <a href={user.url}>{count}</a>
      </div>
    )`
    expect(texts(code)).toEqual([])
  })

  it('finds literal hrefs on anchors and components', () => {
    const code = `const a = () => <><a href="/a">A</a><Link href={'/b'}>B</Link></>`
    expect(texts(code)).toEqual(['href:/a', 'text:A', 'href:/b', 'text:B'])
  })

  it('collects string props on components but not styling props or host attributes', () => {
    const code = `const a = () => <Hero title="Ship faster" variant="dark" className="x"><img alt="Logo" /></Hero>`
    expect(texts(code)).toEqual(['prop:Ship faster'])
  })

  it('collects strings from module-scope constants only', () => {
    const code = `
const features = [{ title: "Fast", body: \`Really\`, icon: Zap }] as const
export const site = { name: "Acme", nav: [{ label: "Docs", href: "/docs" }] }
function f() { const local = ["nope"]; return local }
let mutable = ["nope"]
`
    expect(texts(code, 'lib/data.ts')).toEqual(['data:Fast', 'data:Really', 'data:Acme', 'data:Docs', 'data:/docs'])
  })

  it('skips script and style bodies', () => {
    expect(texts(`const a = () => <><style>{"a{}"}</style><script>{"x"}</script></>`)).toEqual([])
  })

  it('keeps ids stable when only text changes', () => {
    const before = analyze(`const a = () => <div><h1>One</h1><p>Two</p></div>`, 'a.tsx')
    const after = analyze(`const a = () => <div><h1>A much longer heading</h1><p>Two</p></div>`, 'a.tsx')
    expect(after.entries.map((e) => e.id)).toEqual(before.entries.map((e) => e.id))
  })

  it('gives different files different ids without exposing the path', () => {
    const a = analyze(`const a = () => <p>x</p>`, 'app/page.tsx').entries[0].id
    const b = analyze(`const a = () => <p>x</p>`, 'app/about/page.tsx').entries[0].id
    expect(a).not.toEqual(b)
    expect(a).toMatch(/^[a-z0-9]{6}\.0$/)
  })
})

describe('transform', () => {
  it('stamps ids without touching anything else', () => {
    const code = `const a = ({ t }) => <section><h1 className="x">Hi <b>there</b></h1><Link<T> href="/x">Go</Link><h3>{t}</h3><i/></section>`
    const out = transform(code, 'a.tsx')!.code
    const key = analyze(code, 'a.tsx').key
    expect(out).toBe(
      `const a = ({ t }) => <section><h1 data-cms="${key}.0" className="x">Hi <b data-cms="${key}.1">there</b></h1>` +
        `<Link<T> data-cms="${key}.3" data-cms-href="${key}.2" href="/x">Go</Link><h3 data-cms-x="${key}">{t}</h3><i/></section>`,
    )
  })

  it('leaves files with nothing editable alone', () => {
    expect(transform(`export const x = (p) => <div className="a">{p.children}</div>`, 'a.tsx')!.code).toContain('data-cms-x')
    expect(transform(`export const x = () => <div className="a"><Foo /></div>`, 'a.tsx')).toBeNull()
  })

  it('does not stamp fragments', () => {
    const out = transform(`import { Fragment } from 'react'; const a = () => <Fragment>Hi<p>x</p></Fragment>`, 'a.tsx')!.code
    expect(out).toContain('<Fragment>Hi<p data-cms=')
  })
})
