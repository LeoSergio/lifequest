/**
 * Repositório da despensa — encapsula acesso à tabela `pantryItems`.
 */
import { liveQuery } from 'dexie';
import { db } from '../db/db.js';

export const pantryItemsQuery = () => liveQuery(() => db.pantryItems.toArray());

export async function addPantryItem({ name, category, quantity }) {
  return db.pantryItems.add({
    name: name.trim(),
    category,
    quantity: (quantity ?? '').trim() || null,
    updatedAt: new Date().toISOString()
  });
}

export async function bulkAddPantryItems(items) {
  return db.pantryItems.bulkAdd(
    items.map((c) => ({
      name: c.name.trim(),
      category: c.category,
      quantity: null,
      updatedAt: new Date().toISOString()
    }))
  );
}

export async function removePantryItem(id) {
  return db.pantryItems.delete(id);
}
