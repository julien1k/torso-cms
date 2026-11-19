import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'cms_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60

const sha256 = (value: string) => createHash('sha256').update(value).digest()
const sign = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('base64url')

/** Without an explicit secret, sessions are tied to the password: changing it logs everyone out. */
export function sessionSecret(password: string, secret?: string): string {
  return secret || sha256(`torso:session:${password}`).toString('hex')
}

/** Compare in constant time, without leaking the length. */
export function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(sha256(given), sha256(expected))
}

export function createSession(secret: string, now = Date.now()): { value: string; maxAge: number } {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS
  return { value: `${expires}.${sign(secret, String(expires))}`, maxAge: SESSION_SECONDS }
}

export function verifySession(secret: string, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false
  const dot = value.indexOf('.')
  if (dot < 1) return false
  const expires = value.slice(0, dot)
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return false
  const given = Buffer.from(value.slice(dot + 1))
  const wanted = Buffer.from(sign(secret, expires))
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

/**
 * Slow down password guessing. Counts live in this server process only, so on serverless
 * hosts each instance counts separately: a brake, not a guarantee. Use a long password.
 */
export function createLimiter(max = 10, windowMs = 10 * 60 * 1000) {
  const hits = new Map<string, { count: number; reset: number }>()
  return {
    blocked(key: string, now = Date.now()): boolean {
      const hit = hits.get(key)
      return !!hit && hit.reset > now && hit.count >= max
    },
    fail(key: string, now = Date.now()): void {
      if (hits.size > 5000) hits.clear()
      const hit = hits.get(key)
      if (!hit || hit.reset <= now) hits.set(key, { count: 1, reset: now + windowMs })
      else hit.count++
    },
    clear(key: string): void {
      hits.delete(key)
    },
  }
}
