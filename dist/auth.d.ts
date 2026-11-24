export declare const SESSION_COOKIE = "cms_session";
/** Without an explicit secret, sessions are tied to the password: changing it logs everyone out. */
export declare function sessionSecret(password: string, secret?: string): string;
/** Compare in constant time, without leaking the length. */
export declare function passwordMatches(given: string, expected: string): boolean;
export declare function createSession(secret: string, now?: number): {
    value: string;
    maxAge: number;
};
export declare function verifySession(secret: string, value: string | undefined, now?: number): boolean;
export declare function readCookie(req: Request, name: string): string | undefined;
/**
 * Slow down password guessing. Counts live in this server process only, so on serverless
 * hosts each instance counts separately: a brake, not a guarantee. Use a long password.
 */
export declare function createLimiter(max?: number, windowMs?: number): {
    blocked(key: string, now?: number): boolean;
    fail(key: string, now?: number): void;
    clear(key: string): void;
};
