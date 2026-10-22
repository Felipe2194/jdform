import { redis, K, checkAdmin, isOpen, isVoter, votedList, readBody, send } from './_lib/common.js';

async function state(){
  const voted = await votedList();
  const ballots = voted.length ? (await redis.mget(...voted.map(K.ballot))).filter(Boolean) : [];
  return { open: await isOpen(), ballots };
}

// Organizers: read ballots, open or close voting, void a ballot. Every action needs ADMIN_PASSWORD.
export default async function handler(req, res){
  if (req.method !== 'POST') return send(res, { error: 'invalid' });
  try {
    const { password, action, open, voter } = readBody(req);
    const bad = await checkAdmin(password);
    if (bad) return send(res, { error: bad });
    if (action === 'open'){
      if (open) await redis.del(K.closed); else await redis.set(K.closed, 1);
    } else if (action === 'delete'){
      if (!(await isVoter(voter))) return send(res, { error: 'invalid' });
      await redis.del(K.ballot(voter));
      await redis.srem(K.voted, voter);
    } else if (action !== 'state'){
      return send(res, { error: 'invalid' });
    }
    send(res, await state());
  } catch {
    send(res, { error: 'server' });
  }
}
