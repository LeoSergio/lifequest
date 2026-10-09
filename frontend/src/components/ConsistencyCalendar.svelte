<script>
  export let sessions = [];
  export let workoutPlans = [];
  export let totalTrained = 0;
  export let streak = 0;
  export let columns = []; // Mantido para compatibilidade retroativa se necessário

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth(); // 0 a 11
  const todayDate = today.getDate();
  const todayIso = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

  let viewYear = todayYear;
  let viewMonth = todayMonth;
  let selectedDate = todayIso;

  const weekDayHeaders = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];

  function prevMonth() {
    if (viewMonth === 0) {
      viewMonth = 11;
      viewYear -= 1;
    } else {
      viewMonth -= 1;
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      viewMonth = 0;
      viewYear += 1;
    } else {
      viewMonth += 1;
    }
  }

  function goToToday() {
    viewYear = todayYear;
    viewMonth = todayMonth;
    selectedDate = todayIso;
  }

  function selectDay(day) {
    selectedDate = day.dateStr;
  }

  // Mapa com o nome dos planos de treino
  $: planMap = new Map((workoutPlans || []).map((p) => [p.id, p.name]));

  // Mapa de sessões indexadas pela data no formato YYYY-MM-DD
  $: sessionsByDate = (() => {
    const map = new Map();
    (sessions || []).forEach((s) => {
      const rawDate = s.finishedAt || s.startedAt;
      if (!rawDate) return;
      const dateKey = String(rawDate).slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey).push(s);
    });

    // Retrocompatibilidade se sessions estiver vazio mas columns existir
    if (map.size === 0 && columns && columns.length > 0) {
      columns.forEach((col) => {
        (col.days || []).forEach((d) => {
          if (d.trained || d.type === 'rest') {
            map.set(d.date, [{
              finishedAt: d.date,
              isRestDay: d.type === 'rest'
            }]);
          }
        });
      });
    }

    return map;
  })();

  // Monta a matriz de dias no formato da Agenda do Google (começando em DOM e terminando em SÁB)
  $: calendarDays = (() => {
    const days = [];
    const firstDay = new Date(viewYear, viewMonth, 1);
    const firstWeekday = firstDay.getDay(); // 0 = Domingo, 6 = Sábado
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Dias do mês anterior para completar a primeira semana
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionsByDate.get(iso) || [];
      const hasWorkout = daySessions.some((s) => s.finishedAt && !s.isRestDay);
      const isRest = daySessions.some((s) => s.isRestDay);
      const weekday = new Date(prevY, prevM, d).getDay();

      days.push({
        dayNumber: d,
        dateStr: iso,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        weekday,
        isWeekend: weekday === 0 || weekday === 6,
        hasWorkout,
        isRest,
        sessions: daySessions
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionsByDate.get(iso) || [];
      const hasWorkout = daySessions.some((s) => s.finishedAt && !s.isRestDay);
      const isRest = daySessions.some((s) => s.isRestDay);
      const weekday = new Date(viewYear, viewMonth, d).getDay();

      days.push({
        dayNumber: d,
        dateStr: iso,
        isCurrentMonth: true,
        isToday: iso === todayIso,
        weekday,
        isWeekend: weekday === 0 || weekday === 6,
        hasWorkout,
        isRest,
        sessions: daySessions
      });
    }

    // Dias do próximo mês para completar a última linha
    const remainder = days.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let d = 1; d <= needed; d++) {
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        const iso = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const daySessions = sessionsByDate.get(iso) || [];
        const hasWorkout = daySessions.some((s) => s.finishedAt && !s.isRestDay);
        const isRest = daySessions.some((s) => s.isRestDay);
        const weekday = new Date(nextY, nextM, d).getDay();

        days.push({
          dayNumber: d,
          dateStr: iso,
          isCurrentMonth: false,
          isToday: iso === todayIso,
          weekday,
          isWeekend: weekday === 0 || weekday === 6,
          hasWorkout,
          isRest,
          sessions: daySessions
        });
      }
    }

    return days;
  })();

  // Total de treinos no mês atualmente visualizado
  $: monthTrainedCount = calendarDays.filter((d) => d.isCurrentMonth && d.hasWorkout).length;

  // Informações do dia selecionado para exibição detalhada
  $: selectedDay = calendarDays.find((d) => d.dateStr === selectedDate) || null;

  function formatDisplayDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${parseInt(d, 10)} de ${months[parseInt(m, 10) - 1]} de ${y}`;
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
</script>

<div class="w-full bg-black text-white select-none">
  <!-- Cabeçalho idêntico à Agenda do Google: MM / YYYY -->
  <div class="flex items-center justify-between mb-6 px-1">
    <div class="flex items-baseline gap-3">
      <h2 class="text-3xl font-light tracking-wide text-white font-sans">
        {String(viewMonth + 1).padStart(2, '0')} / {viewYear}
      </h2>
      {#if viewYear !== todayYear || viewMonth !== todayMonth}
        <button
          type="button"
          class="text-[11px] font-semibold text-[#4c8bf5] hover:text-white px-2.5 py-1 rounded-full border border-[#4c8bf5]/30 hover:border-white/40 transition-colors"
          on:click={goToToday}
        >
          Hoje
        </button>
      {/if}
    </div>

    <!-- Navegação de meses -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
        on:click={prevMonth}
        title="Mês anterior"
        aria-label="Mês anterior"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button
        type="button"
        class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
        on:click={nextMonth}
        title="Próximo mês"
        aria-label="Próximo mês"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </div>

  <!-- Cabeçalho dos dias da semana (DOM. SEG. TER. QUA. QUI. SEX. SÁB.) -->
  <div class="grid grid-cols-7 mb-3 text-center">
    {#each weekDayHeaders as header}
      <span class="text-[11px] font-medium tracking-wider text-[#9aa0a6]">
        {header}
      </span>
    {/each}
  </div>

  <!-- Grade dos dias do mês (7 colunas) -->
  <div class="grid grid-cols-7 gap-y-3.5 text-center">
    {#each calendarDays as day (day.dateStr)}
      {@const isSelected = selectedDate === day.dateStr}
      <button
        type="button"
        class="flex flex-col items-center justify-center group focus:outline-none"
        on:click={() => selectDay(day)}
      >
        <!-- Caixa do dia (squircle azul sólido para o dia de hoje, idêntico à Google Agenda) -->
        <div
          class="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-all {day.isToday ? 'bg-[#1a73e8] rounded-[14px] shadow-[0_2px_10px_rgba(26,115,232,0.4)]' : isSelected ? 'rounded-[14px] ring-1 ring-white/30 bg-white/5' : 'rounded-[14px] group-hover:bg-white/5'}"
        >
          <span
            class="text-[16px] sm:text-[17px] {day.isToday ? 'text-white font-medium' : day.isWeekend ? (day.isCurrentMonth ? 'text-[#4c8bf5]' : 'text-[#1e3b66]') : (day.isCurrentMonth ? 'text-white' : 'text-[#404347]')}"
          >
            {day.dayNumber}
          </span>
        </div>

        <!-- Indicador de consistência (pontinho sutil exatamente igual à Google Agenda) -->
        <div class="h-2 flex items-center justify-center mt-0.5">
          {#if day.hasWorkout}
            <span
              class="w-[4.5px] h-[4.5px] rounded-full {day.isToday ? 'bg-white' : 'bg-[#9aa0a6]'}"
              title="Treino concluído"
            ></span>
          {:else if day.isRest}
            <span
              class="w-[4.5px] h-[4.5px] rounded-full bg-[#4c8bf5]"
              title="Descanso registrado"
            ></span>
          {:else}
            <span class="w-[4.5px] h-[4.5px] opacity-0"></span>
          {/if}
        </div>
      </button>
    {/each}
  </div>

  <!-- Detalhe do dia selecionado -->
  {#if selectedDay}
    <div class="mt-6 pt-4 border-t border-white/10">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[12px] font-bold text-white/90">
          {formatDisplayDate(selectedDay.dateStr)}
        </p>
        {#if selectedDay.isToday}
          <span class="text-[9px] font-bold bg-[#1a73e8]/20 text-[#4c8bf5] border border-[#1a73e8]/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Hoje
          </span>
        {/if}
      </div>

      {#if selectedDay.hasWorkout || selectedDay.isRest}
        <div class="flex flex-col gap-2">
          {#each selectedDay.sessions as s}
            {#if s.isRestDay}
              <div class="flex items-center justify-between bg-white/5 border border-blue-500/20 rounded-[12px] p-2.5">
                <span class="text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
                  <span>💤</span>
                  <span>Dia de Descanso</span>
                </span>
                <span class="text-[10px] text-white/40">Recuperação</span>
              </div>
            {:else if s.finishedAt}
              <div class="flex items-center justify-between bg-white/5 border border-purple-500/20 rounded-[12px] p-2.5">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                  <span class="text-[11px] font-bold text-white">
                    {planMap.get(s.workoutPlanId) || 'Treino Concluído'}
                  </span>
                </div>
                {#if s.finishedAt}
                  <span class="text-[10px] text-white/40">
                    {formatTime(s.finishedAt)}
                  </span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="text-[10px] text-white/40 py-1">
          Nenhum treino registrado neste dia.
        </p>
      {/if}
    </div>
  {/if}

  <!-- Resumo de consistência / Estatísticas -->
  <div class="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/10 text-center">
    <div class="bg-white/5 rounded-[12px] p-2.5">
      <p class="text-[16px] font-black text-white">{monthTrainedCount}</p>
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-semibold">No mês</p>
    </div>
    <div class="bg-white/5 rounded-[12px] p-2.5">
      <p class="text-[16px] font-black text-orange-400 flex items-center justify-center gap-1">
        {streak}
        <span class="text-xs">🔥</span>
      </p>
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Ofensiva</p>
    </div>
    <div class="bg-white/5 rounded-[12px] p-2.5">
      <p class="text-[16px] font-black text-[#4c8bf5]">{totalTrained}</p>
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Total treinos</p>
    </div>
  </div>
</div>
