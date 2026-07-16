/**
 * Repositório de metas — encapsula todo acesso à tabela `goals`.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db.js';

export const allGoalsQuery = () =>
  liveQuery(() => db.goals.orderBy('createdAt').reverse().toArray());

export async function addGoal({ title, targetValue, unit, reward, xpReward, deadline }) {
  return db.goals.add({
    title: title.trim(),
    targetValue: Number(targetValue),
    currentValue: 0,
    unit: (unit ?? '').trim() || null,
    reward: (reward ?? '').trim() || null,
    xpReward: Number(xpReward) || 0,
    deadline: deadline || null,
    achievedAt: null,
    createdAt: new Date().toISOString()
  });
}

export async function updateGoal(id, changes) {
  return db.goals.update(id, changes);
}
