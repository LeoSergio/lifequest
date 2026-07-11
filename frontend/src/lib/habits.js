// Funções de derivação de estado dos hábitos — segue o mesmo princípio de
// metrics.js: nunca guardamos "streak" como campo solto no hábito, sempre
// recalculamos a partir do histórico real de conclusões (habitCompletions).
// Isso evita o número dessincronizar da realidade se uma conclusão for
// apagada ou editada.

function startOfWeekIso(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Streak (dias consecutivos) de um hábito diário, terminando hoje ou ontem. */
export function habitStreak(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));

  let streak = 0;
  const cursor = new Date();

  // Se hoje ainda não foi marcado, começa a contagem em ontem — assim a
  // ofensiva não "quebra" visualmente só porque o dia ainda não acabou.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Últimos 7 dias marcando se o hábito foi concluído em cada um (pontinhos S T Q Q S S D). */
export function last7Days(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ date: iso, label: labels[d.getDay()], done: days.has(iso), isToday: i === 0 });
  }

  return result;
}

/** Para hábitos de meta semanal (ex: "treinar 4x/semana"): quantas conclusões nesta semana. */
export function weeklyCount(habitId, completions) {
  const week = startOfWeekIso(new Date());
  return completions.filter((c) => c.habitId === habitId && startOfWeekIso(c.date) === week).length;
}

/** Já foi concluído hoje? Evita marcar 2x o mesmo hábito diário no mesmo dia. */
export function completedToday(habitId, completions) {
  const today = todayIso();
  return completions.some((c) => c.habitId === habitId && c.date === today);
}

/**
 * Taxa de sucesso agregada dos últimos 7 dias: de todas as ocorrências
 * esperadas de hábitos diários ativos, quantas foram cumpridas. Hábitos
 * semanais não entram nessa conta (têm sua própria barra de progresso).
 */
export function successRate(habits, completions) {
  const dailyHabits = habits.filter((h) => h.cadence === 'daily' && !h.archivedAt);
  if (dailyHabits.length === 0) return 0;

  let total = 0;
  let hit = 0;
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    for (const habit of dailyHabits) {
      total += 1;
      if (completions.some((c) => c.habitId === habit.id && c.date === iso)) hit += 1;
    }
  }

  return total === 0 ? 0 : Math.round((hit / total) * 100);
}
