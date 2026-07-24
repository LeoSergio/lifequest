<script>
  import { onMount } from 'svelte';
  import { PANTRY_CATEGORIES } from '../lib/constants.js';
  import { extractItemCandidates } from '../lib/receiptParser.js';
  import { pantryItemsQuery, addPantryItem, bulkAddPantryItems, removePantryItem } from '../repositories/pantryRepository.js';
  import { getPlayer } from '../repositories/playerRepository.js';
  import { suggestMeals } from '../services/mealAiService.js';
  import { db } from '../db/db.js';
  import Tesseract from 'tesseract.js';

  let name = '';
  let category = PANTRY_CATEGORIES[0];
  let quantity = '';

  let scanStatus = 'idle';
  let scanProgress = 0;
  let candidates = [];
  let scanError = null;
  let cameraInput;
  let galleryInput;

  const MEAL_TYPES = [
    { id: 'cafe_manha', label: 'Café da manhã', emoji: '🌅' },
    { id: 'almoco',     label: 'Almoço',        emoji: '🍽️' },
    { id: 'lanche',     label: 'Lanche',         emoji: '🥪' },
    { id: 'janta',      label: 'Janta',          emoji: '🌙' }
  ];

  let selectedMealType = null;
  let aiStatus = 'idle';
  let aiSuggestions = [];
  let aiError = null;
  let todaysWorkoutName = null;
  let playerGoal = 'manutencao';
  let showCustomRequest = false;
  let userRequest = '';

  const items = pantryItemsQuery();
  $: grouped = groupByCategory($items ?? []);

  onMount(async () => {
    const player = await getPlayer();
    if (player?.goal) playerGoal = player.goal;
    const today = new Date().toISOString().slice(0, 10);
    const sessions = await db.workoutSessions.toArray();
    const todaySession = sessions.find(s => s.finishedAt?.slice(0, 10) === today);
    if (todaySession) {
      const plan = await db.workoutPlans.get(todaySession.workoutPlanId);
      todaysWorkoutName = plan?.name ?? null;
    }
  });

  function groupByCategory(list) {
    const map = {};
    for (const c of PANTRY_CATEGORIES) map[c] = [];
    for (const item of list) {
      (map[item.category] ??= []).push(item);
    }
    return map;
  }

  async function handleAddItem() {
    if (!name.trim()) return;
    await addPantryItem({ name, category, quantity });
    name = '';
    quantity = '';
  }

  async function handleRemoveItem(id) {
    await removePantryItem(id);
  }

  async function handleClearPantry() {
    if (!confirm('Tem certeza que quer limpar toda a dispensa?')) return;
    await db.pantryItems.clear();
  }

  async function handleScanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    scanStatus = 'processing';
    scanProgress = 0;
    scanError = null;
    try {
      const { data } = await Tesseract.recognize(file, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') scanProgress = Math.round(m.progress * 100);
        }
      });
      const found = extractItemCandidates(data.text);
      candidates = found.map((n) => ({
        name: n,
        category: PANTRY_CATEGORIES[PANTRY_CATEGORIES.length - 1],
        checked: true
      }));
      scanStatus = 'review';
    } catch (e) {
      console.error(e);
      scanError = 'Não consegui ler essa imagem. Tenta uma foto mais nítida e com boa luz.';
      scanStatus = 'idle';
    } finally {
      event.target.value = '';
    }
  }

  async function confirmScan() {
    const toAdd = candidates.filter((c) => c.checked && c.name.trim());
    await bulkAddPantryItems(toAdd);
    resetScan();
  }

  function resetScan() {
    scanStatus = 'idle';
    candidates = [];
    scanProgress = 0;
    scanError = null;
  }

  async function handleAskAI(mealTypeId, customRequest = null) {
    selectedMealType = mealTypeId;
    aiStatus = 'loading';
    aiSuggestions = [];
    aiError = null;
    showCustomRequest = false;
    try {
      const result = await suggestMeals({
        pantryItems: $items ?? [],
        mealType: mealTypeId ?? 'geral',
        goal: playerGoal,
        calorieTarget: null,
        todaysWorkout: todaysWorkoutName,
        userRequest: customRequest
      });
      aiSuggestions = result.suggestions ?? [];
      aiStatus = 'done';
    } catch (e) {
      console.error(e);
      aiError = 'Erro ao consultar IA. Verifique sua conexão.';
      aiStatus = 'error';
    }
  }

  async function handleCustomRequest() {
    if (!userRequest.trim()) return;
    await handleAskAI(selectedMealType ?? 'geral', userRequest.trim());
    userRequest = '';
  }
</script>

<!-- Bloco IA Premium -->
<div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 mb-6 shadow-inner relative overflow-hidden">
  <div class="absolute top-0 right-0 w-32 h-32 bg-[#9333EA]/20 blur-3xl rounded-full pointer-events-none"></div>

  <div class="flex items-start gap-3 mb-4 relative z-10">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(250,204,21,0.3)]">
      <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2zM21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
    </div>
    <div>
      <h2 class="text-[13px] font-bold text-white leading-tight">Receitas da Nutricionista IA</h2>
      <p class="text-[9px] text-white/50 mt-0.5 leading-relaxed">
        Baseadas na sua dispensa atual{todaysWorkoutName ? ` e no seu treino (${todaysWorkoutName})` : ''}.
      </p>
    </div>
  </div>

  <div class="grid grid-cols-4 gap-2 mb-4 relative z-10">
    {#each MEAL_TYPES as mt}
      <button
        class="py-3 rounded-[12px] border flex flex-col items-center gap-1.5 transition-all {selectedMealType === mt.id && aiStatus !== 'idle' ? 'bg-[#9333EA]/20 border-[#a855f7]/50 text-white shadow-inner' : 'bg-[#1C1C22]/50 border-white/5 text-white/40 hover:bg-white/5 hover:text-white/60'}"
        on:click={() => handleAskAI(mt.id)}
        disabled={aiStatus === 'loading'}
      >
        <span class="text-xl filter drop-shadow-md">{mt.emoji}</span>
        <span class="text-[9px] font-bold leading-none">{mt.label}</span>
      </button>
    {/each}
  </div>

  {#if aiStatus === 'loading'}
    <div class="flex flex-col items-center justify-center py-6 gap-3">
      <div class="w-6 h-6 border-[3px] border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
      <span class="text-[10px] text-white/50 font-medium">Analisando dispensa e objetivos...</span>
    </div>
  {:else if aiStatus === 'error'}
    <p class="text-[10px] text-red-400 font-medium text-center py-2">{aiError}</p>
  {:else if aiStatus === 'done' && aiSuggestions.length > 0}
    <div class="flex flex-col gap-3">
      {#each aiSuggestions as suggestion, i}
        <div class="bg-[#1C1C22]/50 rounded-[16px] p-4 border border-white/5 shadow-inner">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-[12px] text-white pr-2 leading-tight">{suggestion.title}</h3>
            <span class="shrink-0 text-[9px] font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md">OPÇÃO {i+1}</span>
          </div>
          <p class="text-[10px] text-white/50 mb-4 leading-relaxed">{suggestion.description}</p>

          <div class="flex gap-2 mb-4">
            <div class="flex-1 bg-white/5 rounded-[10px] py-2 flex flex-col items-center justify-center">
              <span class="text-[#a855f7] text-[11px] font-black leading-none">{suggestion.estimated_calories}</span>
              <span class="text-[7px] uppercase tracking-wider text-white/40 mt-1">kcal</span>
            </div>
            <div class="flex-1 bg-white/5 rounded-[10px] py-2 flex flex-col items-center justify-center">
              <span class="text-blue-400 text-[11px] font-black leading-none">{suggestion.protein_g}g</span>
              <span class="text-[7px] uppercase tracking-wider text-white/40 mt-1">proteína</span>
            </div>
            <div class="flex-1 bg-white/5 rounded-[10px] py-2 flex flex-col items-center justify-center">
              <span class="text-emerald-400 text-[11px] font-black leading-none">{suggestion.prep_time_min}m</span>
              <span class="text-[7px] uppercase tracking-wider text-white/40 mt-1">preparo</span>
            </div>
          </div>

          {#if suggestion.ingredients_used?.length > 0}
            <div class="mb-3">
              <p class="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1">
                 <svg class="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Na dispensa
              </p>
              <div class="flex flex-wrap gap-1.5">
                {#each suggestion.ingredients_used as ing}
                  <span class="text-[9px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-[6px] font-medium">{ing}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if suggestion.ingredients_to_buy?.length > 0}
            <div>
              <p class="text-[8px] text-white/30 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1">
                 <svg class="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> Comprar
              </p>
              <div class="flex flex-wrap gap-1.5">
                {#each suggestion.ingredients_to_buy as ing}
                  <span class="text-[9px] bg-white/5 border border-white/10 text-white/50 px-2 py-0.5 rounded-[6px] font-medium">{ing}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if aiStatus === 'done' || aiStatus === 'error'}
    <div class="mt-4 pt-4 border-t border-white/5">
      {#if !showCustomRequest}
        <button
          class="w-full bg-[#1C1C22]/80 border border-white/10 text-white/60 rounded-[12px] py-2.5 text-[11px] font-bold hover:bg-white/5 hover:text-white transition-colors flex justify-center items-center gap-2 shadow-inner"
          on:click={() => showCustomRequest = true}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> 
          Quero algo diferente...
        </button>
      {:else}
        <div class="flex flex-col gap-2">
          <textarea
            class="w-full bg-[#1C1C22]/80 border border-[#a855f7]/30 rounded-[12px] px-3 py-2 text-[11px] text-white focus:border-[#a855f7] outline-none resize-none transition-colors placeholder:text-white/30 shadow-inner"
            rows="2"
            placeholder="Ex: algo bem leve com os ovos que tenho, para dormir bem..."
            bind:value={userRequest}
            on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCustomRequest())}
          ></textarea>
          <div class="flex gap-2">
            <button
              class="w-1/3 bg-white/5 border border-white/10 text-white/50 rounded-[10px] py-2 text-[10px] font-bold hover:bg-white/10 transition-colors"
              on:click={() => { showCustomRequest = false; userRequest = ''; }}
            >
              Cancelar
            </button>
            <button
              class="flex-1 bg-[#9333EA] text-white rounded-[10px] py-2 text-[10px] font-bold disabled:opacity-40 hover:bg-[#a855f7] shadow-[0_0_15px_rgba(147,51,234,0.3)] transition-colors"
              disabled={!userRequest.trim() || aiStatus === 'loading'}
              on:click={handleCustomRequest}
            >
              Gerar nova opção
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Scanner e Inclusão Manual lado a lado ou responsivo -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  <!-- Scanner -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-4 shadow-inner">
    <h3 class="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
       <svg class="w-4 h-4 text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
       Escanear Nota Fiscal
    </h3>
    
    {#if scanStatus === 'idle'}
       <div class="flex gap-2">
         <button class="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded-[12px] py-2.5 flex flex-col items-center gap-1 transition-colors" on:click={() => cameraInput.click()}>
           <svg class="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
           <span class="text-[9px] font-medium text-white/60">Câmera</span>
         </button>
         <button class="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded-[12px] py-2.5 flex flex-col items-center gap-1 transition-colors" on:click={() => galleryInput.click()}>
           <svg class="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
           <span class="text-[9px] font-medium text-white/60">Galeria</span>
         </button>
       </div>
       <input bind:this={cameraInput} type="file" accept="image/*" capture="environment" class="hidden" on:change={handleScanFile} />
       <input bind:this={galleryInput} type="file" accept="image/*" class="hidden" on:change={handleScanFile} />
       {#if scanError}
         <p class="text-[9px] text-red-400 mt-2 text-center">{scanError}</p>
       {/if}

    {:else if scanStatus === 'processing'}
       <div class="text-center py-2">
         <p class="text-[10px] text-white/50 mb-2">Processando OCR ({scanProgress}%)...</p>
         <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
           <div class="bg-[#a855f7] h-1.5 rounded-full transition-all" style="width: {scanProgress}%"></div>
         </div>
       </div>

    {:else if scanStatus === 'review'}
       <p class="text-[10px] text-white/50 mb-2 leading-tight">Revise os {candidates.length} itens encontrados:</p>
       <div class="max-h-[120px] overflow-y-auto pr-1 flex flex-col gap-1.5 mb-2 custom-scrollbar">
         {#each candidates as c}
           <div class="bg-[#1C1C22]/80 border border-white/5 rounded-lg p-1.5 flex items-center gap-2">
             <input type="checkbox" bind:checked={c.checked} class="shrink-0 accent-[#a855f7]" />
             <input class="flex-1 bg-transparent text-[10px] text-white border-b border-white/10 px-1 py-0.5 min-w-0 focus:outline-none focus:border-[#a855f7]" bind:value={c.name} />
           </div>
         {/each}
       </div>
       <div class="flex gap-2 mt-2">
         <button class="flex-1 bg-white/5 text-white/60 rounded-[8px] py-1.5 text-[9px] font-bold" on:click={resetScan}>Descartar</button>
         <button class="flex-1 bg-[#a855f7] text-white rounded-[8px] py-1.5 text-[9px] font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)] disabled:opacity-40" disabled={!candidates.some(c=>c.checked)} on:click={confirmScan}>Salvar</button>
       </div>
    {/if}
  </div>

  <!-- Manual Add -->
  <form on:submit|preventDefault={handleAddItem} class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-4 shadow-inner flex flex-col justify-between">
     <h3 class="text-[12px] font-bold text-white mb-3 flex items-center gap-2">
       <svg class="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
       Adicionar Manualmente
     </h3>
     <input
       class="w-full bg-[#1C1C22]/50 border border-white/10 rounded-[10px] px-3 py-2 text-[11px] text-white focus:border-[#a855f7] outline-none mb-2 placeholder:text-white/30"
       placeholder="Ex: Frango desfiado"
       bind:value={name}
     />
     <div class="flex gap-2 mb-3">
       <select class="flex-1 bg-[#1C1C22]/50 border border-white/10 rounded-[10px] px-2 py-2 text-[10px] text-white focus:border-[#a855f7] outline-none" bind:value={category}>
         {#each PANTRY_CATEGORIES as c}
           <option value={c}>{c}</option>
         {/each}
       </select>
       <input
         class="w-20 bg-[#1C1C22]/50 border border-white/10 rounded-[10px] px-2 py-2 text-[10px] text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 text-center"
         placeholder="Qtd"
         bind:value={quantity}
       />
     </div>
     <button type="submit" class="w-full bg-white/5 text-white/80 hover:text-white hover:bg-white/10 border border-white/10 rounded-[10px] py-2 text-[10px] font-bold transition-colors">
       Inserir na Dispensa
     </button>
  </form>
</div>

<!-- Dispensa List -->
<div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 shadow-inner">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-[13px] font-bold text-white flex items-center gap-2">
       <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v2h8V3zm-2 2h12v2H6zm1 2h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM9 11h6M9 15h6"/></svg>
       Inventário
    </h2>
    {#if ($items ?? []).length > 0}
      <button class="text-[9px] text-red-400 font-bold hover:text-red-300 transition-colors uppercase tracking-wider" on:click={handleClearPantry}>
        Limpar tudo
      </button>
    {/if}
  </div>

  {#if $items === undefined}
    <p class="text-[10px] text-white/40 text-center py-4">Carregando inventário...</p>
  {:else if $items.length === 0}
    <div class="text-center py-6">
       <span class="text-3xl filter grayscale opacity-20 block mb-2">🍎</span>
       <p class="text-[10px] text-white/40">Sua dispensa está vazia.<br>Adicione itens para a IA sugerir refeições.</p>
    </div>
  {:else}
    {#each PANTRY_CATEGORIES as category}
      {#if grouped[category]?.length > 0}
        <div class="mb-4 last:mb-0">
          <h3 class="text-[9px] uppercase text-white/30 font-bold tracking-widest mb-2 border-b border-white/5 pb-1">{category}</h3>
          <div class="flex flex-col gap-1.5">
            {#each grouped[category] as item (item.id)}
              <div class="bg-white/5 hover:bg-white/10 border border-white/5 rounded-[12px] px-3 py-2 flex justify-between items-center transition-colors group">
                <div class="min-w-0 pr-2">
                  <span class="text-[11px] text-white/90 font-medium truncate block">{item.name}</span>
                  {#if item.quantity}
                    <span class="text-[9px] text-[#a855f7] font-bold block">{item.quantity}</span>
                  {/if}
                </div>
                <button class="text-white/20 hover:text-red-400 text-sm shrink-0 transition-colors p-1" on:click={() => handleRemoveItem(item.id)}>
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
</style>
