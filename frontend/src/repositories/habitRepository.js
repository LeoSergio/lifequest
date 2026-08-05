import { liveQuery } from 'dexie';
import { db } from '../db/db.js';
import { generateId } from '../lib/id.js';
import { enqueue } from '../services/syncService.js';

// --- Queries reativas (retornam observables do Dexie) ---

export const allHabitsQuery = () => liveQuery(() => db.habits.toArray());

export const allCompletionsQuery = () => liveQuery(() => db.habitCompletions.toArray());

// --- Operações de escrita ---

export async function addHabit({ title, icon, cadence, weeklyTarget, xpReward = 10 }) {
  const habit = {
    id: generateId(),
    title: title.trim(),
    icon: (icon ?? '🔥').trim() || '🔥',
    cadence,
    weeklyTarget: cadence === 'weekly' ? Number(weeklyTarget) || 3 : null,
    xpReward,
    archivedAt: null,
    createdAt: new Date().toISOString()
  };
  await db.habits.add(habit);
  await enqueue('upsert', 'habits', habit.id, habit);
  return habit.id;
}

export async function archiveHabit(id) {
  const updated = { archivedAt: new Date().toISOString() };
  await db.habits.update(id, updated);
  const habit = await db.habits.get(id);
  await enqueue('upsert', 'habits', id, habit);
}

export async function deleteHabit(id) {
  await db.habits.delete(id);
  await enqueue('delete', 'habits', id, null);
}

export async function addCompletion(habitId, date) {
  const completion = { id: generateId(), habitId, date };
  await db.habitCompletions.add(completion);
  await enqueue('upsert', 'habitCompletions', completion.id, completion);
  return completion.id;
}
