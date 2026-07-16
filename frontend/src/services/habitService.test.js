import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeHabit } from './habitService.js';
import * as habitRepo from '../repositories/habitRepository.js';
import * as playerRepo from '../repositories/playerRepository.js';

// Falsificamos (mock) as funções que vão no banco de dados Dexie
vi.mock('../repositories/habitRepository.js');
vi.mock('../repositories/playerRepository.js');

describe('habitService - completeHabit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve marcar o hábito como concluído e conceder XP (sem upar de level)', async () => {
    // Simulamos um player no nível 1 com 0 XP
    playerRepo.getPlayer.mockResolvedValue({ id: 1, level: 1, xp: 0 });
    
    const habit = { id: 10, cadence: 'daily', xpReward: 20 };
    const completitions = []; // Hábito ainda não foi feito hoje

    const result = await completeHabit(habit, completitions);

    // O Dexie (mockado) foi chamado para salvar a conclusão?
    expect(habitRepo.addCompletion).toHaveBeenCalledTimes(1);
    
    // O Player foi atualizado com 20 XP a mais?
    expect(playerRepo.updatePlayer).toHaveBeenCalledWith(1, { level: 1, xp: 20 });
    
    // Não deve upar de level (precisa de 100 XP pro level 2)
    expect(result).toEqual({ leveledUp: false, level: 1 });
  });

  it('deve upar de level se a recompensa de XP passar do limite', async () => {
    // Simulamos um player quase subindo de nível (faltam 10 de XP)
    playerRepo.getPlayer.mockResolvedValue({ id: 1, level: 1, xp: 90 });
    
    // Hábito dá 20 de XP (vai passar pra 110, logo Level 2 com 10 sobrando)
    const habit = { id: 10, cadence: 'daily', xpReward: 20 };
    
    const result = await completeHabit(habit, []);

    // Foi salvo no banco corretamente com os novos cálculos?
    expect(playerRepo.updatePlayer).toHaveBeenCalledWith(1, { level: 2, xp: 10 });
    
    // O service avisou que teve Level Up pra UI poder disparar confetes?
    expect(result).toEqual({ leveledUp: true, level: 2 });
  });

  it('deve rejeitar se o hábito diário já foi feito hoje', async () => {
    const habit = { id: 10, cadence: 'daily', xpReward: 20 };
    
    // Fingimos que o hábito já está na lista de completados de hoje
    const today = new Date().toISOString().slice(0, 10);
    const completitions = [{ habitId: 10, date: today }];

    const result = await completeHabit(habit, completitions);

    // Deve retornar nulo e não tocar no banco
    expect(result).toBeNull();
    expect(habitRepo.addCompletion).not.toHaveBeenCalled();
    expect(playerRepo.updatePlayer).not.toHaveBeenCalled();
  });
});
