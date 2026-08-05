/**
 * Repositório de metas — encapsula todo acesso à tabela `goals`.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db.js';
import { generateId } from '../lib/id.js';

import { enqueue } from '../services/syncService.js';

export const allGoalsQuery = () =>
  liveQuery(() => db.goals.orderBy('createdAt').reverse().toArray());

export async function addGoal({ title, targetValue, unit, reward, xpReward, deadline }) {
  const goal = {
    id: generateId(),
    title: title.trim(),
    targetValue: Number(targetValue),
    currentValue: 0,
    unit: (unit ?? '').trim() || null,
    reward: (reward ?? '').trim() || null,
    xpReward: Number(xpReward) || 0,
    deadline: deadline || null,
    achievedAt: null,
    createdAt: new Date().toISOString()
  };
  await db.goals.add(goal);
  await enqueue('upsert', 'goals', goal.id, goal);
  return goal.id;
}

export async function updateGoal(id, changes) {
  await db.goals.update(id, changes);
  const goal = await db.goals.get(id);
  await enqueue('upsert', 'goals', id, goal);
}

export async function deleteGoal(id) {
  await db.goals.delete(id);
  await enqueue('delete', 'goals', id, null);
}
