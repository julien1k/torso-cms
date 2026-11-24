/**
 * Browser side: match what is on the page to manifest entries.
 * resolveDom must stay self-contained (no imports, no outer helpers): the server sends it
 * to the browser with Function.prototype.toString().
 */
interface MEntry {
    id: string;
    kind: string;
    syntax?: string;
    group?: string;
    text: string;
    anchored: boolean;
    host?: boolean;
    name?: string;
    line: number;
}
interface Manifest {
    files: {
        key: string;
        file: string;
        imports?: string[];
        entries: MEntry[];
    }[];
}
export type Tier = 'id' | 'match' | 'ambiguous' | 'none';
export interface TextHit {
    node: Text;
    text: string;
    /** For ambiguous text: the places in the source it could have come from, as "file:line". */
    candidates?: string[];
    tier: Tier;
    entry?: MEntry;
    file?: string;
}
export interface LinkHit {
    el: Element;
    href: string;
    tier: Tier;
    entry?: MEntry;
    file?: string;
}
export declare function resolveDom(doc: Document, manifest: Manifest): {
    texts: TextHit[];
    links: LinkHit[];
    coverage: {
        text: {
            nodes: Record<Tier, number>;
            chars: Record<Tier, number>;
            editableNodesPct: number;
            editableCharsPct: number;
        };
        links: {
            count: Record<Tier, number>;
            editablePct: number;
        };
        notEditable: string[];
        notEditableLinks: string[];
    };
};
export {};
