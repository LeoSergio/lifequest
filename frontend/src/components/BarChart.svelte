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
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: '#7c5cff',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#ffffffcc' } } },
        scales: {
          x: { ticks: { color: '#ffffff99' }, grid: { display: false } },
          y: { ticks: { color: '#ffffff99' }, grid: { color: '#ffffff1a' }, beginAtZero: true }
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
