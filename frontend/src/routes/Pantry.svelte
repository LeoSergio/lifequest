<script>
  import { liveQuery } from 'dexie';
  import Tesseract from 'tesseract.js';
  import { db } from '../db/db.js';
  import { PANTRY_CATEGORIES } from '../lib/constants.js';
  import { extractItemCandidates } from '../lib/receiptParser.js';

  // bind:value liga o input DIRETO a essas variáveis — sempre que o
  // usuário digita, a variável muda sozinha (é bidirecional, diferente
  // do onChange manual do React). Por isso não precisamos de handler
  // pra atualizar `name`, `category` ou `quantity`.
  let name = '';
  let category = PANTRY_CATEGORIES[0];
  let quantity = '';

  // Estado do scanner de nota fiscal, agora embutido aqui (antes era a
  // rota separada /scan). 'idle' | 'processing' | 'review'.
  let scanStatus = 'idle';
  let scanProgress = 0;
  let candidates = []; // [{ name, category, checked }]
  let scanError = null;

  let cameraInput;
  let galleryInput;

  const items = liveQuery(() => db.pantryItems.toArray());

  // Deriva os itens agrupados por categoria sempre que `items` muda.
  // $: é uma "reactive statement" do Svelte: roda de novo toda vez que
  // qualquer variável usada dentro dela muda.
  $: grouped = groupByCategory($items ?? []);

  function groupByCategory(list) {
    const map = {};
    for (const c of PANTRY_CATEGORIES) map[c] = [];
    for (const item of list) {
      (map[item.category] ??= []).push(item);
    }
    return map;
  }

  async function addItem() {
    if (!name.trim()) return;

    await db.pantryItems.add({
      name: name.trim(),
      category,
      quantity: quantity.trim() || null,
      updatedAt: new Date().toISOString()
    });

    name = '';
    quantity = '';
  }

  async function removeItem(id) {
    await db.pantryItems.delete(id);
  }

  async function handleScanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    scanStatus = 'processing';
    scanProgress = 0;
    scanError = null;

    try {
      // 'por' = pacote de idioma português. Na primeira vez, o Tesseract
      // baixa esse pacote de treino (alguns MB) de uma CDN e guarda em
      // cache no navegador — por isso a primeira leitura é mais lenta.
      const { data } = await Tesseract.recognize(file, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            scanProgress = Math.round(m.progress * 100);
          }
        }
      });

      const found = extractItemCandidates(data.text);
      candidates = found.map((n) => ({
        name: n,
        category: PANTRY_CATEGORIES[PANTRY_CATEGORIES.length - 1], // 'Outros' por padrão
        checked: true
      }));
      scanStatus = 'review';
    } catch (e) {
      console.error(e);
      scanError = 'Não consegui ler essa imagem. Tenta uma foto mais nítida e com boa luz.';
      scanStatus = 'idle';
    } finally {
      // Limpa o input pra permitir escanear o mesmo arquivo de novo, se precisar.
      event.target.value = '';
    }
  }

  async function confirmScan() {
    const toAdd = candidates.filter((c) => c.checked && c.name.trim());

    await db.pantryItems.bulkAdd(
      toAdd.map((c) => ({
        name: c.name.trim(),
        category: c.category,
        quantity: null,
        updatedAt: new Date().toISOString()
      }))
    );

    resetScan();
  }

  function resetScan() {
    scanStatus = 'idle';
    candidates = [];
    scanProgress = 0;
    scanError = null;
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <h1 class="text-2xl font-bold text-primary mb-1">Despensa</h1>
  <p class="text-sm text-white/60 mb-6">O que você tem em casa agora.</p>

  <!-- Scan de nota fiscal: antes era uma aba própria, agora vive aqui
       dentro, já que o resultado dele é sempre "itens da despensa". -->
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

      <!-- capture="environment" força a abertura direta da câmera traseira. -->
      <input
        bind:this={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        on:change={handleScanFile}
      />
      <!-- Sem o atributo capture, o navegador abre o seletor normal (galeria/arquivos). -->
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

  <form on:submit|preventDefault={addItem} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
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

  {#if $items === undefined}
    <p class="text-sm text-white/40">Carregando despensa...</p>
  {:else}
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
                <button class="text-white/40 text-sm" on:click={() => removeItem(item.id)}>
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
