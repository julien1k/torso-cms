"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubError = void 0;
exports.pullRequestState = pullRequestState;
exports.saveToGitHub = saveToGitHub;
const save_1 = require("./save");
class GitHubError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.GitHubError = GitHubError;
const DATA_ONLY = (file) => !/\.(tsx|jsx)$/.test(file);
function client(gh, fetchImpl) {
    const api = (gh.apiUrl ?? 'https://api.github.com').replace(/\/+$/, '');
    return async function call(method, route, body, accept = 'application/vnd.github+json') {
        const res = await fetchImpl(`${api}/repos/${gh.repo}${route}`, {
            method,
            headers: {
                authorization: `Bearer ${gh.token}`,
                accept,
                'x-github-api-version': '2022-11-28',
                'user-agent': 'torso-cms',
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        return res;
    };
}
async function expectJson(res, what) {
    if (res.ok)
        return res.json();
    let detail = '';
    try {
        detail = (await res.json())?.message ?? '';
    }
    catch {
        /* no body */
    }
    const hint = res.status === 401 ? 'the token was rejected'
        : res.status === 403 ? 'the token lacks the access this needs'
            : res.status === 404 ? 'repository or branch not found, or the token cannot see it'
                : detail || `status ${res.status}`;
    throw new GitHubError(res.status, `GitHub: could not ${what} (${hint})`);
}
/**
 * What became of a pull request the editor saved into. Only pull requests from the edits
 * branch are answered for, so the endpoint cannot be used to look at any other.
 */
async function pullRequestState(gh, number, fetchImpl = fetch) {
    const res = await client(gh, fetchImpl)('GET', `/pulls/${number}`);
    if (res.status === 404)
        return null;
    const pull = await expectJson(res, 'read the pull request');
    if (pull.head?.ref !== (gh.editsBranch ?? 'torso/edits'))
        return null;
    return pull.merged || pull.merged_at ? 'merged' : pull.state === 'closed' ? 'closed' : 'open';
}
/**
 * Production save: apply the edits to the files at the tip of a branch and commit them
 * in one atomic commit. Your deploy branch is only ever moved forward, so a push that
 * lands while we work is never overwritten: we start again from the new tip.
 */
async function saveToGitHub(gh, files, edits, fetchImpl = fetch, editor) {
    const call = client(gh, fetchImpl);
    const prefix = gh.dir ? gh.dir.replace(/^\/+|\/+$/g, '') + '/' : '';
    const encode = (p) => p.split('/').map(encodeURIComponent).join('/');
    const { grouped, unknown } = (0, save_1.groupEdits)(files, edits);
    if (!grouped.size)
        return { saved: [], conflicts: unknown, files: [] };
    const review = gh.mode === 'pull-request';
    const target = review ? gh.editsBranch ?? 'torso/edits' : gh.branch;
    let open;
    if (review) {
        const owner = gh.repo.split('/')[0];
        const query = `head=${encodeURIComponent(`${owner}:${target}`)}&base=${encodeURIComponent(gh.branch)}&state=open`;
        open = (await expectJson(await call('GET', `/pulls?${query}`), 'look for the pull request'))[0];
        if (!open) {
            // No review in progress: start the edits branch afresh from the deploy branch. It is
            // ours alone, so resetting it is safe, and it keeps merged history out of the next review.
            const base = await expectJson(await call('GET', `/git/ref/heads/${encode(gh.branch)}`), 'read the branch');
            const existing = await call('GET', `/git/ref/heads/${encode(target)}`);
            if (existing.status === 404) {
                await expectJson(await call('POST', '/git/refs', { ref: `refs/heads/${target}`, sha: base.object.sha }), 'create the edits branch');
            }
            else {
                await expectJson(existing, 'read the edits branch');
                await expectJson(await call('PATCH', `/git/refs/heads/${encode(target)}`, { sha: base.object.sha, force: true }), 'reset the edits branch');
            }
        }
    }
    for (let attempt = 0;; attempt++) {
        const result = { saved: [], conflicts: [...unknown], files: [] };
        const ref = await expectJson(await call('GET', `/git/ref/heads/${encode(target)}`), 'read the branch');
        const head = ref.object.sha;
        const commit = await expectJson(await call('GET', `/git/commits/${head}`), 'read the latest commit');
        const tree = [];
        for (const [file, fileEdits] of grouped) {
            const repoPath = prefix + file;
            const res = await call('GET', `/contents/${encode(repoPath)}?ref=${head}`, undefined, 'application/vnd.github.raw+json');
            if (res.status === 404) {
                result.conflicts.push(...fileEdits.map((e) => ({ id: e.id, reason: 'changed' })));
                continue;
            }
            if (!res.ok)
                await expectJson(res, `read ${repoPath}`);
            const code = await res.text();
            const applied = (0, save_1.applyEdits)(code, file, fileEdits, { dataOnly: DATA_ONLY(file) });
            result.conflicts.push(...applied.conflicts);
            result.saved.push(...applied.applied.map((id) => ({ id, file })));
            if (applied.applied.length && applied.code !== code) {
                tree.push({ path: repoPath, mode: '100644', type: 'blob', content: applied.code });
                result.files.push(file);
            }
        }
        if (!tree.length) {
            if (open)
                result.pullRequest = { number: open.number, url: open.html_url };
            return result;
        }
        const paths = tree.map((t) => t.path);
        const message = typeof gh.message === 'function' ? gh.message(paths)
            : gh.message ?? `Edit content in ${paths.length === 1 ? paths[0] : `${paths.length} files`}\n\n${paths.map((p) => `- ${p}`).join('\n')}`;
        const author = editor?.name
            ? { name: editor.name, email: editor.email ?? `${editor.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@users.noreply.torso`, date: new Date().toISOString() }
            : undefined;
        const newTree = await expectJson(await call('POST', '/git/trees', { base_tree: commit.tree.sha, tree }), 'write the files');
        const newCommit = await expectJson(await call('POST', '/git/commits', { message, tree: newTree.sha, parents: [head], ...(author ? { author } : {}) }), 'create the commit');
        const moved = await call('PATCH', `/git/refs/heads/${encode(target)}`, { sha: newCommit.sha, force: false });
        if (!moved.ok) {
            // Someone pushed in the meantime. Redo the work on top of their commit.
            if ((moved.status === 422 || moved.status === 409) && attempt < 3)
                continue;
            await expectJson(moved, 'update the branch');
        }
        result.commit = { sha: newCommit.sha, url: newCommit.html_url };
        if (review) {
            open ?? (open = await expectJson(await call('POST', '/pulls', {
                title: 'Content edits',
                head: target,
                base: gh.branch,
                body: 'Edits made on the live site with Torso. Merging this publishes them.',
            }), 'open the pull request'));
            result.pullRequest = { number: open.number, url: open.html_url };
        }
        return result;
    }
}
