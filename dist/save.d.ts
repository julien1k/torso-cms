import { type Entry } from './analyze';
export interface Edit {
    id: string;
    /** The text the editor started from, exactly as the manifest reported it. */
    from: string;
    to: string;
}
export type ConflictReason = 'unknown-id' | 'changed' | 'unsafe-url' | 'unwritable' | 'not-a-number' | 'placeholder-syntax';
export interface SaveResult {
    saved: {
        id: string;
        file: string;
    }[];
    conflicts: {
        id: string;
        reason: ConflictReason;
    }[];
    files: string[];
}
interface Replacement {
    start: number;
    end: number;
    text: string;
}
/** Work out the exact source replacement for one entry. `plain` avoids JSX text syntax entirely. */
export declare function replacementFor(code: string, entry: Entry, to: string, plain?: boolean): Replacement;
export interface ApplyResult {
    code: string;
    applied: string[];
    conflicts: {
        id: string;
        reason: ConflictReason;
    }[];
}
/**
 * Apply edits to one file's source. Each edit is checked against the current source first,
 * and the result is re-parsed to prove every edited string now reads back as intended.
 */
export declare function applyEdits(code: string, file: string, edits: Edit[], options?: {
    dataOnly?: boolean;
}): ApplyResult;
/** Sort edits by the file they belong to. The path always comes from our own manifest, never from the request. */
export declare function groupEdits(files: {
    key: string;
    file: string;
}[], edits: Edit[]): {
    grouped: Map<string, Edit[]>;
    unknown: {
        id: string;
        reason: ConflictReason;
    }[];
};
/** Dev-mode save: write the edits straight into the source files under `root`. */
export declare function saveToDisk(root: string, edits: Edit[]): SaveResult;
export {};
