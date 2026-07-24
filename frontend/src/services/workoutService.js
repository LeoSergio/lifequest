/**
 * Service de treinos — use cases da funcionalidade de workout.
 *
 * Orquestra: iniciar/finalizar sessão, salvar séries, aplicar XP ao fim
 * do treino. Não sabe nada sobre Svelte ou a UI.
 */
import { applyXp } from '../lib/gamification.js';
import {
  addExerciseLink,
  countPlanExercises,
  findOrCreateExercise,
  finishSession,
  removeExerciseLink,
  removePlan,
  saveSet,
  startSession,
  updateSet
} from '../repositories/workoutRepository.js';
import { getPlayer, updatePlayer } from '../repositories/playerRepository.js';
import { checkAchievements } from '../lib/achievements.js';

export { removePlan, removeExerciseLink };

export async function addExerciseToPlan({ planId, catalog, exerciseName, muscleGroup, equipment, targetSets, targetReps, restSeconds }) {
  const exerciseId = await findOrCreateExercise(catalog, exerciseName, muscleGroup, equipment);
  const order = await countPlanExercises(planId);
  return addExerciseLink({ workoutPlanId: planId, exerciseId, order, targetSets, targetReps, restSeconds });
}

export async function startWorkout(planId) {
  return startSession(planId);
}

/**
 * Grava (ou atualiza) uma série de um exercício.
 *
 * Evita criar registro vazio se nenhum valor foi digitado.
 */
export async function persistSet({ activeSession, activeSets, link, setNumber, input }) {
  const weightKg = input?.weight === '' || input?.weight == null ? null : Number(input.weight);
  const repsDone = input?.reps === '' || input?.reps == null ? null : Number(input.reps);

  const existing = activeSets.find(
    (s) => s.workoutPlanExerciseId === link.id && s.setNumber === setNumber
  );

  if (!existing && weightKg == null && repsDone == null) return;

  if (existing) {
    return updateSet(existing.id, { weightKg, repsDone });
  }

  return saveSet({
    workoutSessionId: activeSession.id,
    workoutPlanExerciseId: link.id,
    exerciseId: link.exerciseId,
    setNumber,
    weightKg,
    repsDone
  });
}

/**
 * Finaliza o treino: persiste séries pendentes, marca sessão como
 * concluída e aplica XP ao jogador.
 *
 * Retorna `{ xpReward, leveledUp, level }` para a UI exibir o alerta.
 */
export async function finishWorkout({ activeSession, exercises, activeSets, setInputs }) {
  // Rede de segurança: salva séries preenchidas mas não submetidas
  for (const link of exercises) {
    for (let setNumber = 1; setNumber <= link.targetSets; setNumber++) {
      const key = `${link.id}-${setNumber}`;
      const input = setInputs[key];
      const alreadySaved = activeSets.find(
        (s) => s.workoutPlanExerciseId === link.id && s.setNumber === setNumber
      );
      if (input && !alreadySaved && (input.weight !== '' || input.reps !== '')) {
        await persistSet({ activeSession, activeSets, link, setNumber, input });
      }
    }
  }

  await finishSession(activeSession.id);

  // XP proporcional ao tamanho do treino, com um piso mínimo
  const xpReward = Math.max(30, exercises.length * 15);

  const player = await getPlayer();
  const { level, xp, leveledUp } = applyXp(player.level, player.xp, xpReward);
  await updatePlayer(player.id, { level, xp });

  await checkAchievements();

  return { xpReward, leveledUp, level };
}
