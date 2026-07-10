<script>
  import { nav, navigate } from '../lib/nav.js';

  const tabs = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'pantry', label: 'Despensa', icon: '🥫' },
    { id: 'scan', label: 'Escanear', icon: '📷' },
    { id: 'training', label: 'Treino', icon: '💪' }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 flex">
  {#each tabs as tab}
    <button
      class="flex-1 flex flex-col items-center gap-1 py-3 text-xs {$nav.name === tab.id ? 'text-primary' : 'text-white/40'}"
      on:click={() => navigate(tab.id)}
    >
      <span class="text-xl">{tab.icon}</span>
      {tab.label}
    </button>
  {/each}
</nav>
