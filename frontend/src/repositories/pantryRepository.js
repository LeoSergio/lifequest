import { liveQuery } from 'dexie';
import { db } from '../db/db.js';
import { generateId } from '../lib/id.js';
import { enqueue } from '../services/syncService.js';

export const pantryItemsQuery = () => liveQuery(() => db.pantryItems.toArray());

export async function addPantryItem({ name, category, quantity }) {
  const item = {
    id: generateId(),
    name: name.trim(),
    category,
    quantity: (quantity ?? '').trim() || null,
  };
  await db.pantryItems.add(item);
  await enqueue('upsert', 'pantryItems', item.id, item);
  return item.id;
}

export async function bulkAddPantryItems(items) {
  const rows = items.map((c) => ({
    id: generateId(),
    name: c.name.trim(),
    category: c.category,
    quantity: null,
  }));
  await db.pantryItems.bulkAdd(rows);
  // Enfileira cada item individualmente
  for (const row of rows) {
    await enqueue('upsert', 'pantryItems', row.id, row);
  }
}

export async function removePantryItem(id) {
  await db.pantryItems.delete(id);
  await enqueue('delete', 'pantryItems', id);
}
