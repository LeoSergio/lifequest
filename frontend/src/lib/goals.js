// Funções pequenas de derivação pra metas — mesma filosofia de metrics.js
// e habits.js: o estado "alcançada" nunca é decidido só por um booleano
// solto, é sempre checado contra currentValue >= targetValue.

export function goalProgressPercent(goal) {
  if (!goal.targetValue) return 0;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

export function isGoalAchieved(goal) {
  return goal.currentValue >= goal.targetValue;
}

export function daysUntilDeadline(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
