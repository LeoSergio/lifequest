<script>
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';

  export let labels = [];
  export let data = [];
  export let label = '';

  let canvasEl;
  let chart;

  onMount(() => {
    chart = new Chart(canvasEl, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: '#7c5cff',
            backgroundColor: 'rgba(124, 92, 255, 0.25)',
            pointBackgroundColor: '#7c5cff'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#ffffffcc' } } },
        scales: {
          r: {
            angleLines: { color: '#ffffff1a' },
            grid: { color: '#ffffff1a' },
            pointLabels: { color: '#ffffffcc' },
            ticks: { color: '#ffffff66', backdropColor: 'transparent' }
          }
        }
      }
    });
  });

  $: if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }

  onDestroy(() => chart?.destroy());
</script>

<canvas bind:this={canvasEl}></canvas>
