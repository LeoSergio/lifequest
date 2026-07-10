<script>
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';

  export let labels = [];
  export let data = [];
  export let label = '';

  let canvasEl;
  let chart;

  // onMount roda UMA VEZ, depois que o elemento <canvas> já existe no DOM
  // (Chart.js precisa de um canvas real pra desenhar, não dá pra criar
  // o gráfico antes disso existir).
  onMount(() => {
    chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: '#7c5cff',
            backgroundColor: 'rgba(124, 92, 255, 0.15)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#ffffffcc' } } },
        scales: {
          x: { ticks: { color: '#ffffff99' }, grid: { color: '#ffffff1a' } },
          y: { ticks: { color: '#ffffff99' }, grid: { color: '#ffffff1a' } }
        }
      }
    });
  });

  // Reactive statement: toda vez que `labels` ou `data` mudarem (props novas
  // vindas do componente pai), atualizamos o gráfico já existente em vez
  // de recriar do zero — mais eficiente e evita "piscar" a tela.
  $: if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }

  // Sempre limpe recursos externos ao Svelte (como uma instância do Chart.js)
  // quando o componente for destruído, ou fica "vazando" memória.
  onDestroy(() => chart?.destroy());
</script>

<canvas bind:this={canvasEl}></canvas>
