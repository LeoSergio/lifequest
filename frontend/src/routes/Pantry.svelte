<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { PANTRY_CATEGORIES } from '../lib/constants.js';

  // bind:value liga o input DIRETO a essas variáveis — sempre que o
  // usuário digita, a variável muda sozinha (é bidirecional, diferente
  // do onChange manual do React). Por isso não precisamos de handler
  // pra atualizar `name`, `category` ou `quantity`.
  let name = '';
  let category = PANTRY_CATEGORIES[0];
  let quantity = '';

  const items = liveQuery(() => db.pantryItems.toArray());

  // Deriva os itens agrupados por categoria sempre que `items` muda.
  // $: é uma "reactive statement" do Svelte: roda de novo toda vez que
  // qualquer variável usada dentro dela muda.
  $: grouped = groupByCategory($items ?? []);

  function groupByCategory(list) {
    const map = {};
    for (const category of PANTRY_CATEGORIES) map[category] = [];
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
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <h1 class="text-2xl font-bold text-primary mb-1">Despensa</h1>
  <p class="text-sm text-white/60 mb-6">O que você tem em casa agora.</p>

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
      <p class="text-sm text-white/40">Despensa vazia. Adicione o primeiro item acima.</p>
    {/if}
  {/if}
</main>
