import { type Edit, type SaveResult } from './save';
export interface GitHubOptions {
    /** `owner/name` */
    repo: string;
    /** The branch your site deploys from. */
    branch: string;
    /** Needs read and write access to the repository's contents (and pull requests, in that mode). */
    token: string;
    /**
     * `commit` (the default) puts every save straight on `branch`.
     * `pull-request` collects saves on a separate branch and opens a pull request, so
     * nothing goes live, and nothing rebuilds your site, until someone merges it.
     */
    mode?: 'commit' | 'pull-request';
    /** Where pull-request mode collects edits. Defaults to `torso/edits`. */
    editsBranch?: string;
    /** Folder of the app inside the repository, for monorepos. */
    dir?: string;
    /** Override for GitHub Enterprise. Defaults to https://api.github.com */
    apiUrl?: string;
    /** Commit message. Receives the changed paths. */
    message?: string | ((files: string[]) => string);
}
/** Who made the edit, when your own login can say so. Becomes the commit's author. */
export interface Editor {
    name: string;
    email?: string;
}
export interface GitHubSaveResult extends SaveResult {
    commit?: {
        sha: string;
        url?: string;
    };
    pullRequest?: {
        number: number;
        url?: string;
    };
}
export declare class GitHubError extends Error {
    status: number;
    constructor(status: number, message: string);
}
type Fetch = typeof fetch;
export type ReviewState = 'open' | 'merged' | 'closed';
/**
 * What became of a pull request the editor saved into. Only pull requests from the edits
 * branch are answered for, so the endpoint cannot be used to look at any other.
 */
export declare function pullRequestState(gh: GitHubOptions, number: number, fetchImpl?: Fetch): Promise<ReviewState | null>;
/**
 * Production save: apply the edits to the files at the tip of a branch and commit them
 * in one atomic commit. Your deploy branch is only ever moved forward, so a push that
 * lands while we work is never overwritten: we start again from the new tip.
 */
export declare function saveToGitHub(gh: GitHubOptions, files: {
    key: string;
    file: string;
}[], edits: Edit[], fetchImpl?: Fetch, editor?: Editor): Promise<GitHubSaveResult>;
export {};
