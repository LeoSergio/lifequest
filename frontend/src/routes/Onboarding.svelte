<script>
  import { db } from '../db/db.js';
  import { api } from '../lib/api.js';

  // Perguntas do quiz. Mude aqui à vontade — o backend recebe um dict livre
  // { pergunta: resposta }, então não precisa tocar no backend pra ajustar isso.
  const questions = [
    {
      id: 'maior_desafio',
      text: 'Qual seu maior desafio hoje?',
      options: ['Organizar a casa', 'Constância na academia', 'Comer melhor', 'Manter disciplina']
    },
    {
      id: 'tempo_disponivel',
      text: 'Quanto tempo livre você tem por dia?',
      options: ['Menos de 30min', '30min a 1h', '1h a 2h', 'Mais de 2h']
    },
    {
      id: 'motivacao',
      text: 'O que mais te motiva a continuar um hábito?',
      options: ['Ver progresso visual', 'Competir com outras pessoas', 'Recompensas', 'Rotina fixa']
    }
  ];

  let step = 0;
  let answers = {};
  let loading = false;
  let error = null;

  function selectAnswer(option) {
    answers[questions[step].id] = option;
    if (step < questions.length - 1) {
      step += 1;
    } else {
      submit();
    }
  }

  async function submit() {
    loading = true;
    error = null;
    try {
      const result = await api.generateArchetype(answers);

      // Salva o jogador localmente — a partir daqui, o App.svelte percebe
      // (via liveQuery) que já existe um player e troca pra tela de Dashboard
      // sozinho. Não precisamos "navegar" manualmente pra lugar nenhum.
      await db.player.add({
        archetype: result.archetype,
        archetypeDescription: result.archetype_description,
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      await db.missions.bulkAdd(
        result.initial_missions.map((m) => ({
          pillar: m.pillar,
          title: m.title,
          description: m.description,
          xpReward: m.xp_reward,
          status: 'pending',
          dueDate: new Date().toISOString().slice(0, 10),
          difficulty: 'facil'
        }))
      );
    } catch (e) {
      error = 'Não consegui gerar seu arquétipo agora. Verifique se o backend está rodando e tente de novo.';
      console.error(e);
    } finally {
      loading = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  {#if loading}
    <p class="text-lg animate-pulse">Consultando os oráculos da IA...</p>
  {:else}
    <div class="w-full max-w-sm">
      <p class="text-xs text-white/40 mb-2">Passo {step + 1} de {questions.length}</p>
      <h2 class="text-xl font-semibold mb-6">{questions[step].text}</h2>

      <div class="flex flex-col gap-3">
        {#each questions[step].options as option}
          <button
            class="bg-surface hover:bg-primary/20 border border-white/10 rounded-xl py-4 px-4 text-left transition-colors"
            on:click={() => selectAnswer(option)}
          >
            {option}
          </button>
        {/each}
      </div>

      {#if error}
        <p class="text-danger text-sm mt-4">{error}</p>
      {/if}
    </div>
  {/if}
</main>
