import { db } from '../db/db.js';

// Variável para evitar que as mudanças vindas do backend entrem na fila de novo.
let isSyncing = false;

const SYNCABLE_TABLES = [
  'habits', 'habitCompletions', 'goals', 'dailyQuests', 
  'exercises', 'workoutPlans', 'workoutPlanExercises', 
  'workoutSessions', 'sessionSets', 'pantryItems', 
  'bodyMeasurements', 'inventory', 'unlockedAchievements'
];

/**
 * Registra os ganchos (Hooks) no Dexie para que qualquer tabela modificada
 * insira automaticamente um evento na syncQueue.
 */
export function setupSyncHooks() {
  SYNCABLE_TABLES.forEach(tableName => {
    db[tableName].hook('creating', function (primKey, obj, trans) {
      if (isSyncing) return;
      
      // Quando é um insert, o Dexie pode ainda não ter gerado o primKey se for ++id
      // Mas o hook passa primKey depois, ou injetamos
      // Usaremos o "onsuccess" do hook para garantir que temos o ID real gerado pelo banco.
      this.onsuccess = function (realKey) {
        db.syncQueue.add({
          entity: tableName,
          entityId: String(realKey),
          action: 'upsert',
          timestamp: new Date().toISOString(),
          payload: { ...obj, id: realKey }
        });
      };
    });

    db[tableName].hook('updating', function (mods, primKey, obj, trans) {
      if (isSyncing) return;
      const updatedObj = { ...obj, ...mods };
      this.onsuccess = function () {
        db.syncQueue.add({
          entity: tableName,
          entityId: String(primKey),
          action: 'upsert',
          timestamp: new Date().toISOString(),
          payload: updatedObj
        });
      };
    });

    db[tableName].hook('deleting', function (primKey, obj, trans) {
      if (isSyncing) return;
      this.onsuccess = function () {
        db.syncQueue.add({
          entity: tableName,
          entityId: String(primKey),
          action: 'delete',
          timestamp: new Date().toISOString()
        });
      };
    });
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
  if (!localStorage.getItem('access_token')) return; // Só sincroniza se estiver logado
  
  const pendingEvents = await db.syncQueue.toArray();
  if (pendingEvents.length === 0) return;

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/sync/push`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ events: pendingEvents })
    });

    if (response.ok) {
      // Se deu certo, deletamos os eventos da fila baseados nos IDs enviados
      const idsToDelete = pendingEvents.map(e => e.id);
      await db.syncQueue.bulkDelete(idsToDelete);
      console.log(`[Sync] Enviados ${pendingEvents.length} eventos para a nuvem.`);
    }
  } catch (err) {
    console.error('[Sync] Erro ao enviar eventos (modo offline?)', err);
  }
}

/**
 * Busca mudanças do backend (Pull)
 */
export async function pullSync() {
  if (!localStorage.getItem('access_token')) return;

  const lastSync = localStorage.getItem('last_sync_time') || "1970-01-01T00:00:00.000Z";

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/sync/pull?last_sync=${encodeURIComponent(lastSync)}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (response.ok) {
      const data = await response.json();
      const changes = data.changes;
      
      // Inicia a aplicação das mudanças com flag para ignorar os hooks locais
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
            // Remove o deleted para não poluir o Dexie que não usa isso
            delete record.deleted;
            // Upsert (Put sobrescreve se já existe, cria se não)
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
    console.error('[Sync] Erro ao buscar eventos da nuvem', err);
    isSyncing = false;
  }
}

/**
 * Inicia o worker que fica rodando em background
 */
export function startSyncWorker(intervalSeconds = 10) {
  // Configura os hooks antes de mais nada
  setupSyncHooks();

  setInterval(async () => {
    // Tenta primeiro puxar dados do servidor, depois empurrar dados
    await pullSync();
    await pushSync();
  }, intervalSeconds * 1000);
}
