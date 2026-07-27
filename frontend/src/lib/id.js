/**
 * Gera um identificador único globalmente (UUID v4).
 *
 * Por quê isso existe: as tabelas sincronizáveis do Dexie usam `++id`
 * (autoincremento local). Sem um valor explícito, cada dispositivo/instalação
 * começa a contar do 1 de novo — dois dispositivos diferentes (ou dois
 * usuários diferentes) acabam gerando o MESMO id (1, 2, 3...) para
 * registros completamente diferentes.
 *
 * Como o backend usa esse `id` como chave primária dos registros
 * sincronizados, essa colisão faz um dispositivo sobrescrever os dados
 * do outro (mesmo usuário, ids duplicados) ou o push falhar com erro de
 * chave duplicada (usuários diferentes).
 *
 * A correção é: todo registro criado em uma tabela sincronizável
 * (ver SYNCABLE_TABLES em services/syncService.js) precisa de um id
 * explícito, globalmente único, gerado no cliente — nunca deixado para
 * o autoincremento do Dexie decidir.
 *
 * `++id` continua funcionando normalmente quando você passa um valor:
 * o IndexedDB só auto-gera a chave se a propriedade vier `undefined`.
 * Passar um UUID aqui não exige nenhuma migração de schema do Dexie.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback para ambientes sem crypto.randomUUID (browsers/webviews antigos).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
