<script>
  export let columns = []; // vem de weeklyCalendar() em lib/metrics.js
  export let totalTrained = 0;
  export let streak = 0;

  const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

  function levelColor(day) {
    if (day.isFuture) return 'bg-white/5';
    if (!day.trained) return 'bg-white/10';
    return day.isToday ? 'bg-xp' : 'bg-primary';
  }
</script>

<div>
  <div class="flex gap-1 mb-1 pl-6">
    {#each columns as col, i}
      <span class="text-[9px] text-white/30 w-[14px] text-center">
        {i === 0 || col.monthLabel !== columns[i - 1].monthLabel ? col.monthLabel : ''}
      </span>
    {/each}
  </div>

  <div class="flex gap-1">
    <div class="flex flex-col gap-1 pt-[1px]">
      {#each dayLabels as label, i}
        <span class="text-[9px] w-6 h-[14px] leading-[14px] {i % 2 === 0 ? 'text-white/30' : 'text-transparent'}">
          {label}
        </span>
      {/each}
    </div>

    <div class="flex gap-1">
      {#each columns as col}
        <div class="flex flex-col gap-1">
          {#each col.days as day}
            <div class="w-[14px] h-[14px] rounded {levelColor(day)}" title={day.date}></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="flex justify-around mt-4">
    <div class="text-center">
      <p class="text-lg font-bold">{totalTrained}</p>
      <p class="text-[10px] text-white/40">treinos no período</p>
    </div>
    <div class="text-center">
      <p class="text-lg font-bold">{streak}</p>
      <p class="text-[10px] text-white/40">dias seguidos</p>
    </div>
  </div>
</div>
