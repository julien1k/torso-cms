import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { applyEdits } from '../src/save'

function edit(code: string, from: string, to: string, file = 'a.tsx') {
  const entry = analyze(code, file).entries.find((e) => e.text === from)!
  return applyEdits(code, file, [{ id: entry.id, from, to }])
}

describe('applyEdits', () => {
  it('replaces text and keeps the surrounding formatting', () => {
    const code = `export default function P() {
  return (
    <p className="lead">
      Hello world, this is
      a long paragraph.
    </p>
  )
}`
    expect(edit(code, 'Hello world, this is a long paragraph.', 'Short.').code).toBe(`export default function P() {
  return (
    <p className="lead">
      Short.
    </p>
  )
}`)
  })

  it('escapes characters that would be JSX syntax', () => {
    const r = edit(`const a = () => <p>Hi</p>`, 'Hi', 'if (a < b) { return "x" } &amp; done')
    expect(r.code).toBe(`const a = () => <p>if (a &lt; b) &#123; return "x" &#125; &amp;amp; done</p>`)
    expect(analyze(r.code, 'a.tsx').entries[0].text).toBe('if (a < b) { return "x" } &amp; done')
  })

  it('keeps a significant trailing space', () => {
    expect(edit(`const a = () => <p>Hello <b>you</b></p>`, 'Hello ', 'Goodbye ').code).toBe(
      `const a = () => <p>Goodbye <b>you</b></p>`,
    )
  })

  it('falls back to a string literal when JSX text cannot express the value', () => {
    const code = `const a = () => (
  <p>
    Hello
  </p>
)`
    const r = edit(code, 'Hello', 'Line one\nLine two ')
    expect(r.code).toContain(`{"Line one\\nLine two "}`)
    expect(analyze(r.code, 'a.tsx').entries[0].text).toBe('Line one\nLine two ')
  })

  it('writes attributes, single quotes and template literals in their own syntax', () => {
    expect(edit(`const a = () => <a href="/a">x</a>`, '/a', '/b?q="1"').code).toBe(
      `const a = () => <a href="/b?q=&quot;1&quot;">x</a>`,
    )
    expect(edit(`const items = [{ t: 'Fast' }]`, 'Fast', `It's "fast" \\o/`, 'd.ts').code).toBe(
      `const items = [{ t: 'It\\'s "fast" \\\\o/' }]`,
    )
    expect(edit('const items = [`Fast`]', 'Fast', 'costs ${5} `now`', 'd.ts').code).toBe(
      'const items = [`costs \\${5} \\`now\\``]',
    )
  })

  it('allows clearing a string without shifting the other ids', () => {
    const code = `const a = () => <div><h1>{"One"}</h1><p>Two</p></div>`
    const before = analyze(code, 'a.tsx').entries.map((e) => e.id)
    const r = edit(code, 'One', '')
    expect(r.applied).toHaveLength(1)
    expect(analyze(r.code, 'a.tsx').entries.map((e) => e.id)).toEqual(before)
  })

  it('refuses an edit whose source text changed underneath it', () => {
    const code = `const a = () => <p>Current</p>`
    const id = analyze(code, 'a.tsx').entries[0].id
    const r = applyEdits(code, 'a.tsx', [{ id, from: 'What the editor saw', to: 'New' }])
    expect(r.code).toBe(code)
    expect(r.conflicts).toEqual([{ id, reason: 'changed' }])
  })

  it('follows a string that moved, as long as it is unambiguous', () => {
    const old = analyze(`const a = () => <div><p>Target</p></div>`, 'a.tsx').entries[0].id
    const moved = `const a = () => <div><h1>New heading</h1><p>Target</p></div>`
    expect(applyEdits(moved, 'a.tsx', [{ id: old, from: 'Target', to: 'Hit' }]).code).toBe(
      `const a = () => <div><h1>New heading</h1><p>Hit</p></div>`,
    )
    const twice = `const a = () => <div><h1>New</h1><p>Target</p><p>Target</p></div>`
    expect(applyEdits(twice, 'a.tsx', [{ id: old, from: 'Target', to: 'Hit' }]).conflicts[0].reason).toBe('changed')
  })

  it('rejects script URLs in links', () => {
    const r = edit(`const a = () => <a href="/a">x</a>`, '/a', ' JavaScript:alert(1)')
    expect(r.conflicts[0].reason).toBe('unsafe-url')
    expect(r.code).toContain('href="/a"')
  })

  it('applies several edits to one file at once', () => {
    const code = `const a = () => <div><h1>One</h1><a href="/x">Two</a></div>`
    const e = analyze(code, 'a.tsx').entries
    const r = applyEdits(code, 'a.tsx', e.map((x) => ({ id: x.id, from: x.text, to: x.text + '!' })))
    expect(r.code).toBe(`const a = () => <div><h1>One!</h1><a href="/x!">Two!</a></div>`)
  })

  it('round-trips hostile input through every syntax', () => {
    const shapes: [string, string][] = [
      ['a.tsx', `const a = () => <p>SEED</p>`],
      ['a.tsx', `const a = () => (\n  <p>\n    SEED\n  </p>\n)`],
      ['a.tsx', `const a = () => <p>{"SEED"}</p>`],
      ['a.tsx', `const a = () => <p>{'SEED'}</p>`],
      ['a.tsx', 'const a = () => <p>{`SEED`}</p>'],
      ['a.tsx', `const a = () => <a href="SEED">x</a>`],
      ['a.tsx', `const a = () => <a href='SEED'>x</a>`],
      ['a.tsx', `const a = () => <Hero title="SEED" />`],
      ['d.ts', `export const d = { t: "SEED" }`],
      ['d.ts', `export const d = ['SEED']`],
    ]
    const alphabet = [
      'a', 'B', ' ', '  ', '\n', '\t', '{', '}', '<', '>', '&', '&amp;', '&nbsp;', '&#123;', '"', "'", '`', '\\', '${x}', '$',
      '</p>', '{/* c */}', '//', '\u00a0', 'é', '😀', '\u2028', '-->', '\\n', '\\u0041', '=',
    ]
    let seed = 42
    const rand = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
    for (let i = 0; i < 400; i++) {
      const value = Array.from({ length: 1 + rand(8) }, () => alphabet[rand(alphabet.length)]).join('')
      for (const [file, code] of shapes) {
        const r = edit(code, 'SEED', value, file)
        expect(r.conflicts, `${JSON.stringify(value)} into ${code}`).toEqual([])
        const after = analyze(r.code, file).entries
        expect(after.some((e) => e.text === value), `${JSON.stringify(value)} into ${code} gave ${r.code}`).toBe(true)
      }
    }
  })
})
