// Curva de XP com 'Early Wins' nos primeiros 5 níveis e crescimento exponencial depois.
export function xpToNextLevel(level) {
  if (level < 5) return level * 50; // Lvl 1: 50, Lvl 2: 100, Lvl 3: 150, Lvl 4: 200
  if (level < 15) return 200 + (level - 4) * 150; // Lvl 5: 350, Lvl 10: 1100
  return 1700 + Math.floor(Math.pow(level - 14, 1.8) * 100); // Lvl 15+, curva íngreme
}

/**
 * Aplica XP ganho ao estado atual do jogador, tratando level up
 * (inclusive múltiplos level ups de uma vez, se o ganho for grande).
 */
export function applyXp(currentLevel, currentXp, xpGained) {
  let level = Number(currentLevel) || 1;
  let xp = (Number(currentXp) || 0) + (Number(xpGained) || 0);
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
