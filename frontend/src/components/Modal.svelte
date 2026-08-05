<script>
  import { modalState } from '../lib/modal.js';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  $: state = $modalState;

  let inputValue = '';
  $: if (state?.kind === 'prompt') inputValue = state.defaultValue ?? '';

  function close(result) {
    const resolve = state?.resolve;
    modalState.set(null);
    resolve?.(result);
  }

  function handleKey(e) {
    if (!state) return;
    if (e.key === 'Escape') {
      if (state.kind === 'alert') close();
      else close(state.kind === 'prompt' ? null : false);
    }
    if (e.key === 'Enter' && state.kind !== 'prompt') {
      if (state.kind === 'alert') close();
      else close(true);
    }
  }

  // Cores por tipo
  const typeConfig = {
    default: { accent: '#7C5CFF', icon: '💬', glow: 'rgba(124,92,255,0.25)' },
    success: { accent: '#22c55e', icon: '✅', glow: 'rgba(34,197,94,0.25)' },
    danger:  { accent: '#ef4444', icon: '🗑️', glow: 'rgba(239,68,68,0.25)' },
    warning: { accent: '#f59e0b', icon: '⚠️', glow: 'rgba(245,158,11,0.25)' },
    info:    { accent: '#3b82f6', icon: 'ℹ️', glow: 'rgba(59,130,246,0.25)' },
  };

  $: cfg = typeConfig[state?.type ?? 'default'];
  $: icon = state?.icon ?? cfg?.icon ?? '💬';
</script>

<svelte:window on:keydown={handleKey} />

{#if state}
  <!-- Backdrop -->
  <div
    class="modal-backdrop"
    transition:fade={{ duration: 180 }}
    on:click={() => {
      if (state.kind === 'alert') close();
      else close(state.kind === 'prompt' ? null : false);
    }}
    role="presentation"
  ></div>

  <!-- Card -->
  <div
    class="modal-card"
    transition:fly={{ y: 24, duration: 260, easing: cubicOut }}
    style="--accent: {cfg.accent}; --glow: {cfg.glow};"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    on:click|stopPropagation
  >
    <!-- Ícone -->
    <div class="modal-icon-wrap">
      <span class="modal-icon">{icon}</span>
    </div>

    <!-- Texto -->
    <h2 id="modal-title" class="modal-title">{state.title}</h2>
    {#if state.message}
      <p class="modal-message">{state.message}</p>
    {/if}

    <!-- Input (prompt) -->
    {#if state.kind === 'prompt'}
      <input
        class="modal-input"
        bind:value={inputValue}
        placeholder={state.placeholder ?? ''}
        autofocus
        on:keydown={(e) => e.key === 'Enter' && close(inputValue.trim() || null)}
      />
    {/if}

    <!-- Botões -->
    <div class="modal-actions" class:single={state.kind === 'alert'}>
      {#if state.kind !== 'alert'}
        <button
          class="modal-btn modal-btn-cancel"
          on:click={() => close(state.kind === 'prompt' ? null : false)}
        >
          {state.cancelText ?? 'Cancelar'}
        </button>
      {/if}

      <button
        class="modal-btn modal-btn-confirm"
        on:click={() => {
          if (state.kind === 'prompt') close(inputValue.trim() || null);
          else if (state.kind === 'confirm') close(true);
          else close();
        }}
      >
        {state.confirmText ?? 'OK'}
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 9998;
  }

  .modal-card {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 100%);
    background: linear-gradient(145deg, #1a1726, #141020);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom: none;
    border-radius: 28px 28px 0 0;
    padding: 32px 24px 36px;
    z-index: 9999;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .modal-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    box-shadow: 0 0 24px var(--glow);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .modal-icon {
    font-size: 28px;
    line-height: 1;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    text-align: center;
    margin: 0;
    line-height: 1.3;
  }

  .modal-message {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.55);
    text-align: center;
    margin: 0;
    line-height: 1.6;
    white-space: pre-line;
  }

  .modal-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 14px 16px;
    font-size: 15px;
    color: #fff;
    outline: none;
    transition: border-color 0.2s;
    margin-top: 4px;
  }

  .modal-input:focus {
    border-color: var(--accent);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .modal-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .modal-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    margin-top: 8px;
  }

  .modal-actions.single {
    grid-template-columns: 1fr;
  }

  .modal-btn {
    padding: 15px 20px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.18s ease;
    letter-spacing: 0.01em;
  }

  .modal-btn:active {
    transform: scale(0.97);
  }

  .modal-btn-cancel {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-btn-confirm {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 4px 16px var(--glow);
  }

  .modal-btn-confirm:hover {
    filter: brightness(1.1);
    box-shadow: 0 6px 24px var(--glow);
  }
</style>
