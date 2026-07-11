<script>
  import { db } from '../db/db.js';

  // Onboarding simplificado: só pedimos o nome, sem quiz de arquétipo e
  // sem chamada de IA no primeiro acesso. Isso tem uma vantagem prática
  // além da simplicidade: o app agora funciona 100% offline desde o
  // primeiro segundo, sem depender do backend estar no ar pra o usuário
  // conseguir nem entrar.
  let name = '';
  let saving = false;

  // Hábitos iniciais pra a tela de Hábitos não começar vazia. O usuário
  // pode apagar ou arquivar qualquer um deles depois — são só um ponto
  // de partida, não uma imposição.
  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  async function start() {
    if (!name.trim() || saving) return;
    saving = true;

    try {
      await db.player.add({
        name: name.trim(),
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      // A partir daqui, o App.svelte percebe (via liveQuery) que já existe
      // um player e troca pra tela de Início sozinho — não precisamos
      // "navegar" manualmente pra lugar nenhum.
      await db.habits.bulkAdd(
        starterHabits.map((h) => ({ ...h, archivedAt: null, createdAt: new Date().toISOString() }))
      );
    } finally {
      saving = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  <div class="w-full max-w-sm text-center flex flex-col items-center gap-5">
    <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">✨</div>

    <div>
      <h1 class="text-xl font-semibold mb-1">Bem-vindo ao LifeQuest</h1>
      <p class="text-sm text-white/60">Como podemos te chamar?</p>
    </div>

    <form on:submit|preventDefault={start} class="w-full flex flex-col gap-3">
      <input
        class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-center"
        placeholder="Seu nome"
        bind:value={name}
        autofocus
      />

      <button
        type="submit"
        class="bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40"
        disabled={!name.trim() || saving}
      >
        {saving ? 'Preparando sua jornada...' : 'Começar jornada'}
      </button>
    </form>
  </div>
</main>
