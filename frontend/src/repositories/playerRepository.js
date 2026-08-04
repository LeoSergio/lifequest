import { db } from '../db/db.js';
import { enqueue } from '../services/syncService.js';

export async function getPlayer() {
  return db.player.toCollection().first();
}

export async function updatePlayer(id, changes) {
  await db.player.update(id, changes);
  const updatedPlayer = await db.player.get(id);
  if (updatedPlayer) {
    await enqueue('upsert', 'player', id, updatedPlayer);
  }
  return updatedPlayer;
}
