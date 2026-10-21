import { isOpen, votedList, send } from './_lib/common.js';

// Public: whether voting is open and which names already voted.
export default async function handler(req, res){
  try {
    send(res, { open: await isOpen(), voted: await votedList() });
  } catch {
    send(res, { error: 'server' });
  }
}
