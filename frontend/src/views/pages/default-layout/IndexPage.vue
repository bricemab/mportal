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
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: false,
    },
  },
};

const factures = ref([
  {
    id: 1,
    nom: 'Facture rebranding',
    client: 'Maxime Burri',
    montant: 800,
    date: '25/05/2025',
    statut: 'Payée',
  },
  {
    id: 2,
    nom: 'Facture rebranding',
    client: 'Maxime Burri',
    montant: 800,
    date: '25/05/2025',
    statut: 'Impayée',
  },
  {
    id: 3,
    nom: 'Facture rebranding',
    client: 'Maxime Burri',
    montant: 800,
    date: '25/05/2025',
    statut: 'Payée',
  },
])

</script>

<template>
  <div class="space-y-10 mb-5">
    <!-- Stats top -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Total de clients</p>
          <h1>10</h1>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Nombre de services</p>
          <h1>12</h1>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class='bx bx-group text-2xl text-black'></i>
        </div>
        <div>
          <p class="text-sm">Facture générées</p>
          <h1>189</h1>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="bg-lightBlack p-8 rounded-xl overflow-x-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold">Évolutions du CA</h3>
        <select class="bg-lightBlack rounded-md text-sm px-2 py-1">
          <option>8 derniers mois</option>
          <option>6 derniers mois</option>
        </select>
      </div>
      <div class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur mois</h4>
        <p class="text-xl font-semibold">Novembre</p>
        <p class="text-sm">2024</p>

      </div>
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur année</h4>
        <p class="text-xl font-semibold">2024</p>
        <p class="text-sm">96K de revenus</p>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur client</h4>
        <p class="text-xl font-semibold">Aude Veillon</p>
        <p class="text-sm">La Maison du Yoga</p>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-lightBlack p-6 rounded-xl">
      <div class="mb-5 flex justify-between items-center">
        <div>
          <h3 class="font-semibold mb-1">Dernières factures générées</h3>
          <p class="text-sm">Factures ouvertes & fermées</p>
        </div>
        <router-link to="/billings">
          <button class="btn btn-primary flex items-center">
            <i class='bx bx-plus pr-2'></i>
            Voir plus
          </button>
        </router-link>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-white">
            <th class="py-5">Nom de la facture</th>
            <th>Client</th>
            <th>Montant</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="facture in factures" :key="facture.id" class="border-b border-white py-2">
            <td class="py-5">{{ facture.nom }}</td>
            <td>{{ facture.client }}</td>
            <td>{{ facture.montant }}.-</td>
            <td>{{ facture.date }}</td>
            <td>
              <span :class="[
                facture.statut === 'Impayée' ? 'bg-red-600 text-red-300' : 'bg-green-600 text-green-300',
                'text-xs px-3 py-1 rounded-md'
              ]">
                {{ facture.statut }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped></style>