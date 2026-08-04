<script>
  import { syncState } from '../lib/syncStore.js';
  import { pushSync, pullSync } from '../services/syncService.js';

  function manualSync() {
    pushSync().catch(() => {});
    pullSync().catch(() => {});
  }
</script>

<button
  on:click={manualSync}
  title="Clique para sincronizar manualmente"
  class="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-lg transition-all duration-300 active:scale-95 bg-[#1C1C22]/90 border-white/10 text-white/80 hover:bg-white/10"
>
  {#if $syncState.status === 'syncing'}
    <span class="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
    <span class="text-blue-400">Sincronizando...</span>
  {:else if $syncState.status === 'offline'}
    <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
    <span class="text-yellow-400/80">Offline</span>
  {:else if $syncState.status === 'error'}
    <span class="w-2 h-2 rounded-full bg-red-500"></span>
    <span class="text-red-400">Falha no sync</span>
  {:else if $syncState.pendingCount > 0}
    <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
    <span class="text-amber-300">{$syncState.pendingCount} pendente{$syncState.pendingCount > 1 ? 's' : ''}</span>
  {:else}
    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
    <span class="text-emerald-400/80">Nuvem ok</span>
  {/if}
</button>
