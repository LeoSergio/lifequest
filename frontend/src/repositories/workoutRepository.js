import { liveQuery } from 'dexie';
import { db } from '../db/db.js';
import { generateId } from '../lib/id.js';
import { enqueue } from '../services/syncService.js';

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
  await db.transaction('rw', db.workoutPlans, db.workoutPlanExercises, async () => {
    await db.workoutPlans.delete(planId);
    await db.workoutPlanExercises.where('workoutPlanId').equals(planId).delete();
  });
  await enqueue('delete', 'workoutPlans', planId);
}

export async function addExerciseLink({ workoutPlanId, exerciseId, order, targetSets, targetReps, restSeconds }) {
  const link = {
    id: generateId(),
    workoutPlanId,
    exerciseId,
    order,
    targetSets: Number(targetSets),
    targetReps,
    restSeconds: Number(restSeconds)
  };
  await db.workoutPlanExercises.add(link);
  await enqueue('upsert', 'workoutPlanExercises', link.id, link);
  return link.id;
}

export async function removeExerciseLink(linkId) {
  await db.workoutPlanExercises.delete(linkId);
  await enqueue('delete', 'workoutPlanExercises', linkId);
}

export async function findOrCreateExercise(catalog, name, muscleGroup, equipment) {
  const trimmed = name.trim();
  const existing = catalog.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    await db.exercises.update(existing.id, { muscleGroup, equipment });
    const updated = await db.exercises.get(existing.id);
    await enqueue('upsert', 'exercises', existing.id, updated);
    return existing.id;
  }
  const exercise = { id: generateId(), name: trimmed, muscleGroup, equipment };
  await db.exercises.add(exercise);
  await enqueue('upsert', 'exercises', exercise.id, exercise);
  return exercise.id;
}

export async function countPlanExercises(planId) {
  return db.workoutPlanExercises.where('workoutPlanId').equals(planId).count();
}

export async function startSession(planId) {
  const session = {
    id: generateId(),
    workoutPlanId: planId,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  await db.workoutSessions.add(session);
  await enqueue('upsert', 'workoutSessions', session.id, session);
  return session.id;
}

export async function finishSession(sessionId) {
  const updated = { finishedAt: new Date().toISOString() };
  await db.workoutSessions.update(sessionId, updated);
  const session = await db.workoutSessions.get(sessionId);
  await enqueue('upsert', 'workoutSessions', sessionId, session);
}

export async function saveSet({ workoutSessionId, workoutPlanExerciseId, exerciseId, setNumber, weightKg, repsDone }) {
  const set = {
    id: generateId(),
    workoutSessionId,
    workoutPlanExerciseId,
    exerciseId,
    setNumber,
    weightKg,
    repsDone,
    completedAt: new Date().toISOString()
  };
  await db.sessionSets.add(set);
  await enqueue('upsert', 'sessionSets', set.id, set);
  return set.id;
}

export async function updateSet(id, { weightKg, repsDone }) {
  const updated = { weightKg, repsDone, completedAt: new Date().toISOString() };
  await db.sessionSets.update(id, updated);
  const set = await db.sessionSets.get(id);
  await enqueue('upsert', 'sessionSets', id, set);
}
