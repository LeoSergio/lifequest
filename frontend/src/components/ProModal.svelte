<script>
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onMount, onDestroy } from 'svelte';

  export let onClose; // function(result: { plan: string } | false)

  let selectedPlan = 'lifetime'; // 'monthly' | 'lifetime'

  function close(confirmed) {
    if (onClose) onClose(confirmed ? { plan: selectedPlan } : false);
  }

  // Prevent scrolling on body when modal is open
  onMount(() => {
    document.body.style.overflow = 'hidden';
  });
  
  onDestroy(() => {
    document.body.style.overflow = '';
  });
</script>

<div class="pro-overlay" transition:fade={{ duration: 200 }}>
  <div class="pro-container" transition:fly={{ y: 50, duration: 300, easing: cubicOut }}>
    
    <!-- Header -->
    <div class="header">
      <button class="back-btn" on:click={() => close(false)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Crown Icon -->
    <div class="crown-wrapper">
      <div class="crown-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" display="none"/>
          <path d="M4 19h16v2H4v-2zm16-4l-3-10-5 6-5-6-3 10h16z"/>
        </svg>
      </div>
      <!-- Background particles effect -->
      <div class="particles"></div>
    </div>

    <!-- Titles -->
    <div class="titles">
      <h1>Vantagens do <br><span class="highlight">LifeQuest PRO</span></h1>
      <p>Desbloqueie todo o potencial da sua jornada e evolua sem limites.</p>
    </div>

    <!-- Benefits List -->
    <div class="benefits-list">
      
      <!-- AI -->
      <div class="benefit-item">
        <div class="icon-box" style="--c: #9d4edd; --bg: rgba(157, 78, 221, 0.15)">
          🤖
        </div>
        <div class="text">
          <h3>Inteligência Artificial ilimitada</h3>
          <p>Geração de treinos, análises e sugestões de dieta sem bloqueios diários.</p>
        </div>
        <div class="chevron">›</div>
      </div>

      <!-- Metrics -->
      <div class="benefit-item">
        <div class="icon-box" style="--c: #22c55e; --bg: rgba(34, 197, 94, 0.15)">
          📊
        </div>
        <div class="text">
          <h3>Métricas Avançadas</h3>
          <p>Acompanhe seu progresso real de hipertrofia com gráficos precisos.</p>
        </div>
        <div class="chevron">›</div>
      </div>

      <!-- Economy -->
      <div class="benefit-item">
        <div class="icon-box" style="--c: #eab308; --bg: rgba(234, 179, 8, 0.15)">
          💎
        </div>
        <div class="text">
          <h3>Economia Premium</h3>
          <p>Receba Pro Coins mensais para gastar na loja com itens épicos.</p>
        </div>
        <div class="chevron">›</div>
      </div>

      <!-- Customization -->
      <div class="benefit-item">
        <div class="icon-box" style="--c: #3b82f6; --bg: rgba(59, 130, 246, 0.15)">
          🎨
        </div>
        <div class="text">
          <h3>Personalização Total</h3>
          <p>Avatares exclusivos, temas dinâmicos e customização completa do perfil.</p>
        </div>
        <div class="chevron">›</div>
      </div>

    </div>

    <!-- Plan Selection -->
    <div class="plans-container">
      <div 
        class="plan-card {selectedPlan === 'monthly' ? 'active' : ''}"
        on:click={() => selectedPlan = 'monthly'}
      >
        <div class="plan-header">
          <span class="plan-name">Mensal</span>
        </div>
        <div class="plan-price">
          R$ 4,99<span class="plan-period">/mês</span>
        </div>
      </div>

      <div 
        class="plan-card {selectedPlan === 'lifetime' ? 'active' : ''} lifetime-card"
        on:click={() => selectedPlan = 'lifetime'}
      >
        <div class="badge">PROMOÇÃO</div>
        <div class="plan-header">
          <span class="plan-name">Vitalício</span>
        </div>
        <div class="plan-price">
          R$ 19,99
        </div>
        <div class="plan-old-price">de R$ 50,00</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn-cancel" on:click={() => close(false)}>
        Voltar
      </button>
      <button class="btn-confirm" on:click={() => close(true)}>
        <span class="btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M4 19h16v2H4v-2zm16-4l-3-10-5 6-5-6-3 10h16z"/>
          </svg>
        </span>
        <div class="btn-content">
          <span class="btn-title">Assinar PRO</span>
          <span class="btn-sub">{selectedPlan === 'lifetime' ? 'Pagamento único' : 'R$ 4,99 /mês'}</span>
        </div>
      </button>
    </div>

  </div>
</div>

<style>
  .pro-overlay {
    position: fixed;
    inset: 0;
    background: #0b0914;
    z-index: 99999;
    display: flex;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .pro-container {
    width: 100%;
    max-width: 480px;
    min-height: 100%;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    position: relative;
    padding-bottom: 40px;
  }

  .header {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    margin-bottom: 10px;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.1);
  }

  .crown-wrapper {
    display: flex;
    justify-content: center;
    position: relative;
    margin-bottom: 24px;
  }

  .crown-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, rgba(124, 92, 255, 0.2), rgba(124, 92, 255, 0.05));
    border: 2px solid #7c5cff;
    border-radius: 24px;
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 30px rgba(124, 92, 255, 0.3), inset 0 0 20px rgba(124, 92, 255, 0.2);
  }

  .crown-icon svg {
    color: #a78bfa;
    transform: rotate(-45deg);
    filter: drop-shadow(0 2px 8px rgba(124,92,255,0.6));
  }

  .titles {
    text-align: center;
    margin-bottom: 32px;
  }

  .titles h1 {
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
    margin: 0 0 12px 0;
  }

  .titles .highlight {
    color: #a78bfa;
    background: linear-gradient(90deg, #a78bfa, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .titles p {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    margin: 0;
    padding: 0 20px;
  }

  .benefits-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 0;
  }

  .icon-box {
    width: 48px;
    height: 48px;
    min-width: 48px;
    background: var(--bg);
    border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--c) 15%, transparent);
  }

  .text {
    flex: 1;
  }

  .text h3 {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 4px 0;
  }

  .text p {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
  }

  .chevron {
    color: rgba(255, 255, 255, 0.3);
    font-size: 24px;
    font-weight: 300;
  }

  .pricing-box {
    background: rgba(124, 92, 255, 0.05);
    border: 1px solid rgba(124, 92, 255, 0.3);
    border-radius: 20px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .pricing-icon {
    width: 48px;
    height: 48px;
    background: rgba(124, 92, 255, 0.15);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }

  .pricing-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .muted {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .muted.small {
    font-size: 12px;
  }

  .price {
    color: #a78bfa;
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
  }

  .price .month {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
  }

  /* O usuário pediu botões menores que no design, focando no mobile */
  .actions {
    display: flex;
    gap: 12px;
    margin-top: auto;
  }

  .btn-cancel {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    padding: 12px; /* Reduzido de 16px para ficar menor */
    transition: all 0.2s;
  }

  .btn-cancel:active {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(0.98);
  }

  .btn-confirm {
    flex: 2;
    background: #7c5cff;
    border: none;
    border-radius: 16px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    padding: 10px 12px; /* Reduzido para ficar menor */
    box-shadow: 0 4px 20px rgba(124, 92, 255, 0.4);
    transition: all 0.2s;
  }

  .btn-confirm:active {
    transform: scale(0.98);
    background: #6b4be6;
  }

  .btn-icon {
    display: flex;
    align-items: center;
  }

  .btn-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  .btn-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.2;
  }

  /* Plan Selection Styles */
  .plans-container {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .plan-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 16px 12px;
    cursor: pointer;
    text-align: center;
    position: relative;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .plan-card:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .plan-card.active {
    background: rgba(124, 92, 255, 0.15);
    border-color: #7c5cff;
    box-shadow: 0 4px 15px rgba(124, 92, 255, 0.2);
  }

  .plan-header {
    margin-bottom: 8px;
  }

  .plan-name {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .active .plan-name {
    color: #a78bfa;
  }

  .plan-price {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }

  .plan-period {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
  }

  .plan-old-price {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-decoration: line-through;
    margin-top: 4px;
  }

  .lifetime-card {
    border-color: rgba(234, 179, 8, 0.3);
  }

  .lifetime-card.active {
    border-color: #eab308;
    background: rgba(234, 179, 8, 0.1);
    box-shadow: 0 4px 15px rgba(234, 179, 8, 0.15);
  }

  .lifetime-card.active .plan-name {
    color: #fde047;
  }

  .badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: #eab308;
    color: #000;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(234, 179, 8, 0.4);
  }

  /* Mobile responsiveness enhancements */
  @media (max-width: 480px) {
    .pro-container {
      padding: 16px;
      padding-bottom: 24px;
    }
    .crown-icon {
      width: 64px;
      height: 64px;
    }
    .titles h1 {
      font-size: 22px;
    }
    .icon-box {
      width: 40px;
      height: 40px;
      min-width: 40px;
      font-size: 20px;
    }
    .text h3 {
      font-size: 14px;
    }
    .text p {
      font-size: 12px;
    }
    .plan-card {
      padding: 12px 8px;
    }
    .plan-price {
      font-size: 18px;
    }
  }
</style>
