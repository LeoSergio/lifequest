/**
 * Repositório de treinos — encapsula acesso às tabelas de workout.
 *
 * Tabelas gerenciadas: workoutPlans, workoutPlanExercises, exercises,
 * workoutSessions, sessionSets.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db.js';

// --- Queries reativas ---

export const workoutPlansQuery = () => liveQuery(() => db.workoutPlans.toArray());

export const exerciseCatalogQuery = () => liveQuery(() => db.exercises.toArray());

export const allSessionSetsQuery = () => liveQuery(() => db.sessionSets.toArray());

export const planSessionsQuery = (planId) =>
  liveQuery(() => db.workoutSessions.where('workoutPlanId').equals(planId).toArray());

export const planExerciseLinksQuery = (planId) =>
  liveQuery(() =>
    db.workoutPlanExercises.where('workoutPlanId').equals(planId).sortBy('order')
  );

// --- Operações de escrita ---

export async function removePlan(planId) {
  return db.transaction('rw', db.workoutPlans, db.workoutPlanExercises, async () => {
    await db.workoutPlans.delete(planId);
    await db.workoutPlanExercises.where('workoutPlanId').equals(planId).delete();
  });
}

export async function addExerciseLink({ workoutPlanId, exerciseId, order, targetSets, targetReps, restSeconds }) {
  return db.workoutPlanExercises.add({
    workoutPlanId,
    exerciseId,
    order,
    targetSets: Number(targetSets),
    targetReps,
    restSeconds: Number(restSeconds)
  });
}

export async function removeExerciseLink(linkId) {
  return db.workoutPlanExercises.delete(linkId);
}

export async function findOrCreateExercise(catalog, name, muscleGroup, equipment) {
  const trimmed = name.trim();
  const existing = catalog.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    await db.exercises.update(existing.id, { muscleGroup, equipment });
    return existing.id;
  }
  return db.exercises.add({ name: trimmed, muscleGroup, equipment });
}

export async function countPlanExercises(planId) {
  return db.workoutPlanExercises.where('workoutPlanId').equals(planId).count();
}

export async function startSession(planId) {
  return db.workoutSessions.add({
    workoutPlanId: planId,
    startedAt: new Date().toISOString(),
    finishedAt: null
  });
}

export async function finishSession(sessionId) {
  return db.workoutSessions.update(sessionId, { finishedAt: new Date().toISOString() });
}

export async function saveSet({ workoutSessionId, workoutPlanExerciseId, exerciseId, setNumber, weightKg, repsDone }) {
  return db.sessionSets.add({
    workoutSessionId,
    workoutPlanExerciseId,
    exerciseId,
    setNumber,
    weightKg,
    repsDone,
    completedAt: new Date().toISOString()
  });
}

export async function updateSet(id, { weightKg, repsDone }) {
  return db.sessionSets.update(id, {
    weightKg,
    repsDone,
    completedAt: new Date().toISOString()
  });
}
