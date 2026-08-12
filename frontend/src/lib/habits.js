// Funções de derivação de estado dos hábitos — segue o mesmo princípio de
// metrics.js: nunca guardamos "streak" como campo solto no hábito, sempre
// recalculamos a partir do histórico real de conclusões (habitCompletions).
// Isso evita o número dessincronizar da realidade se uma conclusão for
// apagada ou editada.

/**
 * Converte uma string "YYYY-MM-DD" para um Date local (sem shift de timezone).
 * `new Date("2026-08-12")` é interpretado como UTC midnight, o que em fusos
 * negativos (ex: Brasil UTC-3) resulta em "2026-08-11 21:00" local — ou seja,
 * na segunda-feira correta sendo tratada como domingo da semana anterior.
 */
function parseDateLocal(dateStr) {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // meio-dia local para evitar qualquer DST edge
  }
  return new Date(dateStr);
}

function startOfWeekIso(dateOrStr) {
  const d = dateOrStr instanceof Date ? new Date(dateOrStr) : parseDateLocal(dateOrStr);
  const day = d.getDay(); // 0 = domingo, usando hora local correta
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  // Retorna a data local em formato ISO
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Retorna "YYYY-MM-DD" da data LOCAL de hoje (não UTC).
 * Usando UTC: às 22h no Brasil (UTC-3), seria o dia seguinte.
 */
export function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Streak (dias consecutivos) de um hábito diário, terminando hoje ou ontem. */
export function habitStreak(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));

  function localIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let streak = 0;
  const today = todayIso();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localIso(yesterdayDate);

  // Começa pelo dia mais recente com marcação (hoje ou ontem)
  // Assim a ofensiva não "quebra" visualmente só porque o dia ainda não acabou.
  const cursorDate = parseDateLocal(days.has(today) ? today : yesterday);

  let cursor = localIso(cursorDate);
  while (days.has(cursor)) {
    streak += 1;
    cursorDate.setDate(cursorDate.getDate() - 1);
    cursor = localIso(cursorDate);
  }

  return streak;
}


/** Últimos 7 dias marcando se o hábito foi concluído em cada um (pontinhos D S T Q Q S S). */
export function last7Days(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${dd}`;
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
