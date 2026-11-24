/**
 * The editor that runs in the /edit shell page. The site itself loads in a same-origin
 * iframe and gets no script, markup or stylesheet of ours: everything here reaches in
 * from the outside, and all editor UI lives in the shell document.
 *
 * mountEditor must stay self-contained (no imports, no outer helpers): the server sends
 * it to the browser with Function.prototype.toString().
 */
export interface EditorConfig {
    /** Where the shell is mounted, e.g. "/edit". */
    base: string;
    /** Where the endpoints live, e.g. "/edit/_cms". */
    api: string;
    /** Site path to open first, e.g. "/pricing". */
    start: string;
    /**
     * Where Save writes: the files on disk, a commit on the deploy branch, or a pull request.
     * An agent may save on its own everywhere except `commit`, which publishes to the live site.
     */
    saves?: 'disk' | 'commit' | 'pull-request';
}
export declare function mountEditor(resolveDom: (doc: Document, manifest: any) => any, config: EditorConfig): {
    pending: Map<string, {
        from: string;
        to: string;
    }>;
    scan: () => void;
    agent: {
        list: (input?: {
            text?: string;
            limit?: number;
        }) => {
            items: {
                id: string;
                kind: "text" | "link";
                text: string;
                file?: string;
                unsaved?: true;
            }[];
            more: number;
            readOnly: number;
            page: string;
            saves: "commit" | "pull-request" | "disk";
            unsaved: {
                id: string;
                from: string;
                to: string;
            }[];
            awaitingDeploy: number;
        };
        edit: (input: {
            edits?: {
                id: string;
                text: string;
            }[];
        }) => {
            page: string;
            saves: "commit" | "pull-request" | "disk";
            unsaved: {
                id: string;
                from: string;
                to: string;
            }[];
            awaitingDeploy: number;
            ok: boolean;
            results: {
                id: string;
                ok: boolean;
                error?: string;
            }[];
        };
        save: () => Promise<{
            page: string;
            saves: "commit" | "pull-request" | "disk";
            unsaved: {
                id: string;
                from: string;
                to: string;
            }[];
            awaitingDeploy: number;
            ok: boolean;
            message: string;
        }>;
        discard: () => {
            page: string;
            saves: "commit" | "pull-request" | "disk";
            unsaved: {
                id: string;
                from: string;
                to: string;
            }[];
            awaitingDeploy: number;
            ok: boolean;
            discarded: number;
        };
        open: (input: {
            path?: string;
        }) => Promise<{
            ok: boolean;
            message: string;
        } | {
            items: {
                id: string;
                kind: "text" | "link";
                text: string;
                file?: string;
                unsaved?: true;
            }[];
            more: number;
            readOnly: number;
            page: string;
            saves: "commit" | "pull-request" | "disk";
            unsaved: {
                id: string;
                from: string;
                to: string;
            }[];
            awaitingDeploy: number;
            ok: boolean;
            message?: undefined;
        }>;
    };
};
