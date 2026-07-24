<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  
  const player = liveQuery(() => db.player.toCollection().first());
  const inventory = liveQuery(() => db.inventory.toArray());

  let selectedCategory = 'all';

  const categories = [
    { id: 'all', name: 'Todos' },
    { id: 'consumable', name: 'Consumíveis' },
    { id: 'avatar', name: 'Avatares' },
    { id: 'theme', name: 'Temas' }
  ];

  const storeItems = [
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
    },
    {
      id: 'theme_blood',
      name: 'Tema: Esmeralda',
      description: 'Muda a cor de destaque do app para um verde vibrante.',
      price: 300,
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c0 0-8 7.33-8 13.5A8.5 8.5 0 0 0 12 24a8.5 8.5 0 0 0 8-8.5C20 9.33 12 2 12 2z"/></svg>',
      category: 'theme',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
    }
  ];

  $: filteredItems = selectedCategory === 'all' 
    ? storeItems 
    : storeItems.filter(item => item.category === selectedCategory);

  async function buyItem(item) {
    if (!$player) return;
    
    // Verifica se já comprou o cosmético (não deixa comprar duas vezes)
    if (item.category !== 'consumable') {
      const alreadyOwns = $inventory.some(i => i.itemId === item.id);
      if (alreadyOwns) {
        alert('Você já possui este item!');
        return;
      }
    }

    const currentCoins = $player.coins || 0;
    
    if (currentCoins < item.price) {
      alert(`Você não tem LifeCoins suficientes! Faltam ${item.price - currentCoins} moedas.`);
      return;
    }

    const confirmBuy = confirm(`Deseja comprar "${item.name}" por ${item.price} LifeCoins?`);
    if (!confirmBuy) return;

    // Deduz moedas
    await db.player.update($player.id, { coins: currentCoins - item.price });
    
    // Adiciona ao inventário
    await db.inventory.add({
      itemId: item.id,
      category: item.category,
      name: item.name,
      purchasedAt: new Date().toISOString()
    });

    alert(`🎉 Compra realizada com sucesso! Você adquiriu: ${item.name}`);
  }
  
  function hasItem(itemId) {
    if (!$inventory) return false;
    return $inventory.some(i => i.itemId === itemId);
  }
</script>

<div class="flex flex-col gap-5">
  
  <div class="px-1 flex justify-between items-center mb-1">
    <div class="bg-[#1C1C22]/80 border border-white/5 px-4 py-2 rounded-[20px] flex items-center gap-2 shadow-inner">
      <div class="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
      <span class="font-bold text-yellow-500 text-[13px]">{$player?.coins || 0} LifeCoins</span>
    </div>
  </div>

  <!-- Filtros de Categoria -->
  <div class="flex flex-wrap gap-2 px-1 mb-2">
    {#each categories as cat}
      <button 
        on:click={() => selectedCategory = cat.id}
        class="px-4 py-2 rounded-full font-bold text-[12px] transition-all {selectedCategory === cat.id ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-transparent border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'}"
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
            <div class="bg-black/30 px-2.5 py-1 rounded-lg flex items-center">
              <span class="text-[11px] font-black text-yellow-500">{item.price}</span>
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
            class="w-full text-[12px] font-bold py-3 rounded-[16px] transition-all active:scale-95 {($player?.coins || 0) >= item.price ? 'bg-[#9333EA] text-black hover:bg-[#9333EA]/90 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-transparent text-white/30 cursor-not-allowed border border-white/10'}"
          >
            {($player?.coins || 0) >= item.price ? 'Comprar' : 'Sem saldo'}
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
