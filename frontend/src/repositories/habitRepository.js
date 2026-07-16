/**
 * Repositório de hábitos — encapsula todo acesso ao IndexedDB (Dexie)
 * para as tabelas `habits` e `habitCompletions`.
 *
 * Os componentes Svelte e os services nunca importam `db` diretamente
 * para operações de hábito: passam por aqui. Isso garante que trocar
 * o Dexie por outra solução de persistência afete apenas este arquivo.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db.js';

// --- Queries reativas (retornam observables do Dexie) ---

export const allHabitsQuery = () => liveQuery(() => db.habits.toArray());

export const allCompletionsQuery = () => liveQuery(() => db.habitCompletions.toArray());

// --- Operações de escrita ---

export async function addHabit({ title, icon, cadence, weeklyTarget, xpReward = 10 }) {
  return db.habits.add({
    title: title.trim(),
    icon: (icon ?? '🔥').trim() || '🔥',
    cadence,
    weeklyTarget: cadence === 'weekly' ? Number(weeklyTarget) || 3 : null,
    xpReward,
    archivedAt: null,
    createdAt: new Date().toISOString()
  });
}

export async function archiveHabit(id) {
  return db.habits.update(id, { archivedAt: new Date().toISOString() });
}

export async function addCompletion(habitId, date) {
  return db.habitCompletions.add({ habitId, date });
}
