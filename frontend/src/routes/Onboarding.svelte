<script>
  import { db } from '../db/db.js';
  import { GOALS } from '../lib/constants.js';

  // Onboarding em 3 passos curtos: nome, objetivo, métricas básicas.
  // Nada de quiz nem chamada de IA — o app funciona 100% offline desde o
  // primeiro segundo. Perimetria detalhada (circunferências etc.) fica
  // pra tela de Métricas, quando o usuário quiser se aprofundar depois.
  let step = 1;
  const totalSteps = 3;

  let name = '';
  let goal = null;

  let age = '';
  let weight = '';
  let height = '';

  let saving = false;

  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  function next() {
    if (step === 1 && !name.trim()) return;
    if (step === 2 && !goal) return;
    step += 1;
  }

  function back() {
    step -= 1;
  }

  async function finish() {
    if (!name.trim() || !goal || saving) return;
    saving = true;

    try {
      await db.player.add({
        name: name.trim(),
        goal,
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      // Métricas básicas são opcionais — só grava se pelo menos uma foi
      // preenchida, pra não criar uma medição vazia sem sentido.
      if (age || weight || height) {
        await db.bodyMeasurements.add({
          date: new Date().toISOString().slice(0, 10),
          age: age === '' ? null : Number(age),
          weight: weight === '' ? null : Number(weight),
          height: height === '' ? null : Number(height),
          shoulder: null,
          chest: null,
          abdomen: null,
          thigh: null,
          calf: null,
          armLeft: null,
          armRight: null,
          forearm: null
        });
      }

      // A partir daqui, o App.svelte percebe (via liveQuery) que já existe
      // um player e troca pra tela de Início sozinho.
      await db.habits.bulkAdd(
        starterHabits.map((h) => ({ ...h, archivedAt: null, createdAt: new Date().toISOString() }))
      );
    } finally {
      saving = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  <div class="w-full max-w-sm flex flex-col items-center gap-5">
    <div class="flex gap-1.5">
      {#each Array(totalSteps) as _, i}
        <span class="w-6 h-1.5 rounded-full {i + 1 <= step ? 'bg-primary' : 'bg-white/10'}"></span>
      {/each}
    </div>

    {#if step === 1}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">✨</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Bem-vindo ao LifeQuest</h1>
          <p class="text-sm text-white/60">Como podemos te chamar?</p>
        </div>

        <form on:submit|preventDefault={next} class="w-full flex flex-col gap-3">
          <input
            class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-center"
            placeholder="Seu nome"
            bind:value={name}
            autofocus
          />
          <button type="submit" class="bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40" disabled={!name.trim()}>
            Continuar
          </button>
        </form>
      </div>
    {:else if step === 2}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🎯</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Qual é o seu objetivo?</h1>
          <p class="text-sm text-white/60">Isso ajuda a personalizar seu resumo de progresso.</p>
        </div>

        <div class="w-full flex flex-col gap-2">
          {#each GOALS as g}
            <button
              class="w-full rounded-xl py-3 text-sm font-medium border {goal === g.value ? 'bg-primary text-white border-primary' : 'bg-surface border-white/10 text-white/80'}"
              on:click={() => (goal = g.value)}
            >
              {g.label}
            </button>
          {/each}
        </div>

        <div class="w-full flex gap-2">
          <button class="flex-1 bg-white/10 rounded-xl py-3 text-sm" on:click={back}>Voltar</button>
          <button class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40" disabled={!goal} on:click={next}>
            Continuar
          </button>
        </div>
      </div>
    {:else}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">📏</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Só mais um pouco</h1>
          <p class="text-sm text-white/60">
            Idade, peso e altura de hoje — pra você acompanhar sua evolução depois. Pode pular se preferir.
          </p>
        </div>

        <div class="w-full grid grid-cols-3 gap-2">
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Idade" bind:value={age} />
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Peso (kg)" bind:value={weight} />
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Altura (cm)" bind:value={height} />
        </div>

        <p class="text-[11px] text-white/30 -mt-2">
          Medidas mais detalhadas (circunferências etc.) você registra depois, em Treino → Métricas.
        </p>

        <div class="w-full flex gap-2">
          <button class="flex-1 bg-white/10 rounded-xl py-3 text-sm" on:click={back}>Voltar</button>
          <button class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40" disabled={saving} on:click={finish}>
            {saving ? 'Preparando...' : 'Começar jornada'}
          </button>
        </div>

        <button class="text-xs text-white/30" on:click={finish} disabled={saving}>Pular por agora →</button>
      </div>
    {/if}
  </div>
</main>
