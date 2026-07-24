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
      label: 'Rotina',
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>'
    },

    {
      id: 'quests',
      label: 'Missões',
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>'
    },
    {
      id: 'shop',
      label: 'Loja',
      svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
    }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-[#0f0f14]/95 backdrop-blur-md border-t border-white/5 flex px-2 z-50">
  {#each tabs as tab}
    {@const isActive = $nav.name === tab.id}
    <button
      class="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-[10px] transition-all relative {isActive ? 'text-[#a855f7] font-bold' : 'text-white/40 hover:text-white/70 font-medium'}"
      on:click={() => navigate(tab.id)}
    >
      {#if isActive}
        <!-- Radial glow behind the active icon -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#a855f7]/20 rounded-full blur-md pointer-events-none"></div>
      {/if}
      <div class="relative z-10 [&>svg]:w-[22px] [&>svg]:h-[22px] transition-transform {isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] [&>svg]:fill-current' : ''}">
        {@html tab.svg}
      </div>
      <span class="relative z-10 tracking-wide">{tab.label}</span>
    </button>
  {/each}
</nav>
