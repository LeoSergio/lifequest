<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let show = false;
  
  const dispatch = createEventDispatcher();

  let currentDate = new Date();
  let selectedDate = new Date();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  $: currentMonth = currentDate.getMonth();
  $: currentYear = currentDate.getFullYear();

  let calendarDays = [];

  function updateCalendar(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let days = [];

    // Dias do mês anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Dias do próximo mês para completar 42 células (6 semanas)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    calendarDays = days;
  }

  $: updateCalendar(currentYear, currentMonth);

  function prevMonth() {
    currentDate = new Date(currentYear, currentMonth - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentYear, currentMonth + 1, 1);
  }

  function selectDate(d) {
    selectedDate = d;
    // se clicar num dia fora do mes atual, navega pra ele
    if (d.getMonth() !== currentMonth) {
      currentDate = new Date(d);
    }
  }

  function handleConfirm() {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    dispatch('confirm', `${yyyy}-${mm}-${dd}`);
  }

  function handleClose() {
    dispatch('close');
  }

  function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }
  
  function isToday(d) {
    return isSameDay(d, new Date());
  }
</script>

{#if show}
  <div class="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" transition:fade={{duration: 150}} on:click={handleClose}></div>

  <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-gradient-to-b from-[#1a1726] to-[#141020] border border-white/10 rounded-t-[28px] p-6 pb-8 z-[9999] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4"
       transition:fly={{ y: 24, duration: 260, easing: cubicOut }}>
       
    <div class="w-16 h-16 rounded-[20px] bg-blue-500/15 border border-blue-500/30 shadow-[0_0_24px_rgba(59,130,246,0.25)] flex items-center justify-center text-3xl mb-1">
      💤
    </div>
    
    <div class="text-center w-full">
      <h2 class="text-lg font-bold text-white leading-tight">Dia de Descanso</h2>
      <p class="text-[14px] text-white/55 mt-1">Quando você descansou?</p>
    </div>

    <div class="w-full bg-white/5 border border-white/10 rounded-[20px] p-4 mt-2">
      <!-- Calendar Header -->
      <div class="flex items-center justify-between mb-4">
        <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 transition-colors" on:click={prevMonth}>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="text-[15px] font-bold text-white capitalize">{monthNames[currentMonth]} {currentYear}</span>
        <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 transition-colors" on:click={nextMonth}>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Days of Week -->
      <div class="grid grid-cols-7 gap-1 mb-2">
        {#each dayNames as day}
          <div class="text-center text-[11px] font-bold text-white/40">{day}</div>
        {/each}
      </div>

      <!-- Days Grid -->
      <div class="grid grid-cols-7 gap-1">
        {#each calendarDays as day}
          <button
            class="h-9 w-full rounded-full flex items-center justify-center text-[13px] font-medium transition-all
              {isSameDay(day.date, selectedDate) ? 'bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.4)]' : 
               isToday(day.date) ? 'bg-white/10 text-blue-400 border border-blue-500/30' : 
               day.isCurrentMonth ? 'text-white/80 hover:bg-white/10' : 'text-white/20 hover:bg-white/5'}
            "
            on:click={() => selectDate(day.date)}
          >
            {day.date.getDate()}
          </button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 w-full mt-2">
      <button class="py-3.5 px-4 rounded-[16px] text-[15px] font-bold bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-colors" on:click={handleClose}>
        Cancelar
      </button>
      <button class="py-3.5 px-4 rounded-[16px] text-[15px] font-bold bg-blue-500 text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:brightness-110 transition-all" on:click={handleConfirm}>
        Registrar
      </button>
    </div>
  </div>
{/if}
