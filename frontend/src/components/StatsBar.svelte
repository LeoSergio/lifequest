<script>
  import { xpToNextLevel, xpProgressPercent } from '../lib/gamification.js';

  export let level;
  export let xp;
  export let streak;

  $: progress = xpProgressPercent(level, xp);
  $: needed = xpToNextLevel(level);
</script>

<div class="bg-surface rounded-xl p-4">
  <div class="flex justify-between items-baseline mb-1">
    <span class="font-semibold">Nível {level}</span>
    <span class="text-xs text-white/50">{xp} / {needed} XP</span>
  </div>
  <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
    <div class="bg-xp h-2 rounded-full transition-all" style="width: {progress}%"></div>
  </div>
  <p class="text-xs text-white/50 mt-2">🔥 Streak: {streak} dia{streak === 1 ? '' : 's'}</p>
</div>
