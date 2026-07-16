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
  const trainedDays = new Set(
    sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)),
  );

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
  const trainedDays = new Set(
    sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)),
  );
  const dayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];
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
      isToday: i === 0,
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
  const trainedDays = new Set(
    sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)),
  );
  const monthLabels = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

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
      days.push({
        date: iso,
        trained: trainedDays.has(iso),
        isToday: iso === today,
        isFuture: iso > today,
      });
    }
    columns.push({
      days,
      monthLabel: monthLabels[new Date(days[0].date).getMonth()],
    });
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
      const [, m, d] = w.split("-");
      return `${d}/${m}`;
    }),
    data: weeks.map((w) => counts[w]),
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
      const [, m, day] = d.split("-");
      return `${day}/${m}`;
    }),
    data: days.map((d) => byDay[d]),
  };
}

const MONTH_LABELS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * Monta os "baldes" de tempo usados no dashboard de Desempenho (Carga /
 * Volume / Repetições / PRs), de acordo com o período escolhido:
 *   - 7 dias  → 1 balde por dia (7 pontos)
 *   - 30 dias → 1 balde por semana (~5 pontos)
 *   - 60 dias → 1 balde por semana (~9 pontos)
 *   - Tudo    → 1 balde por mês, desde o registro mais antigo
 * `days` é 7, 30, 60 ou null (Tudo). `sessionSets` só é usado quando
 * days é null, pra saber a partir de quando gerar os baldes mensais.
 */
export function buildPeriodBuckets(sessionSets, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];

  if (days === 7) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const start = d.toISOString().slice(0, 10);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      buckets.push({
        start,
        end: end.toISOString().slice(0, 10),
        label: `${start.slice(8, 10)}/${start.slice(5, 7)}`,
      });
    }
    return buckets;
  }

  if (days === 30 || days === 60) {
    const weeks = Math.ceil(days / 7);
    const currentWeekStart = new Date(startOfWeek(today));
    const gridStart = new Date(currentWeekStart);
    gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

    for (let w = 0; w < weeks; w++) {
      const start = new Date(gridStart);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const startIso = start.toISOString().slice(0, 10);
      buckets.push({
        start: startIso,
        end: end.toISOString().slice(0, 10),
        label: `${startIso.slice(8, 10)}/${startIso.slice(5, 7)}`,
      });
    }
    return buckets;
  }

  // Tudo: um balde por mês, desde o registro mais antigo até hoje.
  const dated = sessionSets.filter((s) => s.completedAt);
  if (dated.length === 0) return [];

  const earliest = dated.reduce(
    (min, s) => (s.completedAt < min ? s.completedAt : min),
    dated[0].completedAt,
  );
  const cursor = new Date(earliest.slice(0, 7) + "-01");
  const end = new Date(today.toISOString().slice(0, 7) + "-01");

  while (cursor <= end) {
    const startIso = cursor.toISOString().slice(0, 10);
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    buckets.push({
      start: startIso,
      end: next.toISOString().slice(0, 10),
      label: `${MONTH_LABELS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/** Soma de weightKg × repsDone — "tonelagem" total levantada num conjunto de séries. */
export function totalTonnage(sets) {
  return sets.reduce(
    (sum, s) =>
      s.weightKg != null && s.repsDone != null
        ? sum + s.weightKg * s.repsDone
        : sum,
    0,
  );
}

/** Quantidade de séries registradas (com reps preenchidas). */
export function totalSetCount(sets) {
  return sets.filter((s) => s.repsDone != null).length;
}

/** Soma de repetições feitas. */
export function totalReps(sets) {
  return sets.reduce(
    (sum, s) => (s.repsDone != null ? sum + s.repsDone : sum),
    0,
  );
}

/**
 * Marca cada série que representa um recorde pessoal (PR): o maior peso
 * já levantado até ali para aquele exercício específico. Precisa rodar
 * sobre o HISTÓRICO COMPLETO (não só o período filtrado), porque saber
 * se algo é recorde depende do que veio antes.
 */
export function computePRs(allSessionSets) {
  const bestByExercise = {};
  const sorted = [...allSessionSets]
    .filter((s) => s.weightKg != null && s.completedAt)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const prs = [];
  for (const set of sorted) {
    const best = bestByExercise[set.exerciseId] ?? -Infinity;
    if (set.weightKg > best) {
      bestByExercise[set.exerciseId] = set.weightKg;
      prs.push(set);
    }
  }
  return prs;
}

/**
 * Agrupa um conjunto de baldes de tempo + sessionSets numa série
 * {labels, data}, aplicando `valueFn` a cada balde.
 */
export function bucketSeries(sessionSets, buckets, valueFn) {
  return {
    labels: buckets.map((b) => b.label),
    data: buckets.map((b) =>
      valueFn(
        sessionSets.filter(
          (s) => s.completedAt >= b.start && s.completedAt < b.end,
        ),
      ),
    ),
  };
}

/** Variação percentual entre dois totais — usada no "vs período anterior". */
export function percentDelta(current, previous) {
  if (previous === 0) return current > 0 ? null : 0; // sem base de comparação
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Tonelagem total levantada por grupo muscular, cruzando sessionSets (que
 * guardam exerciseId) com o catálogo de exercícios (que guarda
 * muscleGroup) — usado na seção "Grupos musculares" do dashboard.
 */
export function tonnageByMuscleGroup(sessionSets, catalog) {
  const groupByExercise = new Map(
    catalog.map((e) => [e.id, e.muscleGroup ?? "Outro"]),
  );
  const totals = {};

  for (const set of sessionSets) {
    if (set.weightKg == null || set.repsDone == null) continue;
    const group = groupByExercise.get(set.exerciseId) ?? "Outro";
    totals[group] = (totals[group] ?? 0) + set.weightKg * set.repsDone;
  }

  return Object.entries(totals)
    .map(([group, kg]) => ({ group, kg }))
    .sort((a, b) => b.kg - a.kg);
}

/**
 * Intervalo de datas [start, end] (YYYY-MM-DD, inclusive) pro seletor
 * semana/mês/trimestre do card "Resumo" do Dashboard (PeriodSummary).
 */
export function periodRange(period) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  const daysBack = period === "semana" ? 6 : period === "mes" ? 29 : 89; // trimestre ~ 90 dias
  start.setDate(start.getDate() - daysBack);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Quantas sessões de treino foram concluídas dentro do período. */
export function workoutsInRange(sessions, range) {
  return sessions.filter(
    (s) =>
      s.finishedAt &&
      s.finishedAt.slice(0, 10) >= range.start &&
      s.finishedAt.slice(0, 10) <= range.end,
  ).length;
}

/**
 * Taxa de sucesso dos hábitos diários dentro do período — mesma lógica de
 * lib/habits.js:successRate, só que parametrizada pelo intervalo em vez de
 * fixa em 7 dias. Hábitos semanais ficam de fora, igual ao successRate
 * (eles têm sua própria barra de progresso em outro lugar da UI).
 */
export function habitsCompletionRateInRange(habits, completions, range) {
  const dailyHabits = habits.filter(
    (h) => h.cadence === "daily" && !h.archivedAt,
  );
  if (dailyHabits.length === 0) return null;

  let total = 0;
  let hit = 0;

  for (
    const d = new Date(range.start);
    d.toISOString().slice(0, 10) <= range.end;
    d.setDate(d.getDate() + 1)
  ) {
    const iso = d.toISOString().slice(0, 10);
    for (const habit of dailyHabits) {
      total += 1;
      if (completions.some((c) => c.habitId === habit.id && c.date === iso))
        hit += 1;
    }
  }

  return total === 0 ? null : Math.round((hit / total) * 100);
}

/**
 * Variação de peso dentro do período (última medição − primeira medição
 * com peso preenchido). Retorna null se houver menos de 2 medições no
 * período — não dá pra falar em "tendência" com um ponto só.
 */
export function weightDeltaInRange(measurements, range) {
  const filtered = measurements
    .filter(
      (m) => m.weight != null && m.date >= range.start && m.date <= range.end,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length < 2) return null;

  const first = filtered[0].weight;
  const last = filtered[filtered.length - 1].weight;

  return {
    delta: Math.round((last - first) * 10) / 10,
    last,
    labels: filtered.map((m) => m.date.slice(5).split("-").reverse().join("/")),
    data: filtered.map((m) => m.weight),
  };
}

/** Quantas metas foram batidas (achievedAt preenchido) dentro do período. */
export function goalsAchievedInRange(goals, range) {
  return goals.filter(
    (g) =>
      g.achievedAt &&
      g.achievedAt.slice(0, 10) >= range.start &&
      g.achievedAt.slice(0, 10) <= range.end,
  ).length;
}
