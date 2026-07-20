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

  // Estado do scanner de nota fiscal. 'idle' | 'processing' | 'review'.
  let scanStatus = 'idle';
  let scanProgress = 0;
  let candidates = [];
  let scanError = null;

  let cameraInput;
  let galleryInput;

  // ─── IA de Refeições ──────────────────────────────────────────────────────
  const MEAL_TYPES = [
    { id: 'cafe_manha', label: 'Café da manhã', emoji: '🌅' },
    { id: 'almoco',     label: 'Almoço',        emoji: '🍽️' },
    { id: 'lanche',     label: 'Lanche',         emoji: '🥪' },
    { id: 'janta',      label: 'Janta',          emoji: '🌙' }
  ];

  let selectedMealType = null;
  let aiStatus = 'idle'; // 'idle' | 'loading' | 'done' | 'error'
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
      aiError = 'Não foi possível conectar ao assistente. Verifique sua conexão.';
      aiStatus = 'error';
    }
  }

  async function handleCustomRequest() {
    if (!userRequest.trim()) return;
    await handleAskAI(selectedMealType ?? 'geral', userRequest.trim());
    userRequest = '';
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <h1 class="text-2xl font-bold text-primary mb-1">Despensa</h1>
  <p class="text-sm text-white/60 mb-6">O que você tem em casa agora.</p>

  <!-- ─── Bloco de IA ──────────────────────────────────────────────────────── -->
  <div class="bg-surface rounded-2xl p-4 mb-6 border border-white/5 relative overflow-hidden">
    <div class="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>

    <div class="flex items-center gap-2 mb-3">
      <span class="text-xl">🤖</span>
      <div>
        <h2 class="text-sm font-bold text-white">Sugestão de Refeição por IA</h2>
        <p class="text-[11px] text-white/40">
          Baseada na sua dispensa{todaysWorkoutName ? ` e no treino de hoje (${todaysWorkoutName})` : ''}.
        </p>
      </div>
    </div>

    <!-- Seletor de tipo de refeição -->
    <div class="grid grid-cols-4 gap-2 mb-4">
      {#each MEAL_TYPES as mt}
        <button
          class="py-3 rounded-xl border flex flex-col items-center gap-1 transition-all {selectedMealType === mt.id && aiStatus !== 'idle' ? 'bg-primary/20 border-primary text-primary' : 'bg-bg border-white/5 text-white/50 hover:bg-white/5'}"
          on:click={() => handleAskAI(mt.id)}
          disabled={aiStatus === 'loading'}
        >
          <span class="text-lg">{mt.emoji}</span>
          <span class="text-[10px] font-semibold leading-tight text-center">{mt.label}</span>
        </button>
      {/each}
    </div>

    <!-- Estados da IA -->
    {#if aiStatus === 'loading'}
      <div class="flex flex-col items-center gap-3 py-6">
        <div class="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        <p class="text-sm text-white/50">Consultando o assistente...</p>
      </div>

    {:else if aiStatus === 'error'}
      <p class="text-sm text-red-400 py-2">{aiError}</p>

    {:else if aiStatus === 'done' && aiSuggestions.length > 0}
      <div class="flex flex-col gap-3">
        {#each aiSuggestions as suggestion, i}
          <div class="bg-bg rounded-xl p-4 border border-white/5">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-sm text-white leading-tight pr-2">{suggestion.title}</h3>
              <span class="shrink-0 text-[10px] font-bold text-xp bg-xp/10 px-2 py-1 rounded-lg">#{i+1}</span>
            </div>
            <p class="text-xs text-white/50 mb-3">{suggestion.description}</p>

            <!-- Stats rápidas -->
            <div class="flex gap-3 mb-3">
              <div class="text-center">
                <p class="text-xs font-bold text-primary">{suggestion.estimated_calories}</p>
                <p class="text-[9px] text-white/40">kcal</p>
              </div>
              <div class="w-px bg-white/5"></div>
              <div class="text-center">
                <p class="text-xs font-bold text-primary">{suggestion.protein_g}g</p>
                <p class="text-[9px] text-white/40">proteína</p>
              </div>
              <div class="w-px bg-white/5"></div>
              <div class="text-center">
                <p class="text-xs font-bold text-primary">{suggestion.prep_time_min}min</p>
                <p class="text-[9px] text-white/40">preparo</p>
              </div>
            </div>

            {#if suggestion.ingredients_used?.length > 0}
              <div class="mb-2">
                <p class="text-[10px] text-white/40 mb-1 uppercase font-bold tracking-wider">Da sua dispensa</p>
                <div class="flex flex-wrap gap-1">
                  {#each suggestion.ingredients_used as ing}
                    <span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{ing}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if suggestion.ingredients_to_buy?.length > 0}
              <div>
                <p class="text-[10px] text-white/40 mb-1 uppercase font-bold tracking-wider">Comprar (opcional)</p>
                <div class="flex flex-wrap gap-1">
                  {#each suggestion.ingredients_to_buy as ing}
                    <span class="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full">{ing}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Botão "Recomendar outras" + campo livre -->
    {#if aiStatus === 'done' || aiStatus === 'error'}
      <div class="mt-4 pt-4 border-t border-white/5">
        {#if !showCustomRequest}
          <button
            class="w-full bg-bg border border-white/10 text-white/60 rounded-xl py-3 text-sm font-semibold hover:bg-white/5 hover:text-white transition-colors"
            on:click={() => showCustomRequest = true}
          >
            💬 Recomendar outras refeições...
          </button>
        {:else}
          <div class="flex flex-col gap-2">
            <label class="text-xs text-white/40">O que você gostaria de comer?</label>
            <textarea
              class="w-full bg-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none resize-none transition-colors placeholder:text-white/30"
              rows="2"
              placeholder="Ex: algo com carne e depois uma sobremesa saudável..."
              bind:value={userRequest}
              on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCustomRequest())}
            ></textarea>
            <div class="flex gap-2">
              <button
                class="flex-1 bg-surface border border-white/10 text-white/50 rounded-xl py-3 text-sm hover:bg-white/5"
                on:click={() => { showCustomRequest = false; userRequest = ''; }}
              >
                Cancelar
              </button>
              <button
                class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                disabled={!userRequest.trim() || aiStatus === 'loading'}
                on:click={handleCustomRequest}
              >
                Analisar
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Aviso de Nutricionista — sempre visível -->
    <div class="mt-4 flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
      <span class="text-lg shrink-0">⚠️</span>
      <p class="text-[11px] text-yellow-400/80 leading-relaxed">
        Estas sugestões são geradas por IA e têm caráter apenas informativo. Para uma dieta personalizada e segura, consulte um <strong>nutricionista</strong>.
      </p>
    </div>
  </div>

  <!-- ─── Scanner de Nota Fiscal ─────────────────────────────────────────── -->
  {#if scanStatus === 'idle'}
    <div class="bg-surface rounded-xl p-4 mb-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">📷</span>
        <div>
          <p class="text-sm font-medium">Escanear nota fiscal</p>
          <p class="text-xs text-white/40">Tudo processado no aparelho — a imagem nunca sai do dispositivo.</p>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 bg-bg border border-white/10 rounded-lg py-3 text-sm flex flex-col items-center gap-1"
          on:click={() => cameraInput.click()}
        >
          <span class="text-xl">📷</span>
          Câmera
        </button>
        <button
          class="flex-1 bg-bg border border-white/10 rounded-lg py-3 text-sm flex flex-col items-center gap-1"
          on:click={() => galleryInput.click()}
        >
          <span class="text-xl">🖼️</span>
          Galeria
        </button>
      </div>

      <input bind:this={cameraInput} type="file" accept="image/*" capture="environment" class="hidden" on:change={handleScanFile} />
      <input bind:this={galleryInput} type="file" accept="image/*" class="hidden" on:change={handleScanFile} />

      {#if scanError}
        <p class="text-danger text-sm mt-3">{scanError}</p>
      {/if}
    </div>
  {:else if scanStatus === 'processing'}
    <div class="bg-surface rounded-xl p-6 text-center mb-6">
      <p class="text-sm text-white/60 mb-3">Lendo a nota fiscal...</p>
      <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div class="bg-primary h-2 rounded-full transition-all" style="width: {scanProgress}%"></div>
      </div>
      <p class="text-xs text-white/40 mt-2">{scanProgress}%</p>
    </div>
  {:else if scanStatus === 'review'}
    <div class="bg-surface rounded-xl p-4 mb-6">
      <p class="text-sm text-white/60 mb-3">
        Encontrei {candidates.length} possíveis itens. Revise antes de adicionar — o OCR erra às vezes.
      </p>

      {#if candidates.length === 0}
        <p class="text-sm text-white/40 mb-4">Não consegui identificar itens nessa imagem.</p>
      {:else}
        <div class="flex flex-col gap-2 mb-4">
          {#each candidates as c}
            <div class="bg-bg rounded-lg p-3 flex items-center gap-2">
              <input type="checkbox" bind:checked={c.checked} class="shrink-0" />
              <input class="flex-1 bg-surface border border-white/10 rounded px-2 py-2 text-sm min-w-0" bind:value={c.name} />
              <select class="bg-surface border border-white/10 rounded px-2 py-2 text-xs shrink-0" bind:value={c.category}>
                {#each PANTRY_CATEGORIES as cat}
                  <option value={cat}>{cat}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex gap-2">
        <button class="flex-1 bg-white/10 text-white rounded-lg py-3 text-sm" on:click={resetScan}>
          Tentar outra foto
        </button>
        <button
          class="flex-1 bg-primary text-white rounded-lg py-3 text-sm font-medium disabled:opacity-40"
          disabled={candidates.filter((c) => c.checked).length === 0}
          on:click={confirmScan}
        >
          Adicionar à despensa
        </button>
      </div>
    </div>
  {/if}

  <!-- ─── Formulário Manual ──────────────────────────────────────────────── -->
  <form on:submit|preventDefault={handleAddItem} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
    <input
      class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
      placeholder="Nome do item (ex: ovos)"
      bind:value={name}
    />

    <div class="flex gap-2">
      <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={category}>
        {#each PANTRY_CATEGORIES as c}
          <option value={c}>{c}</option>
        {/each}
      </select>

      <input
        class="w-28 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Qtd (opc.)"
        bind:value={quantity}
      />
    </div>

    <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">
      Adicionar
    </button>
  </form>

  <!-- ─── Lista da Despensa ──────────────────────────────────────────────── -->
  {#if $items === undefined}
    <p class="text-sm text-white/40">Carregando despensa...</p>
  {:else}
    <div class="flex justify-between items-center mb-2">
      <h2 class="text-xs uppercase text-white/40 font-bold tracking-wider">Minha Dispensa</h2>
      {#if ($items ?? []).length > 0}
        <button
          class="text-xs text-red-400/70 hover:text-red-400 transition-colors"
          on:click={handleClearPantry}
        >
          🗑 Limpar tudo
        </button>
      {/if}
    </div>
    {#each PANTRY_CATEGORIES as category}
      {#if grouped[category]?.length > 0}
        <div class="mb-5">
          <h2 class="text-xs uppercase text-white/40 mb-2">{category}</h2>
          <div class="flex flex-col gap-2">
            {#each grouped[category] as item (item.id)}
              <div class="bg-surface rounded-lg px-4 py-3 flex justify-between items-center">
                <div>
                  <span class="text-sm">{item.name}</span>
                  {#if item.quantity}
                    <span class="text-xs text-white/40 ml-2">{item.quantity}</span>
                  {/if}
                </div>
                <button class="text-white/40 text-sm" on:click={() => handleRemoveItem(item.id)}>
                  remover
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}

    {#if $items.length === 0}
      <p class="text-sm text-white/40">Despensa vazia. Adicione o primeiro item acima ou escaneie uma nota.</p>
    {/if}
  {/if}
</main>
