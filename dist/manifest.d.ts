import { type FileAnalysis } from './analyze';
/**
 * Analyze every source file under `root`. The analysis is deterministic, so the ids match
 * the ones the loader stamped as long as the files have not changed since they were compiled.
 */
export declare function scanProject(root: string): FileAnalysis[];
export interface ClientEntry {
    id: string;
    kind: string;
    syntax: string;
    text: string;
    anchored: boolean;
    host?: boolean;
    name?: string;
    group?: string;
    line: number;
}
export interface ClientManifest {
    files: {
        key: string;
        file: string;
        hash: string;
        imports?: string[];
        entries: ClientEntry[];
    }[];
}
/** What the editor in the browser needs: ids and text, no source offsets. */
export declare function clientManifest(files: FileAnalysis[]): ClientManifest;
/** Where `next build` leaves the manifest for the deployed editor, relative to the project root. */
export declare const MANIFEST_FILE = ".torso/manifest.json";
export declare function writeBuildManifest(root: string): void;
/** The manifest written by the last build, or null when there is none. */
export declare function readBuildManifest(root: string): ClientManifest | null;
