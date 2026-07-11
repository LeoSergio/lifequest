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

export default db;
