"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveToGitHub = exports.saveToDisk = exports.applyEdits = exports.clientManifest = exports.scanProject = exports.analyze = void 0;
exports.createCMS = createCMS;
const auth_1 = require("./auth");
const editor_1 = require("./client/editor");
const resolve_1 = require("./client/resolve");
const github_1 = require("./github");
const manifest_1 = require("./manifest");
const save_1 = require("./save");
const shell_1 = require("./shell");
var analyze_1 = require("./analyze");
Object.defineProperty(exports, "analyze", { enumerable: true, get: function () { return analyze_1.analyze; } });
var manifest_2 = require("./manifest");
Object.defineProperty(exports, "scanProject", { enumerable: true, get: function () { return manifest_2.scanProject; } });
Object.defineProperty(exports, "clientManifest", { enumerable: true, get: function () { return manifest_2.clientManifest; } });
var save_2 = require("./save");
Object.defineProperty(exports, "applyEdits", { enumerable: true, get: function () { return save_2.applyEdits; } });
Object.defineProperty(exports, "saveToDisk", { enumerable: true, get: function () { return save_2.saveToDisk; } });
var github_2 = require("./github");
Object.defineProperty(exports, "saveToGitHub", { enumerable: true, get: function () { return github_2.saveToGitHub; } });
/** Path segment that separates the editor's own endpoints from site paths. */
const API = '_cms';
const noStore = { 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...noStore } });
const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...noStore, ...headers } });
const redirect = (to, headers = {}) => new Response(null, { status: 303, headers: { location: to, ...noStore, ...headers } });
/**
 * Route handlers for the edit URL. Mount once, in a catch-all route:
 *
 *   // app/edit/[[...path]]/route.ts
 *   export const { GET, POST } = createCMS()
 *
 * `/edit/pricing` then opens `/pricing` in the editor.
 *
 * In development, saving writes the source files on disk. In production it commits to
 * GitHub, and the editor is only reachable when a password or `authorize` is configured.
 */
function createCMS(options = {}) {
    const root = options.root ?? process.cwd();
    const limiter = (0, auth_1.createLimiter)();
    const isDev = () => process.env.NODE_ENV === 'development';
    const password = () => options.password ?? process.env.CMS_PASSWORD ?? '';
    function github() {
        const env = process.env;
        const vercelRepo = env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}` : '';
        const repo = options.github?.repo ?? env.CMS_GITHUB_REPO ?? vercelRepo;
        const token = options.github?.token ?? env.CMS_GITHUB_TOKEN ?? '';
        const branch = options.github?.branch ?? env.CMS_GITHUB_BRANCH ?? env.VERCEL_GIT_COMMIT_REF ?? 'main';
        if (!repo || !token)
            return null;
        const wanted = options.github?.mode ?? env.CMS_GITHUB_MODE;
        const mode = wanted === 'pull-request' || wanted === 'pr' ? 'pull-request' : 'commit';
        return { ...options.github, repo, token, branch, mode, apiUrl: options.github?.apiUrl ?? env.CMS_GITHUB_API_URL };
    }
    async function locate(req, ctx) {
        const url = new URL(req.url);
        const params = (await ctx?.params) ?? {};
        const value = Object.values(params)[0];
        const segments = value == null ? [] : Array.isArray(value) ? value : [value];
        const parts = url.pathname.replace(/\/+$/, '').split('/');
        // The mount point is whatever precedes the catch-all segments.
        const base = parts.slice(0, parts.length - segments.length).join('/');
        return { url, segments, base, api: `${base}/${API}` };
    }
    /** Who is behind a request, when `authorize` said so. */
    const editors = new WeakMap();
    async function access(req) {
        if (options.authorize) {
            try {
                const answer = await options.authorize(req);
                if (answer && typeof answer === 'object' && typeof answer.name === 'string' && answer.name.trim()) {
                    editors.set(req, { name: answer.name.trim(), email: typeof answer.email === 'string' ? answer.email : undefined });
                    return 'ok';
                }
                return answer === true ? 'ok' : 'hidden';
            }
            catch {
                return 'hidden';
            }
        }
        const pass = password();
        if (pass)
            return (0, auth_1.verifySession)((0, auth_1.sessionSecret)(pass, options.secret ?? process.env.CMS_SECRET), (0, auth_1.readCookie)(req, auth_1.SESSION_COOKIE)) ? 'ok' : 'login';
        // Nothing configured: open on the developer's machine, closed everywhere else.
        return isDev() ? 'ok' : 'hidden';
    }
    let notFoundPage = null;
    /** Answer exactly like a page that does not exist, by asking the site for one. */
    async function hidden(req) {
        try {
            if (!notFoundPage || Date.now() - notFoundPage.at > 60000) {
                const probe = new URL(`/_not-found-${Math.random().toString(36).slice(2)}`, req.url);
                const res = await fetch(probe, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
                if (res.status !== 404)
                    throw new Error('unexpected');
                notFoundPage = { body: await res.text(), type: res.headers.get('content-type') ?? 'text/html; charset=utf-8', at: Date.now() };
            }
            return new Response(notFoundPage.body, { status: 404, headers: { 'content-type': notFoundPage.type } });
        }
        catch {
            return new Response('Not found', { status: 404 });
        }
    }
    function sameOrigin(req) {
        const origin = req.headers.get('origin');
        if (!origin)
            return isDev();
        try {
            const host = new URL(origin).host;
            return host === req.headers.get('host') || host === req.headers.get('x-forwarded-host') || host === new URL(req.url).host;
        }
        catch {
            return false;
        }
    }
    function manifest() {
        return isDev() ? (0, manifest_1.clientManifest)((0, manifest_1.scanProject)(root)) : (0, manifest_1.readBuildManifest)(root);
    }
    async function GET(req, ctx) {
        const who = await access(req);
        if (who === 'hidden')
            return hidden(req);
        const { url, segments, base, api } = await locate(req, ctx);
        if (segments[0] !== API) {
            if (who === 'login')
                return html((0, shell_1.loginHtml)({ action: `${api}/login`, next: url.pathname + url.search }), 401);
            const start = `/${segments.map(encodeURIComponent).join('/')}${url.search}`;
            const saves = isDev() ? 'disk' : github()?.mode === 'pull-request' ? 'pull-request' : 'commit';
            return html((0, shell_1.shellHtml)({ base, api, start, saves }));
        }
        if (segments[1] === 'login')
            return redirect(base || '/');
        if (who === 'login')
            return json({ error: 'signed out' }, 401);
        switch (segments[1]) {
            case 'manifest': {
                const data = manifest();
                return data ? json(data) : json({ error: 'No manifest found. It is written by `next build` when next.config uses withCMS().' }, 500);
            }
            case 'review': {
                // What became of the pull request a save went into: open, merged or closed.
                const number = Number(url.searchParams.get('number'));
                const gh = github();
                if (!gh || !Number.isInteger(number) || number < 1)
                    return json({ state: null });
                try {
                    return json({ state: await (0, github_1.pullRequestState)(gh, number) });
                }
                catch (error) {
                    return json({ error: error instanceof github_1.GitHubError ? error.message : 'GitHub: the request failed' }, 502);
                }
            }
            case 'editor.js': {
                const body = `window.__cmsEditor=(${editor_1.mountEditor.toString()})(${resolve_1.resolveDom.toString()},window.__cmsConfig);`;
                return new Response(body, { headers: { 'content-type': 'text/javascript; charset=utf-8', ...noStore } });
            }
            default:
                return new Response('Not found', { status: 404 });
        }
    }
    async function login(req, base, api) {
        const pass = password();
        if (!pass || options.authorize)
            return hidden(req);
        const form = await req.formData().catch(() => null);
        const given = String(form?.get('password') ?? '');
        const wanted = String(form?.get('next') ?? '');
        const next = wanted === base || wanted.startsWith(`${base}/`) ? wanted : base || '/';
        const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
        if (limiter.blocked(ip)) {
            return html((0, shell_1.loginHtml)({ action: `${api}/login`, next, error: 'Too many attempts. Try again in a few minutes.' }), 429);
        }
        if (!(0, auth_1.passwordMatches)(given, pass)) {
            limiter.fail(ip);
            await new Promise((resolve) => setTimeout(resolve, 400));
            return html((0, shell_1.loginHtml)({ action: `${api}/login`, next, error: 'That password is not correct.' }), 401);
        }
        limiter.clear(ip);
        const session = (0, auth_1.createSession)((0, auth_1.sessionSecret)(pass, options.secret ?? process.env.CMS_SECRET));
        const secure = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookie = `${auth_1.SESSION_COOKIE}=${session.value}; Path=${base || '/'}; Max-Age=${session.maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
        return redirect(next, { 'set-cookie': cookie });
    }
    async function POST(req, ctx) {
        const { segments, base, api } = await locate(req, ctx);
        if (segments[0] !== API)
            return hidden(req);
        // A page on another origin must never be able to sign in or write on someone's behalf.
        if (!sameOrigin(req))
            return json({ error: 'cross-origin' }, 403);
        if (segments[1] === 'login')
            return login(req, base, api);
        if (segments[1] === 'logout') {
            return redirect('/', { 'set-cookie': `${auth_1.SESSION_COOKIE}=; Path=${base || '/'}; Max-Age=0; HttpOnly; SameSite=Lax` });
        }
        const who = await access(req);
        if (who === 'hidden')
            return hidden(req);
        if (who === 'login')
            return json({ error: 'signed out' }, 401);
        if (segments[1] !== 'save')
            return new Response('Not found', { status: 404 });
        if (!(req.headers.get('content-type') ?? '').includes('application/json'))
            return json({ error: 'expected json' }, 415);
        let edits;
        try {
            const body = await req.json();
            edits = body?.edits;
            if (!Array.isArray(edits) || edits.length > 500)
                throw new Error();
        }
        catch {
            return json({ error: 'expected { edits: [{ id, from, to }] }' }, 400);
        }
        if (isDev()) {
            const result = (0, save_1.saveToDisk)(root, edits);
            return json({ mode: 'disk', ...result }, result.conflicts.length ? 409 : 200);
        }
        const gh = github();
        if (!gh)
            return json({ error: 'Saving is not set up: set CMS_GITHUB_REPO and CMS_GITHUB_TOKEN.' }, 501);
        const built = (0, manifest_1.readBuildManifest)(root);
        if (!built)
            return json({ error: 'No manifest found. It is written by `next build` when next.config uses withCMS().' }, 500);
        try {
            const result = await (0, github_1.saveToGitHub)(gh, built.files, edits, fetch, editors.get(req));
            return json({ mode: gh.mode === 'pull-request' ? 'pull-request' : 'github', ...result }, result.conflicts.length ? 409 : 200);
        }
        catch (error) {
            const message = error instanceof github_1.GitHubError ? error.message : 'GitHub: the request failed';
            return json({ error: message }, 502);
        }
    }
    return { GET, POST };
}
