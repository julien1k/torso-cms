export declare function relativeFile(root: string, file: string): string;
/** Stamp opaque ids on JSX elements. The source file on disk is never touched. */
export declare function transform(code: string, file: string): {
    code: string;
    map: any;
} | null;
/** webpack / Turbopack loader. */
export default function torsoLoader(this: any, source: string, inputMap: any): any;
