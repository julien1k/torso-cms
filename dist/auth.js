"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE = void 0;
exports.sessionSecret = sessionSecret;
exports.passwordMatches = passwordMatches;
exports.createSession = createSession;
exports.verifySession = verifySession;
exports.readCookie = readCookie;
exports.createLimiter = createLimiter;
const node_crypto_1 = require("node:crypto");
exports.SESSION_COOKIE = 'cms_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const sha256 = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest();
const sign = (secret, value) => (0, node_crypto_1.createHmac)('sha256', secret).update(value).digest('base64url');
/** Without an explicit secret, sessions are tied to the password: changing it logs everyone out. */
function sessionSecret(password, secret) {
    return secret || sha256(`torso:session:${password}`).toString('hex');
}
/** Compare in constant time, without leaking the length. */
function passwordMatches(given, expected) {
    return (0, node_crypto_1.timingSafeEqual)(sha256(given), sha256(expected));
}
function createSession(secret, now = Date.now()) {
    const expires = Math.floor(now / 1000) + SESSION_SECONDS;
    return { value: `${expires}.${sign(secret, String(expires))}`, maxAge: SESSION_SECONDS };
}
function verifySession(secret, value, now = Date.now()) {
    if (!value)
        return false;
    const dot = value.indexOf('.');
    if (dot < 1)
        return false;
    const expires = value.slice(0, dot);
    if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now)
        return false;
    const given = Buffer.from(value.slice(dot + 1));
    const wanted = Buffer.from(sign(secret, expires));
    return given.length === wanted.length && (0, node_crypto_1.timingSafeEqual)(given, wanted);
}
function readCookie(req, name) {
    for (const part of (req.headers.get('cookie') ?? '').split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0 && part.slice(0, eq).trim() === name)
            return part.slice(eq + 1).trim();
    }
    return undefined;
}
/**
 * Slow down password guessing. Counts live in this server process only, so on serverless
 * hosts each instance counts separately: a brake, not a guarantee. Use a long password.
 */
function createLimiter(max = 10, windowMs = 10 * 60 * 1000) {
    const hits = new Map();
    return {
        blocked(key, now = Date.now()) {
            const hit = hits.get(key);
            return !!hit && hit.reset > now && hit.count >= max;
        },
        fail(key, now = Date.now()) {
            if (hits.size > 5000)
                hits.clear();
            const hit = hits.get(key);
            if (!hit || hit.reset <= now)
                hits.set(key, { count: 1, reset: now + windowMs });
            else
                hit.count++;
        },
        clear(key) {
            hits.delete(key);
        },
    };
}
