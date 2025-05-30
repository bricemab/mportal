<script setup lang="ts">
import { ref } from 'vue'
import { Chart as ChartJS, registerables, scales } from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(...registerables)

const chartData = {
  labels: ['Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  datasets: [
    {
      label: 'Chiffre d\'affaires',
      data: [10000, 20000, 50000, 80000, 30000, 25000, 50000, 80000],
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.2)',
      tension: 0.3,
      fill: true,
    },
  ],
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: false,
    },
  },
}
</script>

<template>
  <div class="text-white space-y-6">
    <!-- Stats top -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-12 h-12 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Total de clients</p>
          <p class="text-2xl font-bold">10</p>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-12 h-12 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Total de clients</p>
          <p class="text-2xl font-bold">10</p>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-12 h-12 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Total de clients</p>
          <p class="text-2xl font-bold">10</p>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="bg-lightBlack p-4 rounded-xl overflow-x-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold">Évolutions du CA</h3>
        <select class="bg-lightBlack border border-white rounded-md text-sm px-2 py-1">
          <option>8 derniers mois</option>
          <option>6 derniers mois</option>
        </select>
      </div>
      <div class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <!-- Highlights -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-4 rounded-xl">
        <p class="text-sm text-white/70">Meilleur mois</p>
        <p class="text-xl font-semibold">Novembre</p>
        <p class="text-sm">2024</p>

      </div>
      <div class="bg-lightBlack p-4 rounded-xl">
        <p class="text-sm text-white/70">Meilleur année</p>
        <p class="text-xl font-semibold">2024</p>
        <p class="text-sm">96K de revenus</p>
      </div>
      <div class="bg-lightBlack p-4 rounded-xl">
        <p class="text-sm text-white/70">Meilleur client</p>
        <p class="text-xl font-semibold">Aude Veillon</p>
        <p class="text-sm">La Maison du Yoga</p>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-lightBlack p-4 rounded-xl">
      <h3 class="font-semibold mb-2">Dernières factures générées</h3>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-white/20">
            <th class="py-2">Nom de la facture</th>
            <th>Client</th>
            <th>Montant</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in 3" :key="i" class="border-b border-white/10">
            <td class="py-2">Lorem Ipsum...</td>
            <td>Maxime Burri</td>
            <td>800.-</td>
            <td>28/05/2025</td>
            <td>
              <span :class="[
                i === 2 ? 'bg-red-600' : 'bg-green-600',
                'text-white text-xs px-2 py-1 rounded-full'
              ]">{{ i === 2 ? 'Impayée' : 'Payé' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
input:focus {
  outline: none;
  border-color: white;
}
</style>