import { redis, K, checkVoter, isOpen, peopleCount, readBody, send } from './_lib/common.js';

// Shape check only; the page applies each award's eligibility rules when it counts.
function cleanPicks(picks, voter){
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) return null;
  const out = {}, n = peopleCount();
  for (const [cat, p] of Object.entries(picks)){
    if (!/^[a-z0-9-]{1,32}$/.test(cat) || !Number.isInteger(p) || p < 0 || p >= n || p === voter) return null;
    out[cat] = p;
  }
  const size = Object.keys(out).length;
  return size > 0 && size <= 60 ? out : null;
}

// One ballot per person, final once saved.
export default async function handler(req, res){
  if (req.method !== 'POST') return send(res, { error: 'invalid' });
  try {
    const { voter, legajo, picks } = readBody(req);
    if (!(await isOpen())) return send(res, { error: 'closed' });
    const bad = await checkVoter(voter, legajo);
    if (bad) return send(res, { error: bad });
    const clean = cleanPicks(picks, voter);
    if (!clean) return send(res, { error: 'invalid' });
    const saved = await redis.set(K.ballot(voter), { voter, picks: clean, savedAt: new Date().toISOString() }, { nx: true });
    if (!saved) return send(res, { error: 'voted' });
    await redis.sadd(K.voted, voter);
    send(res, { ok: true });
  } catch {
    send(res, { error: 'server' });
  }
}
