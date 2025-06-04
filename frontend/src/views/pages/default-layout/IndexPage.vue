<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Chart as ChartJS, registerables } from 'chart.js'
import { Line } from 'vue-chartjs'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { ClientType } from '@/types/ClientType.ts'
import type { InvoicePage } from '@/types/InvoiceType.ts'
import dayjs, { Dayjs } from 'dayjs'

ChartJS.register(...registerables)

const isLoading = ref<boolean>(true)
const selectedYear = ref(dayjs().year())
const clientsNumber = ref(0)
const servicesNumber = ref(0)
const invoicesNumber = ref(0)
const labelsCA = ref<string[]>([])
const valuesCA = ref<number[]>([])
const years = ref<number[]>([])
const bestMonth = ref<{ year: number; month: string }>({ year: 0, month: '' })
const bestYear = ref<{ year: number; value: number }>({ year: 0, value: 0 })
const bestClient = ref<ClientType>()

const invoiceStateLabels: Record<string, string> = {
  CREATED: 'Créé',
  UPDATED: 'Mis à jour',
  GENERATED: 'Généré',
  SENT: 'Envoyé',
  PAID: 'Payé',
  CANCELLED: 'Annulé',
  UNPAID: 'Impayé',
}

const chartData = {
  labels: labelsCA.value,
  datasets: [
    {
      label: "Chiffre d'affaires",
      data: valuesCA.value,
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
}

const invoices = ref<InvoicePage[]>([])

const loadDashboardData = async () => {
  isLoading.value = true
  const response = await Utils.postEncodedToBackend<{
    clientsNumber: number
    servicesNumber: number
    invoicesNumber: number
    totalCA: {
      labels: string[]
      values: number[]
    }
    years: number[]
    bestMonth: { year: number; month: string }
    bestYear: { year: number; value: number }
    bestClient: ClientType
    invoices: InvoicePage[]
  }>('/load', {
    year: selectedYear.value, // <-- passe l'année sélectionnée
  })

  if (!response.success) {
    toast.error('Une erreur est survenue lors de la récupération des données.')
    isLoading.value = false
    return
  }

  clientsNumber.value = response.data.clientsNumber
  servicesNumber.value = response.data.servicesNumber
  invoicesNumber.value = response.data.invoicesNumber
  labelsCA.value = response.data.totalCA.labels
  valuesCA.value = response.data.totalCA.values
  chartData.labels = labelsCA.value
  chartData.datasets[0].data = valuesCA.value
  bestMonth.value = response.data.bestMonth
  bestYear.value = response.data.bestYear
  bestClient.value = response.data.bestClient
  invoices.value = response.data.invoices
  years.value = response.data.years
  isLoading.value = false
}

onMounted(loadDashboardData)
watch(selectedYear, loadDashboardData)
</script>

<template>
  <div class="space-y-10 mb-5">
    <!-- Stats top -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class="bx bx-group text-2xl text-black"></i>
        </div>
        <div>
          <p class="text-sm">Total de clients</p>
          <h1>{{ clientsNumber }}</h1>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class="bx bxs-component text-2xl text-black"></i>
        </div>
        <div>
          <p class="text-sm">Nombre de services</p>
          <h1>{{ servicesNumber }}</h1>
        </div>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl flex items-center gap-4">
        <div class="bg-white w-15 h-15 flex items-center justify-center rounded-full">
          <i class="bx bx-receipt text-2xl text-black"></i>
        </div>
        <div>
          <p class="text-sm">Factures en attentes</p>
          <h1>{{ invoicesNumber }}</h1>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="bg-lightBlack p-8 rounded-xl overflow-x-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold">Évolutions du CA</h3>
        <select v-model="selectedYear" class="bg-lightBlack rounded-md text-sm px-2 py-1">
          <option v-for="year in years" :key="'year-' + year">{{ year }}</option>
        </select>
      </div>
      <div class="h-64">
        <Line v-if="!isLoading" :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur mois</h4>
        <p class="text-xl font-semibold">{{ bestMonth.month }}</p>
        <p class="text-sm">{{ bestMonth.year }}</p>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur année</h4>
        <p class="text-xl font-semibold">{{ bestYear.year }}</p>
        <p class="text-sm">{{ bestYear.value.toFixed(2) }} CHF de revenus</p>
      </div>
      <div class="bg-lightBlack p-6 rounded-xl">
        <h4 class="mb-4">Meilleur client</h4>
        <p class="text-xl font-semibold">
          {{ bestClient!.firstname + ' ' + bestClient!.lastname }}
        </p>
        <p class="text-sm">{{ bestClient!.name }}</p>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-lightBlack p-6 rounded-xl">
      <div class="mb-5 flex justify-between items-center">
        <div>
          <h3 class="font-semibold mb-1">Dernières factures générées</h3>
          <p class="text-sm">Factures ouvertes & fermées</p>
        </div>
        <router-link to="/invoices">
          <button class="btn btn-primary flex items-center">
            <i class="bx bx-plus pr-2"></i>
            Voir plus
          </button>
        </router-link>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-white">
            <th class="py-5">Client</th>
            <th>N°</th>
            <th class="w-[300px]">Référence</th>
            <th>Nom</th>
            <th>Montant</th>
            <th>Date d'échéance</th>
            <th>Status</th>
          </tr>
          <tr
            v-for="invoice in invoices as InvoicePage[]"
            :key="invoice.id"
            class="border-b border-white py-2"
          >
            <td>{{ invoice.client.name }}</td>
            <td class="py-5">{{ invoice.number }}</td>
            <td>{{ invoice.reference }}</td>
            <td>{{ invoice.name }}</td>
            <td>{{ invoice.amount }}</td>
            <td>
              {{
                invoice.dueAt
                  ? dayjs(invoice.dueAt).format('DD.MM.YYYY HH:mm:ss')
                  : 'pas encore généré'
              }}
            </td>
            <td>
              <label class="rounded px-0 py-1 text-sm font-medium text-gray-100 bg-lightBlack">
                {{ invoiceStateLabels[invoice.state] }}
              </label>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invoice in invoices" :key="invoice.id" class="border-b border-white py-2"></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped></style>
