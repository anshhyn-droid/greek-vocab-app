import { withUser, badRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

const TYPES = ['word', 'sent', 'gram_question', 'gram_table'];

export const GET = withUser(async (_req, user) =>
  Response.json((await (await getDb()).all('SELECT item_id FROM favorites WHERE user_id = ?', user.id)).map((r) => r.item_id))
);

// 누르면 추가, 다시 누르면 삭제
export const POST = withUser(async (request, user) => {
  const { itemId, itemType } = await request.json();
  if (typeof itemId !== 'string' || !TYPES.includes(itemType)) throw badRequest('item');
  const db = await getDb();
  const on = await db.get('SELECT 1 FROM favorites WHERE user_id = ? AND item_id = ?', user.id, itemId);
  if (on) await db.run('DELETE FROM favorites WHERE user_id = ? AND item_id = ?', user.id, itemId);
  else await db.run('INSERT INTO favorites (user_id, item_id, item_type) VALUES (?, ?, ?)', user.id, itemId, itemType);
  return Response.json({ itemId, on: !on });
});
