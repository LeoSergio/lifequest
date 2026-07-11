<script>
  import { nav, navigate } from '../lib/nav.js';

  // "Escanear" saiu da barra: o scan de nota fiscal agora vive dentro da
  // própria tela de Despensa (ver routes/Pantry.svelte), então não faz
  // sentido ocupar uma aba própria só pra isso.
  const tabs = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'pantry', label: 'Despensa', icon: '🥫' },
    { id: 'habits', label: 'Hábitos', icon: '✅' },
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
