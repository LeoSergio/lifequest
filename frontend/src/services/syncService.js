import { db } from '../db/db.js';

// Flag para evitar que mudanças vindas do backend entrem na fila de novo.
export let isSyncing = false;

const SYNCABLE_TABLES = [
  'player', 'habits', 'habitCompletions', 'goals', 'dailyQuests',
  'exercises', 'workoutPlans', 'workoutPlanExercises',
  'workoutSessions', 'sessionSets', 'pantryItems',
  'bodyMeasurements', 'inventory', 'unlockedAchievements'
];

/**
 * Adiciona um evento na fila de sync local.
 *
 * Chame isso diretamente nos repositórios após qualquer escrita no Dexie.
 * Não depende de hooks — é explícito e não tem problemas de timing.
 *
 * @param {'upsert'|'delete'} action
 * @param {string} entity  — nome da tabela (ex: 'habits', 'workoutPlans')
 * @param {string|number} entityId — ID do registro
 * @param {object|null} payload — objeto completo (obrigatório para upsert)
 */
export async function enqueue(action, entity, entityId, payload = null) {
  if (isSyncing) return; // Ignora mudanças vindas do pull
  if (!SYNCABLE_TABLES.includes(entity)) return;

  await db.syncQueue.add({
    entity,
    entityId: String(entityId),
    action,
    timestamp: new Date().toISOString(),
    ...(payload ? { payload: { ...payload, id: String(entityId) } } : {})
  });
}

/**
 * Retorna os headers de autenticação
 */
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

  const pendingEvents = await db.syncQueue.toArray();
  if (pendingEvents.length === 0) return;

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

      if (failedIds.size > 0) {
        console.warn(`[Sync] ${failedIds.size} evento(s) falharam e serão tentados novamente:`, [...failedIds]);
      }
    }
  } catch (err) {
    if (err instanceof TypeError || !navigator.onLine) return;
    console.error('[Sync] Erro inesperado no push:', err);
  }
}

/**
 * Busca mudanças do backend (Pull)
 */
export async function pullSync() {
  if (!localStorage.getItem('access_token')) return;

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
          const localId = isNaN(Number(record.id)) ? record.id : Number(record.id);

          if (record.deleted) {
            await db[table].delete(localId);
          } else {
            delete record.deleted;
            await db[table].put({ ...record, id: localId });
          }
        }
      }

      isSyncing = false;
      localStorage.setItem('last_sync_time', data.timestamp);

      if (totalChanges > 0) {
        console.log(`[Sync] Recebidas e aplicadas ${totalChanges} alterações da nuvem.`);
      }
    }
  } catch (err) {
    isSyncing = false;
    if (err instanceof TypeError || !navigator.onLine) return;
    console.error('[Sync] Erro inesperado no pull:', err);
  }
}

/**
 * Inicia o worker que fica rodando em background
 */
export function startSyncWorker(intervalSeconds = 10) {
  // Executa imediatamente ao iniciar
  (async () => {
    await pushSync();
    await pullSync();
  })();

  setInterval(async () => {
    await pushSync();
    await pullSync();
  }, intervalSeconds * 1000);
}
