<script>
  import { currentRoute } from '../lib/nav.js';

  const tabs = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'pantry', label: 'Despensa', icon: '🥫' }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 flex">
  {#each tabs as tab}
    <button
      class="flex-1 flex flex-col items-center gap-1 py-3 text-xs {$currentRoute === tab.id ? 'text-primary' : 'text-white/40'}"
      on:click={() => currentRoute.set(tab.id)}
    >
      <span class="text-xl">{tab.icon}</span>
      {tab.label}
    </button>
  {/each}
</nav>
