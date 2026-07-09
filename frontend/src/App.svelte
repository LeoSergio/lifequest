<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';

  // Exemplo de uso do local-first: liveQuery reage a mudanças no IndexedDB
  const player = liveQuery(() => db.player.toArray());
</script>

<main class="min-h-screen p-6">
  <h1 class="text-2xl font-bold text-primary">LifeQuest</h1>
  <p class="text-sm text-white/60 mt-1">Dashboard — nível, XP, streak e missões do dia.</p>

  {#await $player}
    <p class="mt-4">Carregando...</p>
  {:then rows}
    <pre class="mt-4 text-xs bg-surface p-3 rounded">{JSON.stringify(rows, null, 2)}</pre>
  {/await}
</main>
