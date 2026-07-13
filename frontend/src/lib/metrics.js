// Retorna a "segunda-feira" da semana de uma data, como string YYYY-MM-DD.
// Usamos isso como chave de agrupamento pra "quantos treinos por semana".
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak (ofensiva) calculado sempre a partir do histórico real de sessões
 * concluídas — nunca guardamos esse número num campo solto, pra não correr
 * risco de ele dessincronizar da realidade (ex: se uma sessão for apagada).
 */
export function currentStreak(sessions) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));

  let streak = 0;
  const cursor = new Date();

  // Se hoje ainda não treinou, começa a contagem em ontem — assim a
  // ofensiva não "quebra" visualmente só porque o dia ainda não acabou.
  if (!trainedDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (trainedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Últimos 7 dias, marcando quais tiveram treino concluído — pro calendário estilo Duolingo. */
export function last7DaysActivity(sessions) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));
  const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      label: dayLabels[d.getDay()],
      trained: trainedDays.has(iso),
      isToday: i === 0
    });
  }

  return days;
}

/**
 * Monta uma grade de semanas x dias (estilo GitHub/Duolingo) marcando em
 * quais dias houve treino concluído, pras últimas `weeks` semanas. Cada
 * semana começa na segunda-feira, igual ao resto do app (ver startOfWeek).
 */
export function weeklyCalendar(sessions, weeks = 9) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));
  const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const currentWeekStart = new Date(startOfWeek(new Date()));
  const gridStart = new Date(currentWeekStart);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

  const columns = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(date.getDate() + w * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      days.push({ date: iso, trained: trainedDays.has(iso), isToday: iso === today, isFuture: iso > today });
    }
    columns.push({ days, monthLabel: monthLabels[new Date(days[0].date).getMonth()] });
  }

  return columns;
}

/**
 * Conta quantas sessões de treino finalizadas existem por semana,
 * nas últimas `weeksBack` semanas (incluindo a atual).
 */
export function sessionsPerWeek(sessions, weeksBack = 8) {
  const today = new Date();
  const weeks = [];

  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    weeks.push(startOfWeek(d));
  }

  const counts = Object.fromEntries(weeks.map((w) => [w, 0]));

  for (const session of sessions) {
    if (!session.finishedAt) continue; // só conta treino que foi concluído
    const week = startOfWeek(session.finishedAt);
    if (week in counts) counts[week] += 1;
  }

  return {
    labels: weeks.map((w) => {
      const [, m, d] = w.split('-');
      return `${d}/${m}`;
    }),
    data: weeks.map((w) => counts[w])
  };
}

/**
 * Intervalo de datas (YYYY-MM-DD) pro resumo da Dashboard, no estilo dos
 * filtros do MyFitnessPal (semana / mês / trimestre), sempre terminando
 * hoje.
 */
export function periodRange(period) {
  const end = new Date();
  const start = new Date();

  if (period === 'semana') start.setDate(end.getDate() - 6);
  else if (period === 'mes') start.setDate(end.getDate() - 29);
  else start.setDate(end.getDate() - 89); // trimestre ~ 90 dias

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Quantos treinos foram concluídos dentro do intervalo. */
export function workoutsInRange(sessions, range) {
  return sessions.filter((s) => s.finishedAt && s.finishedAt.slice(0, 10) >= range.start && s.finishedAt.slice(0, 10) <= range.end)
    .length;
}

/**
 * Taxa de conclusão de hábitos diários dentro do intervalo — mesma ideia
 * de successRate() em lib/habits.js, mas pro período escolhido no filtro
 * em vez de fixo em 7 dias. Ignora dias anteriores à criação do hábito,
 * pra não punir um hábito novo por dias em que ele nem existia ainda.
 */
export function habitsCompletionRateInRange(habits, completions, range) {
  const dailyHabits = habits.filter((h) => h.cadence === 'daily' && !h.archivedAt);
  if (dailyHabits.length === 0) return null;

  let total = 0;
  let hit = 0;
  const cursor = new Date(range.start);
  const endDate = new Date(range.end);

  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    for (const habit of dailyHabits) {
      if (habit.createdAt && habit.createdAt.slice(0, 10) > iso) continue;
      total += 1;
      if (completions.some((c) => c.habitId === habit.id && c.date === iso)) hit += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total === 0 ? null : Math.round((hit / total) * 100);
}

/**
 * Variação de peso dentro do intervalo, a partir do histórico real de
 * bodyMeasurements (nunca um número solto) — junto com os pontos pra
 * desenhar a mini linha de tendência.
 */
export function weightDeltaInRange(measurements, range) {
  const inRange = measurements
    .filter((m) => m.weight != null && m.date >= range.start && m.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (inRange.length < 2) return null;

  const first = inRange[0].weight;
  const last = inRange[inRange.length - 1].weight;

  return {
    first,
    last,
    delta: Math.round((last - first) * 10) / 10,
    labels: inRange.map((m) => m.date.slice(5).split('-').reverse().join('/')),
    data: inRange.map((m) => m.weight)
  };
}

/** Quantas metas foram alcançadas dentro do intervalo. */
export function goalsAchievedInRange(goals, range) {
  return goals.filter((g) => g.achievedAt && g.achievedAt.slice(0, 10) >= range.start && g.achievedAt.slice(0, 10) <= range.end)
    .length;
}

/**
 * Maior peso registrado por dia, pra um conjunto de sessionSets de um
 * único exercício — vira a linha de progressão de carga no gráfico.
 */
export function maxWeightByDay(sessionSets) {
  const byDay = {};

  for (const set of sessionSets) {
    if (set.weightKg == null) continue;
    const day = set.completedAt.slice(0, 10);
    byDay[day] = Math.max(byDay[day] ?? 0, set.weightKg);
  }

  const days = Object.keys(byDay).sort();

  return {
    labels: days.map((d) => {
      const [, m, day] = d.split('-');
      return `${day}/${m}`;
    }),
    data: days.map((d) => byDay[d])
  };
}

/**
 * Igual a maxWeightByDay, mas agrupado por mês — melhor pra ver a
 * evolução de carga ao longo de várias semanas sem um gráfico lotado de
 * barras diárias. Mostra os últimos `monthsBack` meses, incluindo o atual.
 */
export function maxWeightByMonth(sessionSets, monthsBack = 6) {
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const today = new Date();

  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const byMonth = {};
  for (const set of sessionSets) {
    if (set.weightKg == null) continue;
    const month = set.completedAt.slice(0, 7);
    byMonth[month] = Math.max(byMonth[month] ?? 0, set.weightKg);
  }

  return {
    labels: months.map((m) => monthNames[Number(m.slice(5, 7)) - 1]),
    data: months.map((m) => byMonth[m] ?? null)
  };
}
