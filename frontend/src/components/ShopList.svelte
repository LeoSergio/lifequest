<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { pushSync, enqueue } from '../services/syncService.js';
  import { showAlert, showConfirm } from '../lib/modal.js';
  import { navigate } from '../lib/nav.js';
  import { isPro, showProBenefits } from '../lib/pro.js';
  
  const player = liveQuery(() => db.player.toCollection().first());
  const inventory = liveQuery(() => db.inventory.toArray());

  let selectedCategory = 'all';

  const categories = [
    { id: 'all', name: 'Todos' },
    { id: 'theme', name: 'Temas PRO' },
    { id: 'personality', name: 'Mascotes IA' },
    { id: 'status', name: 'Status & Boosts' },
    { id: 'consumable', name: 'Consumíveis' },
    { id: 'avatar', name: 'Avatares Básicos' }
  ];

  const storeItems = [
    // 🎨 Temas Visuais (Skins de Interface Premium)
    {
      id: 'theme_terminal',
      name: 'Tema: Terminal Syntax',
      description: 'Preto AMOLED, fonte monoespaçada e destaques em verde neon/turquesa.',
      price: 500,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
      category: 'theme',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30 hover:border-green-500/50',
      shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]'
    },
    {
      id: 'theme_gold',
      name: 'Tema: Olimpia Gold',
      description: 'O ápice do status. Fundo chumbo com botões e gráficos em dourado metálico.',
      price: 1000,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      category: 'theme',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30 hover:border-yellow-500/50',
      shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]'
    },
    {
      id: 'theme_matrix',
      name: 'Tema: Data Matrix',
      description: 'Interface super técnica com tons de verde escuro e fluorescente.',
      price: 600,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
      category: 'theme',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
    },
    {
      id: 'theme_arctic',
      name: 'Tema: Minimalista Ártico',
      description: 'Light Mode exclusivo. Branco neve e botões em azul gelo.',
      price: 500,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5l-5 5-5-5M19 12H5M17 19l-5-5-5 5"/></svg>',
      category: 'theme',
      color: 'text-blue-300',
      bg: 'bg-blue-300/10',
      border: 'border-blue-300/30 hover:border-blue-300/50',
      shadow: 'shadow-[0_0_15px_rgba(147,197,253,0.15)]'
    },

    // 🤖 Mascotes e Personalidades (IA)
    {
      id: 'ia_pinguim',
      name: 'IA: Pinguim de Aço',
      description: 'Instruções otimizadas e sem rodeios. "Consuma o frango."',
      price: 800,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4.42 0-8 3.58-8 8v8c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4v-8c0-4.42-3.58-8-8-8zm-2 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
      category: 'personality',
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/30 hover:border-blue-400/50',
      shadow: 'shadow-[0_0_15px_rgba(96,165,250,0.15)]'
    },
    {
      id: 'ia_espartana',
      name: 'IA: Mestre Espartana',
      description: 'Tom militar hardcore com broncas motivacionais.',
      price: 800,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13.5h-13L12 6.5zM11 11h2v4h-2v-4zm0 6h2v2h-2v-2z"/></svg>',
      category: 'personality',
      color: 'text-red-600',
      bg: 'bg-red-600/10',
      border: 'border-red-600/30 hover:border-red-600/50',
      shadow: 'shadow-[0_0_15px_rgba(220,38,38,0.15)]'
    },
    {
      id: 'ia_zen',
      name: 'IA: Nutri Zen',
      description: 'Focado em saúde mental, recuperação e chás calmantes.',
      price: 700,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 00-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0012 2zm0 18c-4.41 0-8-3.59-8-8 0-4.41 3.59-8 8-8s8 3.59 8 8c0 4.41-3.59 8-8 8zm1-13h-2v4H7v2h4v4h2v-4h4v-2h-4V7z"/></svg>',
      category: 'personality',
      color: 'text-teal-400',
      bg: 'bg-teal-400/10',
      border: 'border-teal-400/30 hover:border-teal-400/50',
      shadow: 'shadow-[0_0_15px_rgba(45,212,191,0.15)]'
    },
    {
      id: 'ia_nerd',
      name: 'IA: Cientista Louco',
      description: 'Explica o porquê das coisas com detalhes de síntese proteica e insulina.',
      price: 750,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v4M15 2v4M12 12v6M9 18h6M5 10a7 7 0 1014 0c0-3.87-3.13-7-7-7S5 6.13 5 10z"/></svg>',
      category: 'personality',
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/30 hover:border-purple-400/50',
      shadow: 'shadow-[0_0_15px_rgba(192,132,252,0.15)]'
    },

    // 👑 Itens de Status (Boosts)
    {
      id: 'status_dashboard',
      name: 'Painel: Ciência de Dados',
      description: 'Desbloqueia mapas de dispersão e modelos preditivos avançados.',
      price: 1500,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>',
      category: 'status',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30 hover:border-orange-500/50',
      shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]'
    },
    {
      id: 'status_titan',
      name: 'Emblema: Titan Animado',
      description: 'Borda de avatar cintilante para o futuro placar de líderes.',
      price: 2000,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15l-4.24 4.24 1.41 1.41L12 17.83l2.83 2.82 1.41-1.41L12 15zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
      category: 'status',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/30 hover:border-yellow-400/50',
      shadow: 'shadow-[0_0_15px_rgba(250,204,21,0.15)]'
    },
    {
      id: 'status_dump',
      name: 'Módulo: Exportação Master',
      description: 'Cofre para baixar todo histórico em JSON/CSV limpo.',
      price: 1200,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
      category: 'status',
      color: 'text-gray-300',
      bg: 'bg-gray-300/10',
      border: 'border-gray-300/30 hover:border-gray-300/50',
      shadow: 'shadow-[0_0_15px_rgba(209,213,219,0.15)]'
    },
    {
      id: 'status_sound',
      name: 'Efeito FX: Heavy Metal',
      description: 'Substitui o PLIN por guitarras e anilhas pesadas ao bater PR.',
      price: 800,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13M9 18a3 3 0 10-6 0 3 3 0 006 0zm12-2a3 3 0 10-6 0 3 3 0 006 0z"/></svg>',
      category: 'status',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30 hover:border-red-500/50',
      shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]'
    },

    // Itens Antigos
    {
      id: 'potion_freeze',
      name: 'Poção de Gelo',
      description: 'Congela seu streak por 1 dia sem perder a ofensiva.',
      price: 50,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      category: 'consumable',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30 hover:border-blue-500/50',
      shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
    },
    {
      id: 'avatar_dragon',
      name: 'Avatar: Dragão Ancião',
      description: 'Um avatar exclusivo para impor respeito na Guilda.',
      price: 150,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      category: 'avatar',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30 hover:border-yellow-500/50',
      shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]'
    },
    {
      id: 'avatar_ninja',
      name: 'Avatar: Ninja das Sombras',
      description: 'Para quem treina na calada da noite.',
      price: 150,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      category: 'avatar',
      color: 'text-[#9333EA]',
      bg: 'bg-[#9333EA]/10',
      border: 'border-[#9333EA]/30 hover:border-[#9333EA]/50',
      shadow: 'shadow-[0_0_15px_rgba(147,51,234,0.15)]'
    }
  ];

  $: filteredItems = selectedCategory === 'all' 
    ? storeItems 
    : storeItems.filter(item => item.category === selectedCategory);

  import { updatePlayer } from '../repositories/playerRepository.js';

  async function buyItem(item) {
    if (!$player) return;
    
    // Verifica se já comprou o cosmético (não deixa comprar duas vezes)
    if (item.category !== 'consumable') {
      const alreadyOwns = $inventory.some(i => i.itemId === item.id);
      if (alreadyOwns) {
        await showAlert({
          title: 'Item já adquirido',
          message: `Você já possui "${item.name}" no seu inventário.`,
          icon: '✅',
          type: 'info',
          confirmText: 'Entendi',
        });
        return;
      }
    }

    const isPro = ['theme', 'personality', 'status'].includes(item.category);
    const currencyType = isPro ? 'proCoins' : 'coins';
    const currencyName = isPro ? 'Moedas PRO' : 'LifeCoins';
    
    const currentBalance = $player[currencyType] || 0;
    
    if (currentBalance < item.price) {
      if (isPro) {
        const wantsToBuyPro = await showConfirm({
          title: 'Saldo insuficiente',
          message: `Você não tem ${currencyName} suficientes! Faltam ${item.price - currentBalance} moedas.\n\nDeseja adquirir mais Moedas PRO ou assinar o LifeQuest Premium?`,
          icon: '💎',
          type: 'warning',
          confirmText: 'Adquirir PRO',
          cancelText: 'Cancelar',
        });
        if (wantsToBuyPro) {
          showAlert({ title: 'Em breve!', message: 'Redirecionando para a página de pagamento...', icon: '💳', type: 'info' });
        }
      } else {
        showAlert({
          title: 'Saldo insuficiente',
          message: `Você não tem ${currencyName} suficientes! Faltam ${item.price - currentBalance} moedas.\nComplete missões para ganhar mais!`,
          icon: '💰',
          type: 'warning',
          confirmText: 'Entendi',
        });
      }
      return;
    }

    const confirmBuy = await showConfirm({
      title: `Comprar ${item.name}?`,
      message: `Essa compra custará ${item.price} ${currencyName} do seu saldo.`,
      icon: '🛒',
      type: 'default',
      confirmText: `Comprar por ${item.price}`,
      cancelText: 'Cancelar',
    });
    if (!confirmBuy) return;

    // Deduz moedas usando updatePlayer (que enfileira sync)
    await updatePlayer($player.id, { [currencyType]: currentBalance - item.price });
    
    // Adiciona ao inventário
    const invItem = {
      id: generateId(),
      itemId: item.id,
      category: item.category,
      name: item.name,
      purchasedAt: new Date().toISOString()
    };
    await db.inventory.add(invItem);
    await enqueue('upsert', 'inventory', invItem.id, invItem);

    // Push imediato: coins e item vão para a nuvem agora
    pushSync().catch(() => {});

    showAlert({
      title: 'Compra realizada! 🎉',
      message: `Você adquiriu: ${item.name}`,
      icon: '🚀',
      type: 'success',
      confirmText: 'Incrivel!',
    });
  }

  function getCurrency(category) {
    return ['theme', 'personality', 'status'].includes(category) ? 'proCoins' : 'coins';
  }

  function getBalance(category) {
    return $player?.[getCurrency(category)] || 0;
  }
  
  function hasItem(itemId) {
    if (!$inventory) return false;
    return $inventory.some(i => i.itemId === itemId);
  }
</script>

<div class="flex flex-col gap-5">
  
  {#if $player && !isPro($player)}
    <!-- Lembrete PRO -->
    <div class="bg-gradient-to-r from-[#2D1B4E] to-[#1C1C22] border border-[#a855f7]/40 rounded-[16px] p-3 flex items-center justify-between cursor-pointer hover:border-[#a855f7] transition-colors shadow-[0_0_15px_rgba(168,85,247,0.1)] mx-1" on:click={showProBenefits}>
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
        <div>
          <p class="text-[11px] font-bold text-white leading-tight">Ganhe Pro Coins Mensais!</p>
          <p class="text-[9px] text-white/50">Assine o PRO e ganhe moedas premium todo mês.</p>
        </div>
      </div>
      <span class="text-[10px] text-[#a855f7] font-bold">Ver mais ›</span>
    </div>
  {/if}

  <div class="px-1 flex justify-between items-center mb-2 mt-1">
    <div class="flex gap-2">
      <!-- LifeCoins Comuns -->
      <div class="bg-[#1C1C22]/80 border border-white/5 px-3 py-1.5 rounded-[12px] flex items-center gap-1.5 shadow-inner">
        <span class="text-[14px]">🪙</span>
        <span class="font-bold text-yellow-500 text-[12px]">{$player?.coins || 0} <span class="hidden sm:inline">LifeCoins</span></span>
      </div>
      <!-- Moedas PRO -->
      <div class="bg-[#1C1C22]/80 border border-purple-500/20 px-3 py-1.5 rounded-[12px] flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
        <span class="text-[14px]">💎</span>
        <span class="font-bold text-[#a855f7] text-[12px]">{$player?.proCoins || 0} <span class="hidden sm:inline">PRO</span></span>
      </div>
    </div>
    
    <button on:click={() => showAlert({ title: 'Em breve!', message: 'Checkout para adquirir Moedas PRO ou Assinatura Premium.', icon: '💳', type: 'info', confirmText: 'Entendi' })} class="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-[12px] transition-all shadow-[0_0_10px_rgba(168,85,247,0.3)]">
      + Adquirir PRO
    </button>
  </div>

  <!-- Filtros de Categoria -->
  <div class="flex overflow-x-auto gap-2 px-1 mb-3 pb-1 -mx-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {#each categories as cat}
      <button
        on:click={() => selectedCategory = cat.id}
        class="shrink-0 snap-start px-4 py-2 rounded-full font-bold text-[12px] whitespace-nowrap transition-all
          {selectedCategory === cat.id
            ? 'bg-[#9333EA] text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
            : 'bg-transparent border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'}"
      >
        {cat.name}
      </button>
    {/each}
  </div>

  <div class="grid grid-cols-2 gap-3 px-1">
    {#each filteredItems as item}
      <div class="bg-[#1C1C22]/80 backdrop-blur-md rounded-[28px] p-4 flex flex-col relative overflow-hidden transition-all {item.border} {item.shadow} hover:scale-[1.02]">
        
        <!-- Header: Ícone e Preço -->
        <div class="flex justify-between items-start mb-4">
          <div class="w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 shadow-inner {item.bg} {item.color} border border-white/5">
            {@html item.icon}
          </div>
          
          {#if item.category !== 'consumable' && hasItem(item.id)}
             <span class="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-lg uppercase">Comprado</span>
          {:else}
            <div class="bg-black/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
              {#if getCurrency(item.category) === 'proCoins'}
                 <div class="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                 <span class="text-[11px] font-black text-purple-400">{item.price}</span>
              {:else}
                 <div class="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                 <span class="text-[11px] font-black text-slate-300">{item.price}</span>
              {/if}
            </div>
          {/if}
        </div>
        
        <!-- Detalhes -->
        <div class="flex-1 flex flex-col justify-start mb-4">
          <h3 class="font-bold text-white text-[13px] leading-tight mb-2">{item.name}</h3>
          <p class="text-[11px] text-white/40 leading-relaxed">{item.description}</p>
        </div>
        
        <!-- Botão -->
        {#if item.category === 'consumable' || !hasItem(item.id)}
          <button 
            on:click={() => buyItem(item)}
            class="w-full text-[12px] font-bold py-3 rounded-[16px] transition-all active:scale-95 {getBalance(item.category) >= item.price ? (getCurrency(item.category) === 'proCoins' ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-slate-300 text-black hover:bg-white shadow-[0_0_15px_rgba(203,213,225,0.3)]') : 'bg-transparent text-white/30 cursor-not-allowed border border-white/10'}"
          >
            {getBalance(item.category) >= item.price ? 'Comprar' : 'Sem saldo'}
          </button>
        {:else}
           <button class="w-full text-[12px] font-bold py-3 rounded-[16px] bg-white/5 text-white/40 border border-white/10 cursor-default">
             Possui
           </button>
        {/if}
      </div>
    {/each}
  </div>
</div>
