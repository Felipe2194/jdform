import { Redis } from '@upstash/redis';
import { createHash, timingSafeEqual } from 'node:crypto';

// Upstash from the Vercel Marketplace sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
export const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const P = 'frvm26:';
export const K = {
  closed: P + 'closed',             // present while voting is closed
  voted: P + 'voted',               // set of voter indexes with a ballot
  ballot: v => P + 'ballot:' + v,   // {voter, picks, savedAt}
  fails: who => P + 'fails:' + who, // failed legajo/password attempts, expire after 15 min
};

// LEGAJOS: JSON array with one legajo per person, in the same order as RAW in public/index.html.
// It lives only in Vercel's environment variables, never in the repo.
export const normLegajo = s => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');
let legajos;
const legajoOf = voter => (legajos ??= JSON.parse(process.env.LEGAJOS || '[]').map(normLegajo))[voter];
export const peopleCount = () => (legajoOf(0), legajos.length);
export const isVoter = v => Number.isInteger(v) && !!legajoOf(v);

const digest = s => createHash('sha256').update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

const MAX_FAILS = 8;
// Counts failures so nobody can try every legajo: after MAX_FAILS the name is locked for 15 minutes.
export async function guard(who, ok){
  const fails = Number(await redis.get(K.fails(who))) || 0;
  if (fails >= MAX_FAILS) return 'locked';
  if (ok()) return null;
  const n = await redis.incr(K.fails(who));
  if (n === 1) await redis.expire(K.fails(who), 900);
  return 'wrong';
}
export async function checkVoter(voter, legajo){
  if (!isVoter(voter)) return 'invalid';
  const r = await guard('voter:' + voter, () => same(normLegajo(legajo), legajoOf(voter)));
  return r === 'wrong' ? 'legajo' : r;
}
export async function checkAdmin(password){
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return 'password';
  const r = await guard('admin', () => same(String(password ?? ''), real));
  return r === 'wrong' ? 'password' : r;
}

export const isOpen = async () => !(await redis.exists(K.closed));
export async function votedList(){
  return (await redis.smembers(K.voted)).map(Number).filter(Number.isInteger);
}

const STATUS = { invalid: 400, legajo: 401, password: 401, closed: 403, voted: 409, locked: 429 };
export function send(res, body){
  res.setHeader('Cache-Control', 'no-store');
  const status = body.error ? STATUS[body.error] || 500 : 200;
  res.status(status).json(body);
}
export function readBody(req){
  return req.body && typeof req.body === 'object' ? req.body : {};
}
