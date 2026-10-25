<script setup lang="ts">
import { CalendarPlus, CalendarX2, Download, FileText, Pencil, RotateCcw, Trash2, Upload } from 'lucide-vue-next'
import type { ContractDetail } from '~/types/api'

const route = useRoute()
const id = Number(route.params.id)
const { data, refresh } = await useApiFetch<ContractDetail>(`/api/contracts/${id}`)
useHead({ title: () => `${data.value?.contract.name ?? 'Contrat'} – MPortal` })

const { pending, run } = useAction()
const toast = useToast()
const contract = computed(() => data.value?.contract)
const current = computed(() => data.value?.periods.find((p) => p.isCurrent) ?? data.value?.periods[0] ?? null)

// Saisie d'heures
const entry = reactive({ date: todayIso(), hours: 1, description: '' })
const editingId = ref<number | null>(null)
async function submitEntry() {
  const body = { date: entry.date, hours: Number(entry.hours), description: entry.description }
  const ok = editingId.value
    ? await run('PUT', `/api/contracts/${id}/entries/${editingId.value}`, body, 'Saisie modifiée')
    : await run('POST', `/api/contracts/${id}/entries`, body, 'Heures ajoutées')
  if (ok !== null) {
    cancelEdit()
    await refresh()
  }
}
function editEntry(e: ContractDetail['periods'][number]['entries'][number]) {
  editingId.value = e.id
  Object.assign(entry, { date: e.date, hours: e.hours, description: e.description })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function cancelEdit() {
  editingId.value = null
  Object.assign(entry, { date: todayIso(), hours: 1, description: '' })
}
async function deleteEntry(entryId: number) {
  if (!window.confirm('Supprimer cette saisie ?')) return
  const ok = await run('DELETE', `/api/contracts/${id}/entries/${entryId}`, undefined, 'Saisie supprimée')
  if (ok !== null) await refresh()
}

// Période
const periodOpen = ref(false)
const period = reactive({ startDate: todayIso(), endDate: todayIso(), hoursQuota: 10 })
function openPeriod() {
  const last = data.value?.periods[0]
  const start = last ? addDays(last.endDate, 1) : todayIso()
  Object.assign(period, { startDate: start, endDate: addDays(addMonths(start, 12), -1), hoursQuota: contract.value?.hoursPerPeriod ?? 10 })
  periodOpen.value = true
}
async function submitPeriod() {
  const ok = await run('POST', `/api/contracts/${id}/periods`, { ...period, hoursQuota: Number(period.hoursQuota) }, 'Période ajoutée')
  if (ok !== null) {
    periodOpen.value = false
    await refresh()
  }
}

// Fin / réactivation / édition
const editOpen = ref(false)
const endOpen = ref(false)
const endDate = ref(todayIso())
async function submitEnd() {
  const ok = await run('POST', `/api/contracts/${id}/end`, { endDate: endDate.value }, 'Contrat terminé')
  if (ok !== null) {
    endOpen.value = false
    await refresh()
  }
}
async function reactivate() {
  const ok = await run('POST', `/api/contracts/${id}/reactivate`, {}, 'Contrat réactivé')
  if (ok !== null) await refresh()
}
async function onSaved() {
  editOpen.value = false
  await refresh()
}

// Fichier
const fileInput = ref<HTMLInputElement | null>(null)
async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.type && file.type !== 'application/pdf') {
    toast.error('Seuls les PDF sont acceptés')
    return
  }
  const body = new FormData()
  body.append('file', file)
  const ok = await run('POST', `/api/contracts/${id}/file`, body, 'Contrat PDF enregistré')
  if (fileInput.value) fileInput.value.value = ''
  if (ok !== null) await refresh()
}
async function removeFile() {
  if (!window.confirm('Supprimer le PDF du contrat ?')) return
  const ok = await run('DELETE', `/api/contracts/${id}/file`, undefined, 'Fichier supprimé')
  if (ok !== null) await refresh()
}
</script>

<template>
  <div v-if="data && contract">
    <PageHeader :title="contract.name" :subtitle="data.client?.name" back="/contracts">
      <button class="btn-secondary" @click="editOpen = true"><Pencil class="size-4" /> Modifier</button>
      <button class="btn-secondary" @click="openPeriod"><CalendarPlus class="size-4" /> Période</button>
      <button v-if="contract.status === 'ACTIVE' && !contract.endDate" class="btn-secondary" @click="endOpen = true"><CalendarX2 class="size-4" /> Terminer</button>
      <button v-else class="btn-secondary" :disabled="pending" @click="reactivate"><RotateCcw class="size-4" /> Réactiver</button>
    </PageHeader>

    <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="card space-y-3 lg:col-span-2">
        <h2>Période en cours</h2>
        <template v-if="current">
          <p class="text-sm text-muted">{{ formatDateCh(current.startDate) }} – {{ formatDateCh(current.endDate) }}</p>
          <HoursBar :used="current.usedHours" :quota="current.hoursQuota" />
          <div class="grid grid-cols-3 gap-3 text-center">
            <div>
              <p class="text-xs text-muted">Incluses</p>
              <p class="text-xl font-semibold">{{ formatHours(current.hoursQuota) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted">Utilisées</p>
              <p class="text-xl font-semibold">{{ formatHours(current.usedHours) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted">Restantes</p>
              <p class="text-xl font-semibold" :class="current.remainingHours <= 0 ? 'text-red-400' : 'text-emerald-400'">{{ formatHours(current.remainingHours) }}</p>
            </div>
          </div>
        </template>
        <EmptyState v-else text="Aucune période : ajoutez-en une" />
      </div>

      <div class="card space-y-2 text-sm">
        <h2 class="mb-2">Contrat</h2>
        <p><span class="text-muted">Statut :</span> {{ contract.status === 'ACTIVE' ? 'Actif' : 'Terminé' }}<span v-if="contract.endDate"> (fin {{ formatDateCh(contract.endDate) }})</span></p>
        <p><span class="text-muted">Début :</span> {{ formatDateCh(contract.startDate) }}</p>
        <p><span class="text-muted">Heures / période :</span> {{ formatHours(contract.hoursPerPeriod) }}</p>
        <p v-if="data.subscription">
          <span class="text-muted">Abonnement :</span>
          <NuxtLink :to="`/subscriptions/${data.subscription.id}`" class="link">{{ data.subscription.name }}</NuxtLink>
        </p>
        <p v-if="contract.notes" class="whitespace-pre-line break-all text-muted">{{ contract.notes }}</p>
        <div class="border-t border-line pt-3">
          <p class="mb-2 text-muted">Document du contrat</p>
          <div v-if="contract.fileName" class="flex flex-wrap items-center gap-2">
            <a :href="`/api/contracts/${id}/file`" class="btn-secondary btn-sm" download><Download class="size-4" /> {{ contract.fileOriginalName ?? 'contrat.pdf' }}</a>
            <button class="btn-ghost btn-sm" aria-label="Supprimer le fichier" @click="removeFile"><Trash2 class="size-4 text-red-400" /></button>
          </div>
          <label class="btn-secondary btn-sm mt-2 inline-flex">
            <Upload class="size-4" /> {{ contract.fileName ? 'Remplacer le PDF' : 'Ajouter le PDF' }}
            <input ref="fileInput" type="file" accept="application/pdf" class="sr-only" @change="upload" />
          </label>
        </div>
      </div>
    </div>

    <form class="card mb-6 grid grid-cols-1 gap-3 sm:grid-cols-6" @submit.prevent="submitEntry">
      <h2 class="sm:col-span-6">{{ editingId ? 'Modifier la saisie' : 'Saisir des heures' }}</h2>
      <div class="sm:col-span-1">
        <label class="label" for="te-date">Date</label>
        <input id="te-date" v-model="entry.date" class="input" type="date" required />
      </div>
      <div class="sm:col-span-1">
        <label class="label" for="te-hours">Heures</label>
        <input id="te-hours" v-model.number="entry.hours" class="input" type="number" min="0.25" step="0.25" required />
      </div>
      <div class="sm:col-span-4">
        <label class="label" for="te-desc">Description</label>
        <textarea id="te-desc" v-model="entry.description" class="input" rows="1" required maxlength="5000" />
      </div>
      <div class="flex justify-end gap-2 sm:col-span-6">
        <button v-if="editingId" type="button" class="btn-secondary" @click="cancelEdit">Annuler</button>
        <button type="submit" class="btn-primary" :disabled="pending">{{ editingId ? 'Enregistrer' : 'Ajouter' }}</button>
      </div>
    </form>

    <div class="space-y-4">
      <div v-for="p in data.periods" :key="p.id" class="card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2>
              {{ formatDateCh(p.startDate) }} – {{ formatDateCh(p.endDate) }}
              <span v-if="p.isCurrent" class="ml-2 rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">en cours</span>
            </h2>
            <p class="text-sm text-muted">
              {{ formatHours(p.usedHours) }} / {{ formatHours(p.hoursQuota) }} ·
              <span :class="p.remainingHours < 0 ? 'text-red-400' : ''">{{ formatHours(p.remainingHours) }} restantes</span>
              <template v-if="p.invoice">
                · facture <NuxtLink :to="`/invoices/${p.invoice.id}`" class="link">{{ p.invoice.number }}</NuxtLink>
              </template>
            </p>
          </div>
          <a :href="`/api/contracts/${id}/report?periodId=${p.id}`" class="btn-secondary btn-sm" download><FileText class="size-4" /> Rapport PDF</a>
        </div>
        <EmptyState v-if="p.entries.length === 0" text="Aucune intervention sur cette période" />
        <table v-else>
          <thead>
            <tr><th>Date</th><th>Description</th><th class="text-right">Heures</th><th>Par</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="e in p.entries" :key="e.id">
              <td class="whitespace-nowrap">{{ formatDateCh(e.date) }}</td>
              <td class="whitespace-pre-line">{{ e.description }}</td>
              <td class="text-right whitespace-nowrap">{{ formatHours(e.hours) }}</td>
              <td class="text-muted">{{ e.userFirstname ?? '—' }}</td>
              <td class="text-right whitespace-nowrap">
                <button class="btn-ghost btn-sm" aria-label="Modifier" @click="editEntry(e)"><Pencil class="size-4" /></button>
                <button class="btn-ghost btn-sm" aria-label="Supprimer" @click="deleteEntry(e.id)"><Trash2 class="size-4 text-red-400" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ContractFormModal :open="editOpen" :contract="contract" @close="editOpen = false" @saved="onSaved" />

    <BaseModal :open="periodOpen" title="Ajouter une période" size="sm" @close="periodOpen = false">
      <form class="space-y-4" @submit.prevent="submitPeriod">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="p-start">Début</label>
            <input id="p-start" v-model="period.startDate" class="input" type="date" required />
          </div>
          <div>
            <label class="label" for="p-end">Fin</label>
            <input id="p-end" v-model="period.endDate" class="input" type="date" required />
          </div>
        </div>
        <div>
          <label class="label" for="p-quota">Heures incluses</label>
          <input id="p-quota" v-model.number="period.hoursQuota" class="input" type="number" min="0.25" step="0.25" required />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="periodOpen = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="pending">Ajouter</button>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="endOpen" title="Terminer le contrat" size="sm" @close="endOpen = false">
      <form class="space-y-4" @submit.prevent="submitEnd">
        <p class="text-sm text-muted">Les périodes qui dépassent cette date seront raccourcies.</p>
        <div>
          <label class="label" for="ct-end">Date de fin</label>
          <input id="ct-end" v-model="endDate" class="input" type="date" required />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="endOpen = false">Annuler</button>
          <button type="submit" class="btn-danger" :disabled="pending">Terminer</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
