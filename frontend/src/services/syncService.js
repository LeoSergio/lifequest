import { db } from '../db/db.js';
import { syncState } from '../lib/syncStore.js';

// Flag para evitar que mudanças vindas do backend entrem na fila de novo.
export let isSyncing = false;

const SYNCABLE_TABLES = [
  'player', 'habits', 'habitCompletions', 'goals', 'dailyQuests',
  'exercises', 'workoutPlans', 'workoutPlanExercises',
  'workoutSessions', 'sessionSets', 'pantryItems',
  'bodyMeasurements', 'inventory', 'unlockedAchievements'
];

/**
 * Converte uma chave snake_case para camelCase.
 * Ex: "workout_plan_id" → "workoutPlanId"
 */
function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Normaliza valores de ID (se for numérico string "123", converte para Number 123
 * para bater com os auto-increments do Dexie ++id; se for UUID string, mantém string).
 */
function normalizeIdValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return isNaN(Number(val)) ? val : Number(val);
  }
  return val;
}

/**
 * Converte todas as chaves de um objeto de snake_case para camelCase e normaliza IDs.
 */
function convertKeysToCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      const camelKey = snakeToCamel(k);
      const isIdField = camelKey === 'id' || camelKey.endsWith('Id');
      return [camelKey, isIdField ? normalizeIdValue(v) : v];
    })
  );
}

/**
 * Adiciona um evento na fila de sync local.
 */
export async function enqueue(action, entity, entityId, payload = null) {
  if (isSyncing) return;
  if (!SYNCABLE_TABLES.includes(entity)) return;

  await db.syncQueue.add({
    entity,
    entityId: String(entityId),
    action,
    timestamp: new Date().toISOString(),
    ...(payload ? { payload: { ...payload, id: String(entityId) } } : {})
  });
}

function getHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Envia tudo que está na fila (Push)
 */
export async function pushSync() {
  if (!localStorage.getItem('access_token')) return;
  if (!navigator.onLine) {
    syncState.update(s => ({ ...s, status: 'offline' }));
    return;
  }

  const pendingEvents = await db.syncQueue.toArray();
  if (pendingEvents.length === 0) return;

  syncState.update(s => ({ ...s, status: 'syncing' }));

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/sync/push`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ events: pendingEvents })
    });

    if (response.ok) {
      const data = await response.json();
      const failedIds = new Set(data.failed_events || []);

      const idsToDelete = pendingEvents
        .map(e => e.id)
        .filter(id => !failedIds.has(id));

      await db.syncQueue.bulkDelete(idsToDelete);
      console.log(`[Sync] Enviados ${idsToDelete.length}/${pendingEvents.length} eventos para a nuvem.`);
      syncState.update(s => ({ ...s, status: 'idle' }));
    } else {
      syncState.update(s => ({ ...s, status: 'error' }));
    }
  } catch (err) {
    if (err instanceof TypeError || !navigator.onLine) {
      syncState.update(s => ({ ...s, status: 'offline' }));
      return;
    }
    syncState.update(s => ({ ...s, status: 'error' }));
    console.error('[Sync] Erro inesperado no push:', err);
  }
}

/**
 * Busca mudanças do backend (Pull)
 */
export async function pullSync() {
  if (!localStorage.getItem('access_token')) return;
  if (!navigator.onLine) {
    syncState.update(s => ({ ...s, status: 'offline' }));
    return;
  }

  const lastSync = localStorage.getItem('last_sync_time') || '1970-01-01T00:00:00.000Z';

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/sync/pull?last_sync=${encodeURIComponent(lastSync)}`,
      { method: 'GET', headers: getHeaders() }
    );

    if (response.ok) {
      const data = await response.json();
      const changes = data.changes;

      isSyncing = true;
      let totalChanges = 0;

      for (const [table, records] of Object.entries(changes)) {
        if (!SYNCABLE_TABLES.includes(table)) continue;

        for (const record of records) {
          totalChanges++;
          const camelRecord = convertKeysToCamel(record);
          const localId = camelRecord.id;

          if (camelRecord.deleted) {
            await db[table].delete(localId);
          } else {
            delete camelRecord.deleted;
            const existing = await db[table].get(localId);
            if (existing) {
              await db[table].update(localId, camelRecord);
            } else {
              await db[table].put(camelRecord);
            }
          }
        }
      }

      isSyncing = false;
      localStorage.setItem('last_sync_time', data.timestamp);
      syncState.update(s => ({ ...s, status: 'idle', lastSyncTime: data.timestamp }));

      if (totalChanges > 0) {
        console.log(`[Sync] Recebidas e aplicadas ${totalChanges} alterações da nuvem.`);
      }
    } else {
      syncState.update(s => ({ ...s, status: 'error' }));
    }
  } catch (err) {
    isSyncing = false;
    if (err instanceof TypeError || !navigator.onLine) {
      syncState.update(s => ({ ...s, status: 'offline' }));
      return;
    }
    syncState.update(s => ({ ...s, status: 'error' }));
    console.error('[Sync] Erro inesperado no pull:', err);
  }
}

/**
 * Inicia o worker que fica rodando em background
 */
export function startSyncWorker(intervalSeconds = 10) {
  (async () => {
    await pushSync();
    await pullSync();
  })();

  setInterval(async () => {
    await pushSync();
    await pullSync();
  }, intervalSeconds * 1000);
}
