import { writable } from 'svelte/store';

/**
 * Estado interno do modal global.
 * Nunca importe isso diretamente — use as funções showAlert/showConfirm/showPrompt.
 */
export const modalState = writable(null);

/**
 * Exibe um modal de alerta (tipo `alert()`).
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.icon]        — emoji ou string
 * @param {string} [opts.confirmText] — texto do botão (padrão: 'OK')
 * @param {'default'|'success'|'danger'|'warning'|'info'} [opts.type]
 * @returns {Promise<void>}
 */
export function showAlert({ title, message, icon, confirmText = 'OK', type = 'default' }) {
  return new Promise((resolve) => {
    modalState.set({ kind: 'alert', title, message, icon, confirmText, type, resolve });
  });
}

/**
 * Exibe um modal de confirmação (tipo `confirm()`).
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.icon]
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {'default'|'success'|'danger'|'warning'|'info'} [opts.type]
 * @returns {Promise<boolean>}
 */
export function showConfirm({
  title,
  message,
  icon,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'default',
}) {
  return new Promise((resolve) => {
    modalState.set({ kind: 'confirm', title, message, icon, confirmText, cancelText, type, resolve });
  });
}

/**
 * Exibe um modal de entrada de texto (tipo `prompt()`).
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {string} [opts.icon]
 * @param {string} [opts.placeholder]
 * @param {string} [opts.defaultValue]
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {string} [opts.inputType]
 * @returns {Promise<string|null>} — null se cancelado
 */
export function showPrompt({
  title,
  message = '',
  icon,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Salvar',
  cancelText = 'Cancelar',
  inputType = 'text',
}) {
  return new Promise((resolve) => {
    modalState.set({ kind: 'prompt', title, message, icon, placeholder, defaultValue, confirmText, cancelText, inputType, resolve });
  });
}
