<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  
  const player = liveQuery(() => db.player.toCollection().first());
  const inventory = liveQuery(() => db.inventory.toArray());

  // Banco de dados falso dos itens da loja
  const storeItems = [
    {
      id: 'potion_freeze',
      name: 'Poção de Gelo',
      description: 'Congela seu Streak. Você não perde sua ofensiva se ficar 1 dia sem logar.',
      price: 50,
      icon: '❄️',
      category: 'consumable',
      color: 'text-blue-400',
      bg: 'bg-blue-400/10 border-blue-400/20'
    },
    {
      id: 'avatar_dragon',
      name: 'Avatar: Dragão Ancião',
      description: 'Um avatar exclusivo para impor respeito na Guilda.',
      price: 150,
      icon: '🐲',
      category: 'avatar',
      color: 'text-danger',
      bg: 'bg-danger/10 border-danger/20'
    },
    {
      id: 'avatar_ninja',
      name: 'Avatar: Ninja das Sombras',
      description: 'Para aqueles que treinam na calada da noite.',
      price: 150,
      icon: '🥷',
      category: 'avatar',
      color: 'text-gray-400',
      bg: 'bg-gray-400/10 border-gray-400/20'
    },
    {
      id: 'theme_blood',
      name: 'Tema: Sangue de Dragão',
      description: 'Muda a cor de destaque do aplicativo para um vermelho escarlate.',
      price: 300,
      icon: '🩸',
      category: 'theme',
      color: 'text-red-500',
      bg: 'bg-red-500/10 border-red-500/20'
    },
    {
      id: 'theme_nature',
      name: 'Tema: Floresta Élfica',
      description: 'Um verde suave e revigorante para o seu aplicativo.',
      price: 300,
      icon: '🌿',
      category: 'theme',
      color: 'text-green-500',
      bg: 'bg-green-500/10 border-green-500/20'
    }
  ];

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

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto flex flex-col gap-6">
  
  <!-- Header Loja -->
  <div class="px-2 mt-2">
    <div class="flex justify-between items-center mb-1">
      <h1 class="text-3xl font-black text-white tracking-tight flex items-center gap-2">
        <span class="text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">🏪</span> Loja
      </h1>
      <div class="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
        <span class="text-xl">💰</span>
        <span class="font-black text-yellow-500 text-lg">{$player?.coins || 0}</span>
      </div>
    </div>
    <p class="text-xs text-white/50">Gaste suas moedas em cosméticos e vantagens épicas.</p>
  </div>

  <div class="grid grid-cols-2 gap-3">
    {#each storeItems as item}
      <div class="bg-surface/80 border border-white/5 rounded-2xl p-3 flex flex-col relative overflow-hidden group hover:bg-surface transition-colors">
        
        <!-- Header: Ícone e Preço -->
        <div class="flex justify-between items-start mb-2">
          <div class="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 shadow-md {item.bg}">
            {item.icon}
          </div>
          
          {#if item.category !== 'consumable' && hasItem(item.id)}
             <span class="text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md uppercase">Comprado</span>
          {:else}
            <span class="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-yellow-500/20">
              {item.price} <span>💰</span>
            </span>
          {/if}
        </div>
        
        <!-- Detalhes -->
        <div class="flex-1 flex flex-col justify-start">
          <h3 class="font-bold text-white text-xs leading-tight mb-1">{item.name}</h3>
          <p class="text-[9px] text-white/50 leading-relaxed line-clamp-2 mb-3">{item.description}</p>
        </div>
        
        <!-- Botão -->
        {#if item.category === 'consumable' || !hasItem(item.id)}
          <button 
            on:click={() => buyItem(item)}
            class="w-full text-[10px] font-bold py-2 rounded-lg transition-all active:scale-95 {($player?.coins || 0) >= item.price ? 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20' : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'}"
          >
            {($player?.coins || 0) >= item.price ? 'Comprar' : 'Sem saldo'}
          </button>
        {:else}
           <button class="w-full text-[10px] font-bold py-2 rounded-lg bg-white/5 text-white/40 border border-white/10 cursor-default">
             Possui
           </button>
        {/if}
        
        <!-- Decoração de fundo -->
        <div class="absolute -right-4 -bottom-4 text-5xl opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-500">
          {item.icon}
        </div>
      </div>
    {/each}
  </div>

</main>
