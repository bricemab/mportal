<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartData, type ChartOptions } from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{ labels: string[]; invoiced: number[]; collected: number[]; expenses: number[] }>()

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: [
    { label: 'Facturé', data: props.invoiced.map((v) => v / 100), backgroundColor: '#ffffff', borderRadius: 3 },
    { label: 'Encaissé', data: props.collected.map((v) => v / 100), backgroundColor: '#22c55e', borderRadius: 3 },
    { label: 'Dépenses', data: props.expenses.map((v) => v / 100), backgroundColor: '#ef4444', borderRadius: 3 },
  ],
}))

const options: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#d4d4d4', boxWidth: 12 } },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label ?? ''} : ${formatChf(Math.round(Number(ctx.raw) * 100))}`,
      },
    },
  },
  scales: {
    x: { ticks: { color: '#9a9a9a' }, grid: { display: false } },
    y: { ticks: { color: '#9a9a9a' }, grid: { color: '#262626' } },
  },
}
</script>

<template>
  <div class="h-72">
    <Bar :data="data" :options="options" />
  </div>
</template>
