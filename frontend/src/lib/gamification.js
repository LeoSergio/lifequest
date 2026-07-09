// Regra simples pra começar: cada nível exige 100 XP a mais que o anterior.
// Nível 1 -> 2 precisa de 100 XP, nível 2 -> 3 precisa de 200 XP, etc.
// Fica fácil de ajustar depois sem mexer em quem consome essa função.
export function xpToNextLevel(level) {
  return level * 100;
}

/**
 * Aplica XP ganho ao estado atual do jogador, tratando level up
 * (inclusive múltiplos level ups de uma vez, se o ganho for grande).
 */
export function applyXp(currentLevel, currentXp, xpGained) {
  let level = currentLevel;
  let xp = currentXp + xpGained;
  let leveledUp = false;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    leveledUp = true;
  }

  return { level, xp, leveledUp };
}

export function xpProgressPercent(level, xp) {
  return Math.min(100, Math.round((xp / xpToNextLevel(level)) * 100));
}
