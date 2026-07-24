<script>
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';
  import { workoutPlansQuery } from '../repositories/workoutRepository.js';
  import { removePlan } from '../services/workoutService.js';

  const plans = workoutPlansQuery();
  let openMenuId = null;

  function weekdayLabel(plan) {
    if (plan.weekdays && plan.weekdays.length > 0) {
      const sorted = [...plan.weekdays].sort((a, b) => {
        const iA = WEEKDAYS.findIndex(w => w.value === a);
        const iB = WEEKDAYS.findIndex(w => w.value === b);
        return iA - iB;
      });
      return sorted.map(w => WEEKDAYS.find(x => x.value === w)?.label).join(', ');
    }
    if (plan.weekday) {
      return WEEKDAYS.find((w) => w.value === plan.weekday)?.label ?? 'Livre';
    }
    return 'Livre';
  }

  function toggleMenu(id) {
    openMenuId = openMenuId === id ? null : id;
  }

  async function handleRemovePlan(id) {
    openMenuId = null;
    if (!confirm('Remover este treino e todos os exercícios dele?')) return;
    await removePlan(id);
  }
</script>

<div class="flex justify-between items-center mb-4">
  <h2 class="text-xl font-bold text-white">Seus Treinos</h2>
  <button
    class="bg-[#9333EA] text-white rounded-[10px] px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:bg-[#a855f7] transition-colors"
    on:click={() => navigate('training-new')}
  >
    <span class="text-lg leading-none mt-[-2px]">+</span> Novo
  </button>
</div>

<button class="text-[10px] text-[#a855f7] mb-6 flex items-center gap-1 font-bold hover:text-[#c084fc] transition-colors" on:click={() => navigate('training-metrics')}>
  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
  VER MÉTRICAS DE DESEMPENHO
</button>

{#if $plans === undefined}
  <p class="text-xs text-white/40 text-center py-6">Carregando...</p>
{:else if $plans.length === 0}
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-8 text-center shadow-inner">
    <p class="text-sm font-bold text-white mb-1">Nenhum treino</p>
    <p class="text-[10px] text-white/40">Toque em "+ Novo" para criar a sua primeira ficha.</p>
  </div>
{:else}
  <div class="flex flex-col gap-3">
    {#each $plans as plan (plan.id)}
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex items-center gap-3 relative shadow-inner">
        <button
          class="flex items-center gap-3 flex-1 min-w-0 text-left group"
          on:click={() => navigate('workout-plan-detail', { planId: plan.id })}
        >
          <div class="w-12 h-12 shrink-0 rounded-[12px] flex items-center justify-center bg-gradient-to-br from-[#9333EA] to-[#5b21b6] shadow-lg border border-white/10 group-hover:scale-105 transition-transform">
             <svg class="w-6 h-6 text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15V9"/><path d="M18 15V9"/><path d="M6 12h12"/><path d="M3 15v-6"/><path d="M21 15v-6"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-white text-[13px] truncate">{plan.name}</h3>
            <p class="text-[10px] text-white/40 truncate">
              <span class="text-[#a855f7] font-medium">{weekdayLabel(plan)}</span>
              {#if plan.focus} · {plan.focus}{/if}
            </p>
          </div>
        </button>

        <button
          class="text-white/20 px-2 py-1 text-lg shrink-0 hover:text-white/60 transition-colors"
          on:click|stopPropagation={() => toggleMenu(plan.id)}
        >
          ⋮
        </button>

        {#if openMenuId === plan.id}
          <div class="absolute right-3 top-12 bg-[#1C1C22] border border-white/10 rounded-lg shadow-xl py-1 z-10 w-32 backdrop-blur-md">
            <button
              class="w-full text-left px-3 py-2 text-[11px] font-bold text-white hover:bg-white/5 transition-colors border-b border-white/5"
              on:click|stopPropagation={() => { openMenuId = null; navigate('workout-plan-detail', { planId: plan.id, edit: true }); }}
            >
              Editar Ficha
            </button>
            <button
              class="w-full text-left px-3 py-2 text-[11px] font-bold text-red-400 hover:bg-white/5 transition-colors"
              on:click|stopPropagation={() => handleRemovePlan(plan.id)}
            >
              Excluir treino
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
