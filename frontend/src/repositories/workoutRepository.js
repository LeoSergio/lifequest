import { liveQuery } from 'dexie';
import { db } from '../db/db.js';
import { generateId } from '../lib/id.js';
import { enqueue } from '../services/syncService.js';

function normalizeId(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return isNaN(Number(val)) ? val : Number(val);
  }
  return val;
}

// --- Queries reativas ---

export const workoutPlansQuery = () => liveQuery(() => db.workoutPlans.toArray());

export const exerciseCatalogQuery = () => liveQuery(() => db.exercises.toArray());

export const allSessionSetsQuery = () => liveQuery(() => db.sessionSets.toArray());

export const planSessionsQuery = (planId) =>
  liveQuery(() => db.workoutSessions.where('workoutPlanId').equals(normalizeId(planId)).toArray());

export const planExerciseLinksQuery = (planId) =>
  liveQuery(() =>
    db.workoutPlanExercises.where('workoutPlanId').equals(normalizeId(planId)).sortBy('order')
  );

// --- Operações de escrita ---

export async function removePlan(planId) {
  const normPlanId = normalizeId(planId);
  await db.transaction('rw', db.workoutPlans, db.workoutPlanExercises, async () => {
    await db.workoutPlans.delete(normPlanId);
    await db.workoutPlanExercises.where('workoutPlanId').equals(normPlanId).delete();
  });
  await enqueue('delete', 'workoutPlans', String(normPlanId));
}

export async function updatePlan(planId, updates) {
  const normPlanId = normalizeId(planId);
  await db.workoutPlans.update(normPlanId, updates);
  const plan = await db.workoutPlans.get(normPlanId);
  await enqueue('upsert', 'workoutPlans', String(normPlanId), plan);
}

export async function addExerciseLink({ workoutPlanId, exerciseId, order, targetSets, targetReps, restSeconds }) {
  const link = {
    id: generateId(),
    workoutPlanId: normalizeId(workoutPlanId),
    exerciseId: normalizeId(exerciseId),
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
  const normId = normalizeId(linkId);
  await db.workoutPlanExercises.delete(normId);
  await enqueue('delete', 'workoutPlanExercises', String(normId));
}

export async function findOrCreateExercise(catalog, name, muscleGroup, equipment) {
  const trimmed = name.trim();
  const existing = catalog.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    await db.exercises.update(existing.id, { muscleGroup, equipment });
    const updated = await db.exercises.get(existing.id);
    await enqueue('upsert', 'exercises', String(existing.id), updated);
    return existing.id;
  }
  const exercise = { id: generateId(), name: trimmed, muscleGroup, equipment };
  await db.exercises.add(exercise);
  await enqueue('upsert', 'exercises', exercise.id, exercise);
  return exercise.id;
}

export async function countPlanExercises(planId) {
  return db.workoutPlanExercises.where('workoutPlanId').equals(normalizeId(planId)).count();
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
