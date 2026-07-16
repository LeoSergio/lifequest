/**
 * Repositório do jogador — encapsula acesso à tabela `player`.
 *
 * Centraliza a leitura/escrita do estado de gamificação (XP, nível,
 * streak) para que nenhum componente precise saber que existe um
 * IndexedDB por baixo.
 */
import { db } from '../db/db.js';

export async function getPlayer() {
  return db.player.toCollection().first();
}

export async function updatePlayer(id, changes) {
  return db.player.update(id, changes);
}
