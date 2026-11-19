// @vitest-environment happy-dom
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'
import { resolveDom } from '../src/client/resolve'
import { clientManifest, scanProject } from '../src/manifest'
import { applyEdits } from '../src/save'

const post = `---
title: "Shipping, faster"
description: Notes from a year of deploys
draft: false
date: 2024-03-01
tags: [a, b]
order: 3
---

import { Badge } from "./badge"

# Why we rebuilt it

Line one of the intro
continues here with **bold words** and [a link](/docs).

- First point
- Second \\*literal\\* point

> A quote, with \`code\` in it.

<Badge>New</Badge> and {1 + 1} are not text.

\`\`\`js
const notText = "at all"
\`\`\`
`

const texts = (code: string, file: string) => analyze(code, file).entries.map((e) => `${e.syntax}:${e.text}`)

function edit(code: string, file: string, from: string, to: string) {
  const entry = analyze(code, file).entries.find((e) => e.text === from)!
  return applyEdits(code, file, [{ id: entry.id, from, to }])
}

describe('markdown as a source', () => {
  it('lists runs of text and string front matter, and nothing that is code', () => {
    expect(texts(post, 'content/post.mdx')).toEqual([
      'yaml:Shipping, faster',
      'yaml:Notes from a year of deploys',
      'markdown:Why we rebuilt it',
      'markdown:Line one of the intro\ncontinues here with ',
      'markdown:bold words',
      'markdown: and ',
      'markdown:a link',
      'markdown:.',
      'markdown:First point',
      'markdown:Second *literal* point',
      'markdown:A quote, with ',
      'markdown: in it.',
      'markdown:New',
      'markdown: and ',
      'markdown: are not text.',
    ])
  })

  it('reads braces and angle brackets as plain text in .md but as code in .mdx', () => {
    expect(texts('Use {curly} braces\n', 'a.md')).toEqual(['markdown:Use {curly} braces'])
    expect(texts('Use {1 + 1} braces\n', 'a.mdx')).toEqual(['markdown:Use ', 'markdown: braces'])
  })

  it('replaces one run and leaves the rest of the file byte for byte', () => {
    const result = edit(post, 'content/post.mdx', 'Why we rebuilt it', 'Why we started over')
    expect(result.conflicts).toEqual([])
    expect(result.code).toBe(post.replace('# Why we rebuilt it', '# Why we started over'))
  })

  it('folds a wrapped paragraph onto one line when it is edited', () => {
    const result = edit(post, 'content/post.mdx', 'Line one of the intro\ncontinues here with ', 'A shorter intro with ')
    expect(result.code).toContain('\nA shorter intro with **bold words** and [a link](/docs).\n')
  })

  it('rewrites front matter as a quoted string, whatever it was before', () => {
    const plain = edit(post, 'content/post.mdx', 'Notes from a year of deploys', 'Notes: "quoted" # not a comment')
    expect(plain.code).toContain('description: "Notes: \\"quoted\\" # not a comment"\n')
    expect(analyze(plain.code, 'content/post.mdx').entries[1].text).toBe('Notes: "quoted" # not a comment')
    const quoted = edit(post, 'content/post.mdx', 'Shipping, faster', "It's done")
    expect(quoted.code).toContain(`title: "It's done"\n`)
    // The non-string fields are untouched and still not editable.
    expect(quoted.code).toContain('draft: false\ndate: 2024-03-01\ntags: [a, b]\norder: 3\n')
  })

  it('round-trips hostile text through every position, in .md and .mdx', () => {
    const shapes = [
      'SEED\n',
      '# SEED\n',
      '- SEED\n',
      '> SEED\n',
      'Before **SEED** after\n',
      'Before [SEED](/x) after\n',
      '| a | b |\n| - | - |\n| SEED | x |\n',
      '---\ntitle: SEED\n---\n\nBody\n',
      '<Card>SEED</Card>\n',
    ]
    const alphabet = [
      'a', 'B', ' ', '*', '**', '_', '__', '`', '[', ']', '(', ')', '<', '>', '{', '}', '#', '-', '+', '=', '1.', '2)', '~~', '|', '\\',
      '&', '&amp;', '!', '![', 'https://x.io', 'www.x.io', 'a@b.co', '<b>', '</Card>', '{1+1}', '---', '***', ':', '"', "'", 'é', '😀', '$', '^',
    ]
    let seed = 7
    const rand = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
    for (let i = 0; i < 300; i++) {
      const value = Array.from({ length: 1 + rand(7) }, () => alphabet[rand(alphabet.length)]).join('').trim() || 'x'
      for (const shape of shapes) {
        for (const file of ['a.md', 'a.mdx']) {
          if (file === 'a.md' && shape.startsWith('<Card>')) continue
          const result = edit(shape, file, 'SEED', value)
          expect(result.conflicts, `${JSON.stringify(value)} into ${JSON.stringify(shape)} (${file})`).toEqual([])
          const after = analyze(result.code, file).entries
          expect(after.some((e) => e.text === value), `${JSON.stringify(value)} gave ${JSON.stringify(result.code)}`).toBe(true)
          expect(after.length).toBe(analyze(shape, file).entries.length)
        }
      }
    }
  })

  it('matches rendered Markdown on the page, including a wrapped line', () => {
    const manifest = clientManifest([analyze(post, 'content/post.mdx')])
    document.documentElement.setAttribute('lang', 'en')
    document.body.innerHTML = `<article><h1>Shipping, faster</h1><h2>Why we rebuilt it</h2>
      <p>Line one of the intro continues here with <strong>bold words</strong> and <a href="/docs">a link</a>.</p></article>`
    const result = resolveDom(document, manifest)
    const found = (text: string) => result.texts.find((t) => t.text.trim().startsWith(text))!
    expect(found('Shipping, faster').entry!.name).toBe('title')
    expect(found('Why we rebuilt it').tier).toBe('match')
    expect(found('Line one of the intro').entry!.text).toBe('Line one of the intro\ncontinues here with ')
    expect(found('bold words').tier).toBe('match')
  })

  it('scans content files but not the repository’s own documents', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'torso-md-'))
    const write = (file: string, body: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), body)
    }
    write('content/post.mdx', post)
    write('app/about/page.md', '# About\n')
    write('README.md', '# Readme\n')
    write('docs/CHANGELOG.md', '# Changes\n')
    write('AGENTS.md', '# Agents\n')
    write('node_modules/pkg/readme-like.md', '# Nope\n')
    try {
      expect(scanProject(root).map((f) => f.file).sort()).toEqual(['app/about/page.md', 'content/post.mdx'])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('markdown edge spaces', () => {
  it('gives up a leading space that Markdown would drop anyway', () => {
    const result = edit('# Title\n', 'a.md', 'Title', '  Spaced out ')
    expect(result.conflicts).toEqual([])
    expect(result.code).toBe('# Spaced out\n')
  })
  it('keeps a space that separates two runs', () => {
    const result = edit('One **two** three\n', 'a.md', ' three', ' four')
    expect(result.code).toBe('One **two** four\n')
  })
})
