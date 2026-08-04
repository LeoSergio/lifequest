import { writable } from 'svelte/store';
import { db } from '../db/db.js';
import { liveQuery } from 'dexie';

export const syncState = writable({
  status: 'idle', // 'idle' | 'syncing' | 'offline' | 'error'
  pendingCount: 0,
  lastSyncTime: localStorage.getItem('last_sync_time') || null
});

// Atualiza o contador de pendências em tempo real escutando o IndexedDB via liveQuery
if (typeof window !== 'undefined') {
  liveQuery(() => db.syncQueue.count()).subscribe((count) => {
    syncState.update((s) => ({ ...s, pendingCount: count ?? 0 }));
  });
}
