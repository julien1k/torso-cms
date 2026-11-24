import type { EditorConfig } from './client/editor';
/** The page served at the edit URL: the site in an iframe, with the editor UI around it. */
export declare function shellHtml(config: EditorConfig): string;
/** The password prompt shown at the edit URL when nobody is signed in. */
export declare function loginHtml(options: {
    action: string;
    next: string;
    error?: string;
}): string;
