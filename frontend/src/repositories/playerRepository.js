import { db } from '../db/db.js';
import { enqueue } from '../services/syncService.js';

import { applyXp, xpToNextLevel } from '../lib/gamification.js';

export async function getPlayer() {
  const p = await db.player.toCollection().first();
  if (p && p.xp >= xpToNextLevel(p.level)) {
    // Corrige jogadores que ficaram com XP acumulado sem upar de nível
    const { level, xp } = applyXp(p.level, p.xp, 0);
    await updatePlayer(p.id, { level, xp });
    p.level = level;
    p.xp = xp;
  }
  return p;
}

export async function updatePlayer(id, changes) {
  await db.player.update(id, changes);
  const updatedPlayer = await db.player.get(id);
  if (updatedPlayer) {
    await enqueue('upsert', 'player', id, updatedPlayer);
  }
  return updatedPlayer;
}
