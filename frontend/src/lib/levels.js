// Configuração do Sistema de Jornada (Nível 1 ao 67)

export const MAX_LEVEL = 67;

// Títulos a cada 5 níveis (mais AURA no 67)
export const LEVEL_TITLES = [
  { min: 1, max: 4, title: "Iniciante", color: "text-slate-400" },
  { min: 5, max: 9, title: "Desperto", color: "text-green-400" },
  { min: 10, max: 14, title: "Aprendiz", color: "text-emerald-400" },
  { min: 15, max: 19, title: "Guerreiro", color: "text-blue-400" },
  { min: 20, max: 24, title: "Gladiador", color: "text-indigo-400" },
  { min: 25, max: 29, title: "Veterano", color: "text-purple-400" },
  { min: 30, max: 34, title: "Guardião", color: "text-[#a855f7]" },
  { min: 35, max: 39, title: "Mestre", color: "text-fuchsia-400" },
  { min: 40, max: 44, title: "Campeão", color: "text-pink-400" },
  { min: 45, max: 49, title: "Lenda", color: "text-rose-400" },
  { min: 50, max: 54, title: "Titã", color: "text-orange-400" },
  { min: 55, max: 59, title: "Semideus", color: "text-amber-400" },
  { min: 60, max: 64, title: "Imortal", color: "text-yellow-400" },
  { min: 65, max: 66, title: "Transcendente", color: "text-yellow-300" },
  { min: 67, max: 67, title: "AURA", color: "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] font-black" }
];

export function getTitleForLevel(level) {
  if (level >= MAX_LEVEL) return LEVEL_TITLES[LEVEL_TITLES.length - 1];
  return LEVEL_TITLES.find(t => level >= t.min && level <= t.max) || LEVEL_TITLES[0];
}

// Verifica se o nível atual é um "Marco" (nível de mudança de título, ex: 5, 10, 15...)
export function isMilestoneLevel(level) {
  if (level === MAX_LEVEL) return true;
  return level > 1 && level % 5 === 0;
}

// Gera um valor aleatório entre min e max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera as recompensas (Baú) com base no nível e no status PRO do usuário.
 * Retorna um objeto detalhando os prêmios ganhos.
 */
export function generateChestReward(level, isPro) {
  const milestone = isMilestoneLevel(level);
  let rewards = {
    coins: 0,
    proCoins: 0,
    chestType: null, // 'none', 'bronze', 'silver', 'gold', 'diamond'
    milestone: milestone
  };

  // Base do Baú PRO (Ganha em TODO NÍVEL)
  if (isPro) {
    if (!milestone) {
      // Recompensa básica por upar um nível "comum" (PRO)
      rewards.coins = randomInt(10, 25);
      rewards.proCoins = randomInt(5, 15);
      rewards.chestType = 'bronze';
    } else {
      // Recompensa por upar num MARCO sendo PRO (Prêmio Grande)
      rewards.chestType = level >= 30 ? 'diamond' : 'gold';
      rewards.coins = randomInt(200, 500) * (Math.floor(level / 5) || 1);
      rewards.proCoins = randomInt(30, 80) * (Math.floor(level / 5) || 1);
    }
  } else {
    // Base do Baú FREE (Ganha em TODO NÍVEL também, mas sem proCoins)
    if (!milestone) {
      rewards.coins = randomInt(5, 15);
      rewards.chestType = 'bronze';
    } else {
      rewards.chestType = level >= 30 ? 'gold' : 'silver';
      rewards.coins = randomInt(50, 150) * (Math.floor(level / 5) || 1);
    }
  }

  // Bônus especial supremo da AURA (Lvl 67)
  if (level === MAX_LEVEL) {
    rewards.chestType = 'diamond';
    rewards.coins += 5000;
    if (isPro) rewards.proCoins += 1000;
  }

  return rewards;
}
