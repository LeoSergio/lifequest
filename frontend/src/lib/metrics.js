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
