<script>
  import { xpToNextLevel, xpProgressPercent } from '../lib/gamification.js';

  export let level;
  export let xp;
  export let streak;

  $: progress = xpProgressPercent(level, xp);
  $: needed = xpToNextLevel(level);
</script>

<div class="bg-surface/80 border border-white/5 rounded-2xl p-4 flex gap-5 items-center">
  <!-- Badge/Shield -->
  <div class="flex flex-col items-center shrink-0 w-[72px]">
    <div class="relative w-16 h-16 flex items-center justify-center mb-1">
      <div class="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
      <div class="w-14 h-16 bg-gradient-to-br from-primary to-[#4a2eaf] rounded-lg border border-primary/40 flex items-center justify-center shadow-[0_0_15px_rgba(124,92,255,0.4)]">
        <span class="absolute text-2xl font-black text-white">{level}</span>
      </div>
      <!-- Decorative laurels -->
      <span class="absolute -left-2 top-2 text-primary/60 text-lg -rotate-12">🌿</span>
      <span class="absolute -right-2 top-2 text-primary/60 text-lg rotate-12 scale-x-[-1]">🌿</span>
    </div>
    <span class="text-sm font-bold mt-1 text-white">Nível {level}</span>
    <span class="text-[9px] bg-primary/20 text-primary px-2.5 py-0.5 rounded-full mt-1 border border-primary/20">{level < 5 ? 'Iniciante' : level < 15 ? 'Intermediário' : 'Avançado'}</span>
  </div>

  <!-- Progress -->
  <div class="flex-1">
    <div class="flex justify-between text-[11px] mb-2">
      <span class="text-white/80">Seu progresso</span>
      <span class="text-white/60"><span class="text-primary font-bold">{xp}</span> / {needed} XP</span>
    </div>
    
    <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-1.5">
      <div class="bg-primary h-full rounded-full transition-all shadow-[0_0_8px_rgba(124,92,255,0.8)]" style="width: {progress}%"></div>
    </div>
    
    <p class="text-[10px] text-white/50 mb-3"><span class="text-primary font-medium">{progress}%</span> até o nível {level + 1}</p>
    
    <div class="flex items-center justify-between text-xs text-white/50 pt-3 border-t border-white/5 w-full cursor-pointer hover:text-white/70 transition-colors">
      <span class="flex items-center gap-1.5"><span class="text-orange-500">🔥</span> Streak: {streak} dia{streak === 1 ? '' : 's'}</span>
      <span class="text-white/30 font-bold">›</span>
    </div>
  </div>
</div>
