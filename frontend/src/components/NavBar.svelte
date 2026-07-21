<script>
  import { nav, navigate } from '../lib/nav.js';

  // "Escanear" saiu da barra: o scan de nota fiscal agora vive dentro da
  // própria tela de Despensa (ver routes/Pantry.svelte), então não faz
  // sentido ocupar uma aba própria só pra isso.
  // Métricas não é uma aba própria: ela é uma "sub-tela" de Treino,
  // acessada por um botão dentro da lista de treinos (ver Training.svelte)
  // — assim como "novo treino" também não tem aba própria.
  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Início', 
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' 
    },
    { 
      id: 'training', 
      label: 'Treinos', 
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6v12M19 6v12M2 9v6M22 9v6M5 12h14"/></svg>' 
    },
    { 
      id: 'pantry', 
      label: 'Dispensa', 
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v2h8V3zm-2 2h12v2H6zm1 2h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM9 11h6M9 15h6"/></svg>' 
    },
    { 
      id: 'habits', 
      label: 'Hábitos', 
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"/></svg>' 
    },
    { 
      id: 'goals',
      label: 'Métricas', 
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' 
    },
    {
      id: 'quests',
      label: 'Missões',
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
    }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-[#0f0f14] border-t border-white/5 flex px-2 z-50">
  {#each tabs as tab}
    <button
      class="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] transition-colors {$nav.name === tab.id ? 'text-primary' : 'text-white/40 hover:text-white/70'}"
      on:click={() => navigate(tab.id)}
    >
      <div class="[&>svg]:w-[22px] [&>svg]:h-[22px]">
        {@html tab.svg}
      </div>
      {tab.label}
    </button>
  {/each}
</nav>
