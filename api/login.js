import { redis, K, checkVoter, isOpen, readBody, send } from './_lib/common.js';

// Checks a name + legajo before the person starts voting.
export default async function handler(req, res){
  if (req.method !== 'POST') return send(res, { error: 'invalid' });
  try {
    const { voter, legajo } = readBody(req);
    if (!(await isOpen())) return send(res, { error: 'closed' });
    const bad = await checkVoter(voter, legajo);
    if (bad) return send(res, { error: bad });
    if (await redis.sismember(K.voted, voter)) return send(res, { error: 'voted' });
    send(res, { ok: true });
  } catch {
    send(res, { error: 'server' });
  }
}
