# Torso

Click-to-edit for Next.js, saved back to your code.

Torso is a visual editor with no schema, no content files and no wrapper components. It finds the text and links written in your components, lets you edit them on the live page, and writes the change back to the source file: to disk in development, as a GitHub commit or pull request in production.

> **Status: early.** It has been tested in Chromium, and production saving has been tested against a simulated GitHub API and on the project site's own live deployment on Vercel. Every known limit is listed in [Status and limits](#status-and-limits).

## How it works

1. **Build time.** A compiler step reads each component and stamps a short opaque id on elements that hold literal text or a literal link. Your source files are not changed.
2. **Manifest.** The same analysis records, for every id, the file, position and text. It also lists text that reaches the page indirectly: props, constants, translation files, Markdown.
3. **Editing.** The edit URL serves your real site in a frame with a toolbar around it. Click text to rewrite it in place. Your pages load no editor script.
4. **Saving.** The browser sends an id, the text you started from and the new text. The server checks the source still says what you started from, escapes the new text for the syntax it lands in, parses the file again to prove it reads back as typed, and only then writes.

## Quick start (Next.js)

Requires Next.js 16 with the App Router, and Node.js 22.12 or newer.

Install the package from this repository. It is not on npm yet:

```bash
pnpm add github:julien1k/torso-cms
```

Wrap your config:

```ts
// next.config.ts
import { withCMS } from "torso-cms";

const nextConfig = {
  // your existing config
};

export default withCMS(nextConfig);
```

Add one route. Its folder name decides where the editor lives:

```ts
// app/edit/[[...path]]/route.ts
import { createCMS } from "torso-cms/server";

export const { GET, POST } = createCMS();
```

Add the generated folder to `.gitignore`:

```
.torso
```

Start your dev server and open `/edit`. To edit another page, put its path after it: `/edit/pricing` opens `/pricing`.

## Who can edit

In development the editor is open. In production it is closed until you choose one of two options.

**A password.** Set `CMS_PASSWORD`. Visitors to the edit URL get a sign-in prompt.

**Your own login.** Pass `authorize`. Anyone it rejects gets your site's normal 404 page. Return a name and that person becomes the author of their commits:

```ts
export const { GET, POST } = createCMS({
  authorize: async (request) => {
    const user = await currentUser(request);
    return user?.isAdmin ? { name: user.name, email: user.email } : false;
  },
});
```

## Where saves go

| | |
|---|---|
| Development | The source file on disk is rewritten and the page updates in place. |
| Production, default | One commit on your deploy branch per Save. Your host rebuilds. |
| Production, pull-request mode | Saves collect in one pull request. Nothing goes live until it is merged. |

```bash
CMS_GITHUB_REPO=owner/name
CMS_GITHUB_BRANCH=main
CMS_GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE
# optional
CMS_GITHUB_MODE=pull-request
```

Use a fine-grained token with read and write access to **Contents** on that one repository, plus **Pull requests** for pull-request mode. On Vercel the repository and branch default to the deployment's.

## What you can edit

- Text written directly in a component, including both branches of a condition.
- Link addresses written as a literal `href`.
- String props passed to a component.
- Strings and numbers in constant arrays and objects, in the same file or imported.
- Strings in JSON translation files, in folders named `messages`, `locales`, `i18n`, `lang`, `translations` or `dictionaries`.
- Text in Markdown and MDX files, and single-line string fields in their front matter.

## For agents

An agent can make the same edits a person does, without clicking or typing into the page. The editor exposes five calls: list what is editable on the open page, change texts and links by id, save, discard, and open another page.

- **In a browser with WebMCP**, they are registered as the tools `torso_list`, `torso_edit`, `torso_save`, `torso_discard` and `torso_open`.
- **From script in the page**, they are at `window.__cmsEditor.agent`.

An agent may save on its own in development and in pull-request mode. Where Save commits straight to the deploy branch, `torso_save` stops with "Needs a person" and the editor asks the person to press Save. These tools have been tested through script; no WebMCP browser has been tested yet.

## React on Vite (experimental)

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { torso } from "torso-cms/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [torso(), react()],
});
```

In development this serves the editor at `/edit` from the Vite dev server, with no route file. It is verified on a stock Vite and React app. vinext, React Router and TanStack Start should work the same way but are not tested. In production the editor needs a server route.

## Status and limits

| Framework | |
|---|---|
| Next.js 16, App Router | Works, with Turbopack and webpack |
| React on Vite | Experimental |
| Next.js Pages Router | Not yet |
| Svelte, Vue, Astro templates | Not yet: each needs its own parser |

Known limits:

- **Matching.** Text without an id is matched by its words, and only when one candidate is left. If the same words exist in several places, that text is read-only on that page. The editor says why when you click it.
- **Not editable.** Text from a database or remote service, anything your code calculates, translations with placeholders, images, rich text, and code inside Markdown.
- **Formatted paragraphs** are edited piece by piece, between the inline tags.
- **Undo** reaches back to your last save. Unsaved edits are kept in one browser.
- **No live collaboration.** If two people change the same text, the second save is refused for that text.
- **Password login** carries no identity, and its lockout counts per server instance.
- **No roles, drafts or scheduling.** Review happens in the pull request.

The project site has the full list on its status page.

### Planned

Today Torso edits what already exists. Planned, in rough order, with no dates:

1. Add, remove and reorder anything that repeats: FAQ entries, testimonials, plans, navigation links.
2. New posts and pages, created by copying an existing one.
3. Rich text in Markdown and MDX bodies.
4. Images, with their descriptions.
5. Adding and moving sections, chosen from the components a project already has.
6. Point and describe: click an element, say what should change, and a coding agent opens the pull request.
7. Review of every pending change as a diff before saving.
8. Sign in with GitHub, in place of a shared password and a token.
9. Edit history with revert, page settings, and a coverage report.
10. Svelte and Vue.

## This repository

```
src/                 the torso-cms package
test/                unit tests
examples/landing/    the project site: landing page, docs, demos, status
examples/vite-react/ a stock Vite + React app using the Vite plugin
```

```bash
pnpm install
pnpm build                          # compile the package to dist/
pnpm test                           # run the unit tests
pnpm --dir examples/landing dev     # the site, then open http://localhost:3000/edit
pnpm --dir examples/vite-react dev  # the Vite example, then open /edit
```

The site is edited with Torso itself, so running it locally is the quickest way to try the editor. Rebuild the package after changing anything in `src/`.

## License

MIT
