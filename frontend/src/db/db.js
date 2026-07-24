import Dexie from 'dexie';

// Local-first: este é o único "banco de dados" do usuário.
// Nada aqui sobe para o backend, exceto payloads efêmeros enviados
// pontualmente para as rotas de IA (backend é stateless).
export const db = new Dexie('lifequest');

db.version(1).stores({
  // Pilar 1 — Onboarding & Dashboard
  player: '++id, archetype, level, xp, streak, createdAt',
  missions: '++id, pillar, status, dueDate, difficulty',

  // Pilar 2 — Gestão do Lar & Inteligência Financeira
  pantryItems: '++id, name, category, quantity, updatedAt',
  shoppingList: '++id, itemName, checked, recipeId, createdAt',
  budget: '++id, month, limit, spent',

  // Pilar 3 — Academia & Nutrição Sincronizada
  workoutPlans: '++id, name, weekday, estimatedDuration',
  workoutPlanExercises: '++id, workoutPlanId, exerciseId, order, targetSets, targetReps, restSeconds',
  exercises: '++id, name, muscleGroup, equipment',
  workoutSessions: '++id, workoutPlanId, startedAt, finishedAt',
  sessionSets: '++id, workoutSessionId, workoutPlanExerciseId, setNumber, weightKg, repsDone, completedAt',
  recipes: '++id, title, goalContext, createdAt',

  // Pilar 4 — Disciplina & Social (apenas o vínculo local com a guilda)
  guildMembership: '++id, guildId, joinedAt'
});

// Migração aditiva: só precisamos declarar a tabela NOVA aqui — o Dexie
// mantém automaticamente todas as tabelas já definidas na version(1).
// Isso é importante: quem já tinha o app instalado no navegador vai
// receber essa tabela nova sem perder nenhum dado existente.
db.version(2).stores({
  bodyMeasurements: '++id, date'
});

// Hábitos absorvem o que antes era "missões": em vez de a IA gerar missões
// pontuais no onboarding, o usuário cria e mantém seus próprios hábitos,
// com histórico de conclusões (habitCompletions) — igual ao streak de
// treino em metrics.js, nunca guardamos "streak" como campo solto.
db.version(3).stores({
  habits: '++id, title, icon, cadence, weeklyTarget, xpReward, archivedAt, createdAt',
  habitCompletions: '++id, habitId, date'
});

// Metas: diferente de hábito (repetição contínua), uma meta tem um alvo
// numérico único e um fim — ao bater `targetValue`, ela é marcada como
// alcançada (achievedAt) e não volta atrás. Progresso é atualizado
// manualmente pelo usuário (local-first: sem depender de nenhuma fonte
// externa por padrão).
db.version(4).stores({
  goals: '++id, title, targetValue, currentValue, unit, reward, xpReward, deadline, achievedAt, createdAt'
});

// Conserta uma lacuna que existia desde a v1: o índice `exerciseId` já
// estava declarado em workoutPlanExercises, mas o app nunca escrevia
// nele — exercícios eram identificados só por um `exerciseName` solto
// copiado em cada plano, e a tabela `exercises` (catálogo) ficava sem
// uso. Consequência prática: apagar um treino apagava o acesso ao
// histórico de carga daquele exercício em Métricas, mesmo os dados
// (sessionSets) continuando salvos.
//
// Agora exerciseId vira a identidade estável: workoutPlanExercises
// aponta pra um exercicio do catálogo, e sessionSets guarda o
// exerciseId direto (não só o workoutPlanExerciseId), então o
// histórico de desempenho sobrevive mesmo se o plano for apagado depois.
db.version(5)
  .stores({
    sessionSets: '++id, workoutSessionId, workoutPlanExerciseId, exerciseId, setNumber, weightKg, repsDone, completedAt'
  })
  .upgrade(async (tx) => {
    const wpeTable = tx.table('workoutPlanExercises');
    const exTable = tx.table('exercises');
    const setsTable = tx.table('sessionSets');

    const oldRows = await wpeTable.toArray();
    const nameToId = new Map();
    const wpeIdToExerciseId = new Map();

    for (const row of oldRows) {
      if (row.exerciseId != null) {
        wpeIdToExerciseId.set(row.id, row.exerciseId);
        continue;
      }

      const key = (row.exerciseName ?? '').trim().toLowerCase();
      if (!key) continue;

      let exerciseId = nameToId.get(key);
      if (exerciseId == null) {
        exerciseId = await exTable.add({
          name: row.exerciseName.trim(),
          muscleGroup: row.muscleGroup ?? null,
          equipment: row.equipment ?? null
        });
        nameToId.set(key, exerciseId);
      }

      wpeIdToExerciseId.set(row.id, exerciseId);
      await wpeTable.update(row.id, { exerciseId });
    }

    const oldSets = await setsTable.toArray();
    for (const set of oldSets) {
      const exerciseId = wpeIdToExerciseId.get(set.workoutPlanExerciseId);
      if (exerciseId != null) {
        await setsTable.update(set.id, { exerciseId });
      }
    }
  });

// Adicionando missões diárias gamificadas geradas por IA.
// 'date' é usado para indexar e resetar as missões a cada novo dia.
db.version(6).stores({
  dailyQuests: '++id, date, pillar, title, description, xpReward, completed'
});

// Inventário para guardar os itens comprados na Loja (Temas, Avatares, Poções)
db.version(7).stores({
  inventory: '++id, itemId, category, name, purchasedAt'
});

// Medalhas e Conquistas baseadas nas ações do usuário
db.version(8).stores({
  unlockedAchievements: '++id, achievementId, unlockedAt'
});

export default db;
