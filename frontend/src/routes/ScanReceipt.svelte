<script>
  import Tesseract from 'tesseract.js';
  import { db } from '../db/db.js';
  import { extractItemCandidates } from '../lib/receiptParser.js';
  import { PANTRY_CATEGORIES } from '../lib/constants.js';
  import { navigate } from '../lib/nav.js';

  let status = 'idle'; // idle | processing | review
  let progress = 0;
  let candidates = []; // [{ name, category, checked }]
  let error = null;

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    status = 'processing';
    progress = 0;
    error = null;

    try {
      // 'por' = pacote de idioma português. Na primeira vez, o Tesseract
      // baixa esse pacote de treino (alguns MB) de uma CDN e guarda em
      // cache no navegador — por isso a primeira leitura é mais lenta.
      const { data } = await Tesseract.recognize(file, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            progress = Math.round(m.progress * 100);
          }
        }
      });

      const found = extractItemCandidates(data.text);
      candidates = found.map((name) => ({
        name,
        category: PANTRY_CATEGORIES[PANTRY_CATEGORIES.length - 1], // 'Outros' por padrão
        checked: true
      }));
      status = 'review';
    } catch (e) {
      console.error(e);
      error = 'Não consegui ler essa imagem. Tenta uma foto mais nítida e com boa luz.';
      status = 'idle';
    }
  }

  async function confirmAdd() {
    const toAdd = candidates.filter((c) => c.checked && c.name.trim());

    await db.pantryItems.bulkAdd(
      toAdd.map((c) => ({
        name: c.name.trim(),
        category: c.category,
        quantity: null,
        updatedAt: new Date().toISOString()
      }))
    );

    navigate('pantry');
  }

  function reset() {
    status = 'idle';
    candidates = [];
    progress = 0;
    error = null;
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <h1 class="text-2xl font-bold text-primary mb-1">Escanear nota fiscal</h1>
  <p class="text-sm text-white/60 mb-6">Tudo processado no seu aparelho — a imagem nunca sai do dispositivo.</p>

  {#if status === 'idle'}
    <label class="block bg-surface border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer">
      <span class="text-4xl block mb-2">📷</span>
      <span class="text-sm text-white/60">Toque para tirar foto ou escolher da galeria</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        on:change={handleFile}
      />
    </label>

    {#if error}
      <p class="text-danger text-sm mt-4">{error}</p>
    {/if}
  {:else if status === 'processing'}
    <div class="bg-surface rounded-xl p-6 text-center">
      <p class="text-sm text-white/60 mb-3">Lendo a nota fiscal...</p>
      <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div class="bg-primary h-2 rounded-full transition-all" style="width: {progress}%"></div>
      </div>
      <p class="text-xs text-white/40 mt-2">{progress}%</p>
    </div>
  {:else if status === 'review'}
    <p class="text-sm text-white/60 mb-3">
      Encontrei {candidates.length} possíveis itens. Revise antes de adicionar — o OCR erra às vezes.
    </p>

    {#if candidates.length === 0}
      <p class="text-sm text-white/40 mb-4">Não consegui identificar itens nessa imagem.</p>
    {:else}
      <div class="flex flex-col gap-2 mb-4">
        {#each candidates as c, i}
          <div class="bg-surface rounded-lg p-3 flex items-center gap-2">
            <input type="checkbox" bind:checked={c.checked} class="shrink-0" />
            <input
              class="flex-1 bg-bg border border-white/10 rounded px-2 py-2 text-sm min-w-0"
              bind:value={c.name}
            />
            <select class="bg-bg border border-white/10 rounded px-2 py-2 text-xs shrink-0" bind:value={c.category}>
              {#each PANTRY_CATEGORIES as cat}
                <option value={cat}>{cat}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex gap-2">
      <button class="flex-1 bg-white/10 text-white rounded-lg py-3 text-sm" on:click={reset}>
        Tentar outra foto
      </button>
      <button
        class="flex-1 bg-primary text-white rounded-lg py-3 text-sm font-medium disabled:opacity-40"
        disabled={candidates.filter((c) => c.checked).length === 0}
        on:click={confirmAdd}
      >
        Adicionar à despensa
      </button>
    </div>
  {/if}
</main>
