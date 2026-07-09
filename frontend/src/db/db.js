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

export default db;
